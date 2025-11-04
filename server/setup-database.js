#!/usr/bin/env node

/**
 * Script to create all database tables from Prisma schema
 * Database: floneo
 * DATABASE_URL: postgresql://postgres:123@localhost:5432/floneo?schema=public
 */

const { execSync } = require("child_process");
const path = require("path");

// Set the DATABASE_URL environment variable
process.env.DATABASE_URL =
  "postgresql://postgres:123@localhost:5432/floneo?schema=public";

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");

console.log("🚀 Setting up database tables...\n");
console.log(`📋 Database: floneo`);
console.log(`📋 Schema: ${schemaPath}\n`);

try {
  // Step 1: Generate Prisma Client (optional but recommended)
  console.log("📦 Step 1: Generating Prisma Client...");
  try {
    execSync(`npx prisma generate --schema=${schemaPath}`, {
      stdio: "inherit",
      cwd: __dirname,
    });
    console.log("✅ Prisma Client generated successfully\n");
  } catch (error) {
    console.log("⚠️  Prisma Client generation skipped (may already exist)\n");
  }

  // Step 2: Push schema to database (creates all tables)
  console.log("🗄️  Step 2: Creating tables in database...");
  execSync(`npx prisma db push --schema=${schemaPath} --accept-data-loss`, {
    stdio: "inherit",
    cwd: __dirname,
  });
  console.log("\n✅ All tables created successfully!\n");

  // Step 3: Optional - Show database status
  console.log("📊 Database Status:");
  console.log("   - All tables from schema.prisma have been created");
  console.log("   - You can now use Prisma Studio to view data");
  console.log("   - Run: npm run prisma:studio\n");

  console.log("✨ Database setup complete!");
} catch (error) {
  console.error("\n❌ Error setting up database:");
  console.error(error.message);
  process.exit(1);
}

