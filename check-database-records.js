const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseRecords() {
  try {
    console.log('=== Checking Database Records ===\n');

    // Get all tables for app 1
    const userTables = await prisma.userTable.findMany({ where: { appId: 1 } });
    
    console.log('📊 User Tables for App 1:', userTables.length);
    
    if (userTables.length > 0) {
      userTables.forEach(table => {
        console.log(`\n   Table: ${table.tableName}`);
        console.log(`   Columns: ${JSON.stringify(table.columns)}`);
      });
    }

    // Check if app_1_hhh table exists and has data
    try {
      const result = await prisma.$queryRaw`
        SELECT * FROM "app_1_hhh" LIMIT 10
      `;
      console.log('\n📋 Records in app_1_hhh:', result.length);
      if (result.length > 0) {
        console.log('   Sample record:', JSON.stringify(result[0], null, 2));
      }
    } catch (e) {
      console.log('\n📋 app_1_hhh table: Not found or empty');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseRecords();

