#!/usr/bin/env node

/**
 * Script to create PostgreSQL tables based on UserTable registry entries
 * This creates the actual tables that are registered but don't exist yet
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createTablesFromRegistry() {
  try {
    console.log("🔍 Finding registered tables...\n");

    // Get all registered tables
    const registeredTables = await prisma.userTable.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (registeredTables.length === 0) {
      console.log("📋 No registered tables found.");
      return;
    }

    console.log(`📋 Found ${registeredTables.length} registered table(s)\n`);

    for (const table of registeredTables) {
      console.log(`\n📊 Processing table: ${table.tableName}`);
      console.log(`   App ID: ${table.appId}`);

      // Check if table already exists
      const tableExistsResult = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table.tableName.replace(/'/g, "''")}'
        ) as exists`
      );

      const exists = tableExistsResult[0]?.exists || false;

      if (exists) {
        console.log(`   ✅ Table already exists, skipping...`);
        continue;
      }

      // Parse columns
      let columns;
      if (typeof table.columns === 'string') {
        columns = JSON.parse(table.columns);
      } else {
        columns = table.columns;
      }

      // Build CREATE TABLE SQL
      const columnDefinitions = [];
      
      // Add id column first (if not already defined)
      let hasIdColumn = false;
      for (const [colName, colDef] of Object.entries(columns)) {
        if (colName.toLowerCase() === 'id') {
          hasIdColumn = true;
        }
      }

      if (!hasIdColumn) {
        columnDefinitions.push('id SERIAL PRIMARY KEY');
      }

      // Add other columns
      for (const [colName, colDef] of Object.entries(columns)) {
        if (colName.toLowerCase() === 'id' && colDef.primaryKey) {
          // Handle id column with primary key
          columnDefinitions.push(`"${colName}" SERIAL PRIMARY KEY`);
        } else {
          // Map type from metadata to PostgreSQL type
          let pgType = 'TEXT';
          
          if (colDef.type) {
            const typeLower = colDef.type.toLowerCase();
            if (typeLower.includes('integer') || typeLower.includes('int')) {
              pgType = 'INTEGER';
            } else if (typeLower.includes('varchar')) {
              const maxLength = colDef.maxLength || 255;
              pgType = `VARCHAR(${maxLength})`;
            } else if (typeLower.includes('text')) {
              pgType = 'TEXT';
            } else if (typeLower.includes('boolean') || typeLower.includes('bool')) {
              pgType = 'BOOLEAN';
            } else if (typeLower.includes('timestamp') || typeLower.includes('date')) {
              pgType = 'TIMESTAMP';
            } else if (typeLower.includes('json')) {
              pgType = 'JSONB';
            }
          }

          // Add column definition
          const nullable = colDef.required === false ? '' : ' NOT NULL';
          columnDefinitions.push(`"${colName}" ${pgType}${nullable}`);
        }
      }

      // Add app_id column for tracking
      columnDefinitions.push(`app_id INTEGER NOT NULL DEFAULT ${table.appId}`);

      // Create the table
      const createTableSQL = `
        CREATE TABLE "${table.tableName}" (
          ${columnDefinitions.join(',\n          ')}
        )
      `;

      console.log(`   🔨 Creating table...`);
      console.log(`   SQL: ${createTableSQL.replace(/\s+/g, ' ').trim()}\n`);

      try {
        await prisma.$executeRawUnsafe(createTableSQL);

        // Create index on app_id
        await prisma.$executeRawUnsafe(
          `CREATE INDEX idx_${table.tableName}_app_id ON "${table.tableName}" (app_id)`
        );

        console.log(`   ✅ Table "${table.tableName}" created successfully!`);
      } catch (error) {
        console.error(`   ❌ Error creating table "${table.tableName}":`, error.message);
        console.error(`   SQL was: ${createTableSQL}`);
      }
    }

    console.log("\n✨ Done processing all tables!\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTablesFromRegistry();

