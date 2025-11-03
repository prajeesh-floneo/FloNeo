const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const testDatabase = async () => {
  try {
    console.log('🗄️ Testing Database Connection...');
    
    await prisma.$connect();
    console.log('✅ Database connection - OK');
    
    const appCount = await prisma.app.count();
    console.log('✅ Apps in database: ' + appCount);
    
    const userCount = await prisma.user.count();
    console.log('✅ Users in database: ' + userCount);
    
    await prisma.$disconnect();
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    process.exit(0);
  }
};

testDatabase();
