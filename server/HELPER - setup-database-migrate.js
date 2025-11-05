#!/usr/bin/env node

/**
 * Alternative script using Prisma Migrations to create all database tables
 * Database: floneo
 * DATABASE_URL: postgresql://postgres:123@localhost:5432/floneo?schema=public
 * 
 * This script creates migration files and applies them to the database.
 * Use this if you want to track schema changes with migrations.
 */

const { execSync } = require("child_process");
const path = require("path");

// Set the DATABASE_URL environment variable
process.env.DATABASE_URL =
  "postgresql://postgres:123@localhost:5432/floneo?schema=public";

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");

console.log("🚀 Setting up database tables using migrations...\n");
console.log(`📋 Database: floneo`);
console.log(`📋 Schema: ${schemaPath}\n`);

try {
  // Step 1: Generate Prisma Client
  console.log("📦 Step 1: Generating Prisma Client...");
  execSync(`npx prisma generate --schema=${schemaPath}`, {
    stdio: "inherit",
    cwd: __dirname,
  });
  console.log("✅ Prisma Client generated successfully\n");

  // Step 2: Create and apply initial migration
  console.log("🗄️  Step 2: Creating initial migration...");
  try {
    execSync(
      `npx prisma migrate dev --name init --schema=${schemaPath} --create-only`,
      {
        stdio: "inherit",
        cwd: __dirname,
      }
    );
    console.log("✅ Migration files created\n");
  } catch (error) {
    // If migrations already exist, just apply them
    console.log("📝 Migrations already exist, applying existing migrations...\n");
  }

  // Step 3: Apply migrations to database
  console.log("🗄️  Step 3: Applying migrations to database...");
  execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
    stdio: "inherit",
    cwd: __dirname,
  });
  console.log("\n✅ All migrations applied successfully!\n");

  // Step 4: Optional - Show database status
  console.log("📊 Database Status:");
  console.log("   - All tables from schema.prisma have been created");
  console.log("   - Migration files are in prisma/migrations/");
  console.log("   - You can now use Prisma Studio to view data");
  console.log("   - Run: npm run prisma:studio\n");

  console.log("✨ Database setup complete!");
} catch (error) {
  console.error("\n❌ Error setting up database:");
  console.error(error.message);
  console.error("\n💡 Tip: If migrations already exist, try running:");
  console.error("   npm run prisma:migrate\n");
  process.exit(1);
}

