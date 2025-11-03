const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== Checking Test Data ===\n');

    // Check apps
    const apps = await prisma.app.findMany();
    console.log('📱 Apps:', apps.length > 0 ? apps : 'NONE FOUND');

    if (apps.length > 0) {
      const app = apps[0];
      console.log('\n✅ App found:', { id: app.id, name: app.name });

      // Check canvas
      const canvas = await prisma.canvas.findFirst({ where: { appId: app.id } });
      console.log('\n📐 Canvas:', canvas ? 'FOUND' : 'NOT FOUND');

      if (canvas) {
        console.log('   Canvas ID:', canvas.id);
        const canvasState = JSON.parse(canvas.canvasState || '{}');
        console.log('   Pages:', canvasState.pages?.length || 0);
        console.log('   Elements:', canvasState.elements?.length || 0);
        console.log('   Groups:', canvasState.pages?.[0]?.groups?.length || 0);
      }

      // Check workflows
      const workflows = await prisma.workflow.findMany({ where: { appId: app.id } });
      console.log('\n⚙️  Workflows:', workflows.length > 0 ? workflows.length : 'NONE FOUND');

      if (workflows.length > 0) {
        workflows.forEach((wf, i) => {
          console.log(`   Workflow ${i + 1}:`, { id: wf.id, name: wf.name });
        });
      }
    }

    console.log('\n=== End Check ===');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();

