#!/usr/bin/env node

/**
 * Script to run Prisma Studio connected to Docker database
 * 
 * Usage:
 *   node prisma-studio-docker.js        # Connect to Docker database (default)
 *   node prisma-studio-docker.js --local # Connect to local database
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Determine which database to use
let databaseUrl;
const args = process.argv.slice(2);

if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
  console.log("📋 Using custom DATABASE_URL from environment\n");
} else if (args.includes("--local")) {
  databaseUrl = "postgresql://postgres:123@localhost:5432/floneo?schema=public";
  console.log("📋 Connecting to local database: floneo\n");
} else {
  databaseUrl = "postgresql://floneo:floneo123@localhost:5432/floneo_db?schema=public";
  console.log("📋 Connecting to Docker database: floneo_db (default)\n");
  console.log("💡 Tip: Use --local flag for local database\n");
}

// Set the DATABASE_URL environment variable
process.env.DATABASE_URL = databaseUrl;

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");

console.log("🚀 Starting Prisma Studio...\n");
console.log(`📋 Schema: ${schemaPath}`);
console.log(`📋 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}\n`);
console.log("📝 Prisma Studio will open in your browser at http://localhost:5555\n");
console.log("⚠️  Press Ctrl+C to stop Prisma Studio\n");

// Temporarily handle .env file
const envFilePath = path.join(__dirname, ".env");
const envBackupPath = path.join(__dirname, ".env.backup");
let envFileBackedUp = false;

// Backup .env file BEFORE setting environment variables
if (fs.existsSync(envFilePath)) {
  console.log("📝 Temporarily backing up .env file to use Docker DATABASE_URL...\n");
  fs.copyFileSync(envFilePath, envBackupPath);
  fs.unlinkSync(envFilePath); // Remove .env so Prisma doesn't load it
  envFileBackedUp = true;
}

// Create env object with DATABASE_URL - ensure it's set
const execEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
};

// Verify DATABASE_URL is set correctly
console.log(`🔍 Verifying DATABASE_URL: ${execEnv.DATABASE_URL.substring(0, 50)}...\n`);

try {
  // Regenerate Prisma Client with correct DATABASE_URL first
  console.log("📦 Regenerating Prisma Client with correct DATABASE_URL...");
  execSync(`npx prisma generate --schema=${schemaPath}`, {
    stdio: "inherit",
    cwd: __dirname,
    env: execEnv,
  });
  console.log("✅ Prisma Client regenerated\n");

  // Create a temporary .env file with the correct DATABASE_URL
  // Prisma Studio reads from .env file, so we need to create it properly
  const tempEnvContent = `DATABASE_URL=${databaseUrl}`;
  fs.writeFileSync(envFilePath, tempEnvContent, 'utf8');
  
  // Verify the file was written correctly
  const writtenContent = fs.readFileSync(envFilePath, 'utf8');
  console.log("📝 Created temporary .env file with Docker DATABASE_URL");
  console.log(`📝 File content: ${writtenContent.substring(0, 70)}...`);
  console.log(`📝 Full URL: ${databaseUrl}\n`);

  // Run Prisma Studio - it will read from the temp .env file
  execSync(`npx prisma studio --schema=${schemaPath}`, {
    stdio: "inherit",
    cwd: __dirname,
    env: execEnv,
  });
} catch (error) {
  // If user presses Ctrl+C, that's expected
  if (error.signal === 'SIGINT' || error.code === null) {
    console.log("\n\n✅ Prisma Studio stopped");
  } else {
    console.error("\n❌ Error running Prisma Studio:");
    console.error(error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout.toString());
    if (error.stderr) console.error("STDERR:", error.stderr.toString());
  }
} finally {
  // Restore original .env file if it was backed up
  if (envFileBackedUp && fs.existsSync(envBackupPath)) {
    console.log("\n📝 Restoring original .env file...");
    if (fs.existsSync(envFilePath)) {
      fs.unlinkSync(envFilePath); // Remove temp .env
    }
    fs.copyFileSync(envBackupPath, envFilePath);
    fs.unlinkSync(envBackupPath);
  } else if (!envFileBackedUp && fs.existsSync(envFilePath)) {
    // If there was no original .env, remove the temp one we created
    console.log("\n📝 Removing temporary .env file...");
    fs.unlinkSync(envFilePath);
  }
}

