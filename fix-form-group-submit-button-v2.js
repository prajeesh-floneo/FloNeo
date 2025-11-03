const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixFormGroupSubmitButton() {
  try {
    console.log('🔧 Starting form group submit button fix...');

    // Get the canvas for app 1
    const canvas = await prisma.canvas.findFirst({
      where: { appId: 1 }
    });

    if (!canvas) {
      console.error('❌ Canvas not found for app 1');
      process.exit(1);
    }

    console.log('✅ Found canvas:', canvas.id);

    // Parse the canvas state
    let canvasState = canvas.canvasState;
    if (typeof canvasState === 'string') {
      canvasState = JSON.parse(canvasState);
    }

    console.log('📋 Canvas state pages:', canvasState.pages?.length || 0);

    // Find the form group and update it
    let updated = false;
    canvasState.pages?.forEach((page) => {
      page.groups?.forEach((group) => {
        if (group.id === 'form-group-1760930210555') {
          console.log('🎯 Found form group:', group.id);
          console.log('   Current properties:', group.properties);
          
          // Add submitButtonId to the form group
          if (!group.properties) {
            group.properties = {};
          }
          group.properties.submitButtonId = 'button-1760930204151';
          
          console.log('✅ Updated form group properties:', group.properties);
          updated = true;
        }
      });
    });

    if (!updated) {
      console.warn('⚠️  Form group not found, but continuing...');
    }

    // Update the canvas in the database
    await prisma.canvas.update({
      where: { id: canvas.id },
      data: {
        canvasState: JSON.stringify(canvasState)
      }
    });

    console.log('✅ Canvas updated successfully');
    console.log('🎉 Fix completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixFormGroupSubmitButton();

