const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSubmitButtonLink() {
  try {
    console.log('🔧 Starting form group submit button fix...\n');

    const canvas = await prisma.canvas.findFirst({ where: { appId: 1 } });
    
    if (!canvas) {
      console.log('❌ Canvas not found for app 1');
      return;
    }

    const canvasState = JSON.parse(canvas.canvasState || '{}');
    
    if (!canvasState.pages || canvasState.pages.length === 0) {
      console.log('❌ No pages found in canvas');
      return;
    }

    const page = canvasState.pages[0];
    
    if (!page.groups || page.groups.length === 0) {
      console.log('❌ No groups found in page');
      return;
    }

    // Find the button element
    const buttonElement = page.elements?.find(elem => elem.type === 'button');
    if (!buttonElement) {
      console.log('❌ No button element found');
      return;
    }

    console.log('✅ Found button:', buttonElement.id);

    // Update all form groups to have the submitButtonId
    page.groups.forEach(group => {
      if (group.type === 'form') {
        group.properties = group.properties || {};
        group.properties.submitButtonId = buttonElement.id;
        console.log(`✅ Updated group ${group.id} with submitButtonId: ${buttonElement.id}`);
      }
    });

    // Save the updated canvas state
    await prisma.canvas.update({
      where: { id: canvas.id },
      data: {
        canvasState: JSON.stringify(canvasState),
      },
    });

    console.log('\n✅ Canvas state updated successfully!');
    console.log('   Form group now has submitButtonId linking to button');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixSubmitButtonLink();

