const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCanvasDetail() {
  try {
    console.log('=== Checking Canvas Detail ===\n');

    const canvas = await prisma.canvas.findFirst({ where: { appId: 1 } });
    
    if (canvas) {
      const canvasState = JSON.parse(canvas.canvasState || '{}');
      
      console.log('📐 Canvas State:');
      console.log('   Pages:', canvasState.pages?.length || 0);
      
      if (canvasState.pages && canvasState.pages.length > 0) {
        const page = canvasState.pages[0];
        console.log('\n📄 Page 1:');
        console.log('   Elements:', page.elements?.length || 0);
        console.log('   Groups:', page.groups?.length || 0);
        
        // Show elements
        if (page.elements) {
          console.log('\n   Elements:');
          page.elements.forEach(elem => {
            console.log(`     - ${elem.id} (${elem.type})`);
          });
        }
        
        // Show groups with submitButtonId
        if (page.groups) {
          console.log('\n   Groups:');
          page.groups.forEach(group => {
            console.log(`     - ${group.id} (${group.name})`);
            console.log(`       submitButtonId: ${group.properties?.submitButtonId || 'NOT SET'}`);
            console.log(`       elementIds: ${group.elementIds?.join(', ') || 'NONE'}`);
          });
        }
      }
      
      // Check workflow
      console.log('\n⚙️  Workflow:');
      const workflow = await prisma.workflow.findFirst({ where: { appId: 1 } });
      if (workflow) {
        console.log('   ID:', workflow.id);
        console.log('   Name:', workflow.name);
        console.log('   Nodes:', workflow.nodes?.length || 0);
        
        if (workflow.nodes) {
          const nodes = JSON.parse(workflow.nodes);
          console.log('\n   Workflow Nodes:');
          nodes.forEach((node, i) => {
            console.log(`     ${i + 1}. ${node.data?.category || 'unknown'} - ${node.data?.blockType || node.id}`);
          });
        }
      }
    }

    console.log('\n=== End Check ===');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCanvasDetail();

