const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllRecords() {
  try {
    console.log('=== All Records in app_1_hhh ===\n');

    const result = await prisma.$queryRaw`
      SELECT * FROM "app_1_hhh" ORDER BY id DESC
    `;
    
    console.log(`Total records: ${result.length}\n`);
    
    result.forEach((record, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Textfield: ${record.textfield_1761029220917}`);
      console.log(`  Textarea: ${record.textarea_1761029246152}`);
      console.log(`  Created: ${record.created_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllRecords();

