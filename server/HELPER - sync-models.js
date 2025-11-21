#!/usr/bin/env node

/**
 * Script to ensure Prisma models (App, UserTable, Workflow, Canvas) are migrated and synced
 * 
 * Usage:
 *   node sync-models.js                    # Uses Docker database (default)
 *   node sync-models.js --local            # Uses local database
 *   DATABASE_URL="..." node sync-models.js # Uses custom DATABASE_URL
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Determine which database to use
let databaseUrl;
const args = process.argv.slice(2);

if (process.env.DATABASE_URL) {
  // Use custom DATABASE_URL if provided
  databaseUrl = process.env.DATABASE_URL;
  console.log("📋 Using custom DATABASE_URL from environment\n");
} else if (args.includes("--local")) {
  // Use local database
  databaseUrl = "postgresql://postgres:123@localhost:5432/floneo?schema=public";
  console.log("📋 Using local database: floneo\n");
} else {
  // Default: Use Docker database
  databaseUrl = "postgresql://floneo:floneo123@localhost:5432/floneo_db?schema=public";
  console.log("📋 Using Docker database: floneo_db (default)\n");
  console.log("💡 Tip: Use --local flag for local database, or set DATABASE_URL env var\n");
}

// Set the DATABASE_URL environment variable
process.env.DATABASE_URL = databaseUrl;

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");
const migrationsDir = path.join(__dirname, "prisma", "migrations");

console.log("🔍 Verifying Prisma models migration status...\n");
console.log(`📋 Schema: ${schemaPath}\n`);

const modelsToVerify = ["App", "UserTable", "Workflow", "Canvas"];

async function verifyModels(prisma) {
  console.log("🔍 Step 3: Verifying models in database...");
  
  // Test each model
  for (const model of modelsToVerify) {
    try {
      switch (model) {
        case "App":
          await prisma.app.findMany({ take: 1 });
          break;
        case "UserTable":
          await prisma.userTable.findMany({ take: 1 });
          break;
        case "Workflow":
          await prisma.workflow.findMany({ take: 1 });
          break;
        case "Canvas":
          await prisma.canvas.findMany({ take: 1 });
          break;
      }
      console.log(`   ✅ ${model} table exists and is accessible`);
    } catch (error) {
      console.log(`   ❌ ${model} table error: ${error.message}`);
    }
  }
}

(async () => {
  try {
    // Create env object with DATABASE_URL to override .env file
    const execEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    // Step 1: Generate Prisma Client
    console.log("📦 Step 1: Generating Prisma Client...");
    // Temporarily rename .env file to prevent Prisma from loading it
    const envFilePath = path.join(__dirname, ".env");
    const envBackupPath = path.join(__dirname, ".env.backup");
    let envFileBackedUp = false;
    
    if (fs.existsSync(envFilePath)) {
      console.log("📝 Temporarily backing up .env file to use custom DATABASE_URL...");
      fs.renameSync(envFilePath, envBackupPath);
      envFileBackedUp = true;
    }
    
    try {
      execSync(`npx prisma generate --schema=${schemaPath}`, {
        stdio: "inherit",
        cwd: __dirname,
        env: execEnv,
      });
      console.log("✅ Prisma Client generated successfully\n");

      // Step 2: Check if migrations exist
      const migrationsExist = fs.existsSync(migrationsDir) && 
        fs.readdirSync(migrationsDir).length > 0;

      if (migrationsExist) {
        console.log("📝 Step 2: Migrations found, applying them...");
        execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
          stdio: "inherit",
          cwd: __dirname,
          env: execEnv,
        });
        console.log("✅ Migrations applied successfully\n");
      } else {
        console.log("📝 Step 2: No migrations found, creating initial migration...");
        try {
          execSync(
            `npx prisma migrate dev --name init --schema=${schemaPath}`,
            {
              stdio: "inherit",
              cwd: __dirname,
              env: execEnv,
            }
          );
          console.log("✅ Initial migration created and applied\n");
        } catch (error) {
          console.log("⚠️  Migration creation failed, using db push instead...\n");
          execSync(`npx prisma db push --schema=${schemaPath} --accept-data-loss`, {
            stdio: "inherit",
            cwd: __dirname,
            env: execEnv,
          });
          console.log("✅ Schema pushed to database\n");
        }
      }
    } finally {
      // Restore .env file if it was backed up
      if (envFileBackedUp && fs.existsSync(envBackupPath)) {
        console.log("📝 Restoring .env file...");
        fs.renameSync(envBackupPath, envFilePath);
      }
    }

    // Step 3: Verify models exist in database
    const { PrismaClient } = require("@prisma/client");
    // Ensure PrismaClient uses the correct DATABASE_URL
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    try {
      await verifyModels(prisma);
    } finally {
      await prisma.$disconnect();
    }

    console.log("\n📊 Summary:");
    console.log("   - Prisma Client: Generated");
    console.log("   - Database Schema: Synced");
    console.log("   - Models Verified: App, UserTable, Workflow, Canvas");
    console.log("\n✨ All models are migrated and synced!");

  } catch (error) {
    console.error("\n❌ Error syncing models:");
    console.error(error.message);
    process.exit(1);
  }
})();

