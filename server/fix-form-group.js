// Script to fix the missing form group in the canvas
// This will create the form group that the workflow expects

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFormGroup() {
  try {
    console.log('🔧 Starting form group fix...');
    
    // Get the canvas data for app 5
    const app = await prisma.app.findUnique({
      where: { id: 5 },
      include: { canvasState: true }
    });
    
    if (!app || !app.canvasState) {
      console.error('❌ App 5 or canvas state not found');
      return;
    }
    
    console.log('📄 Found canvas state for app 5');
    
    // Parse the canvas state
    const canvasState = JSON.parse(app.canvasState.state);
    console.log('📊 Canvas state parsed, pages:', canvasState.pages.length);
    
    // Find the first page
    const firstPage = canvasState.pages[0];
    if (!firstPage) {
      console.error('❌ No pages found in canvas state');
      return;
    }
    
    console.log('📄 Working with page:', firstPage.name);
    console.log('🔧 Current elements:', firstPage.elements.map(el => `${el.id} (${el.type})`));
    
    // Check if form group already exists
    if (!firstPage.groups) {
      firstPage.groups = [];
    }
    
    const existingFormGroup = firstPage.groups.find(g => g.id === 'form-group-1760870767077');
    if (existingFormGroup) {
      console.log('✅ Form group already exists:', existingFormGroup.name);
      return;
    }
    
    // Find form elements and submit button
    const formElements = firstPage.elements.filter(el => 
      ['textfield', 'textarea', 'TEXT_FIELD', 'TEXT_AREA'].includes(el.type)
    );
    
    const submitButton = firstPage.elements.find(el => 
      el.id === 'button-1760870784916' && 
      ['button', 'BUTTON'].includes(el.type)
    );
    
    console.log('📝 Found form elements:', formElements.map(el => el.id));
    console.log('🔘 Found submit button:', submitButton?.id);
    
    if (formElements.length === 0) {
      console.error('❌ No form elements found');
      return;
    }
    
    if (!submitButton) {
      console.error('❌ Submit button not found');
      return;
    }
    
    // Create the form group
    const formGroup = {
      id: 'form-group-1760870767077',
      name: 's_form',
      elementIds: formElements.map(el => el.id),
      collapsed: false,
      type: 'form',
      properties: {
        submitButtonId: submitButton.id,
        formName: 's_form'
      }
    };
    
    // Add the form group to the page
    firstPage.groups.push(formGroup);
    
    console.log('✅ Created form group:', {
      id: formGroup.id,
      name: formGroup.name,
      elementIds: formGroup.elementIds,
      submitButtonId: formGroup.properties.submitButtonId
    });
    
    // Update the canvas state in the database
    const updatedCanvasState = JSON.stringify(canvasState);
    
    await prisma.canvasState.update({
      where: { appId: 5 },
      data: { state: updatedCanvasState }
    });
    
    console.log('💾 Canvas state updated successfully');
    console.log('🎉 Form group fix completed!');
    
    // Verify the update
    const verifyApp = await prisma.app.findUnique({
      where: { id: 5 },
      include: { canvasState: true }
    });
    
    const verifyCanvasState = JSON.parse(verifyApp.canvasState.state);
    const verifyFormGroup = verifyCanvasState.pages[0].groups?.find(g => g.id === 'form-group-1760870767077');
    
    if (verifyFormGroup) {
      console.log('✅ Verification successful - form group exists in database');
    } else {
      console.error('❌ Verification failed - form group not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error fixing form group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFormGroup();
