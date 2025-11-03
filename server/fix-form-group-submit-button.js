const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fixFormGroupSubmitButton() {
  try {
    console.log("🔧 Starting form group submit button fix...");

    // Get the canvas for app 2
    const canvas = await prisma.canvas.findUnique({
      where: { appId: 2 },
    });

    if (!canvas) {
      console.error("❌ Canvas not found for app 2");
      return;
    }

    console.log("📄 Canvas found, parsing canvasState...");

    // Parse canvas state
    let canvasState = canvas.canvasState;
    if (typeof canvasState === "string") {
      canvasState = JSON.parse(canvasState);
    }

    // Get the first page
    const firstPage = canvasState.pages?.[0];
    if (!firstPage) {
      console.error("❌ No pages found in canvas state");
      return;
    }

    console.log("📄 Working with page:", firstPage.name);
    console.log(
      "🔧 Current elements:",
      firstPage.elements.map((el) => `${el.id} (${el.type})`)
    );
    console.log(
      "🔧 Current groups:",
      firstPage.groups.map((g) => `${g.id} (${g.name})`)
    );

    // Find the form group
    const formGroup = firstPage.groups.find(
      (g) => g.id === "form-group-1760896469889"
    );
    if (!formGroup) {
      console.error("❌ Form group not found");
      return;
    }

    console.log("✅ Form group found:", formGroup.name);
    console.log("📋 Form group details:", {
      id: formGroup.id,
      name: formGroup.name,
      elementIds: formGroup.elementIds,
      properties: formGroup.properties,
    });

    // Find the button element
    const buttonElement = firstPage.elements.find(
      (el) => el.id === "button-1760896425078" && el.type === "button"
    );
    if (!buttonElement) {
      console.error("❌ Button element not found");
      return;
    }

    console.log("✅ Button element found:", buttonElement.id);

    // Update the form group to include submitButtonId
    if (!formGroup.properties) {
      formGroup.properties = {};
    }

    formGroup.properties.submitButtonId = buttonElement.id;

    console.log("✅ Updated form group properties:", formGroup.properties);

    // Update the canvas state in the database
    const updatedCanvasState = JSON.stringify(canvasState);

    await prisma.canvas.update({
      where: { appId: 2 },
      data: { canvasState: updatedCanvasState },
    });

    console.log("💾 Canvas state updated successfully");

    // Verify the update
    const verifyCanvas = await prisma.canvas.findUnique({
      where: { appId: 2 },
    });

    let verifyState = verifyCanvas.canvasState;
    if (typeof verifyState === "string") {
      verifyState = JSON.parse(verifyState);
    }

    const verifyGroup = verifyState.pages[0].groups.find(
      (g) => g.id === "form-group-1760896469889"
    );

    console.log("✅ Verification - Updated form group:", {
      id: verifyGroup.id,
      name: verifyGroup.name,
      submitButtonId: verifyGroup.properties?.submitButtonId,
    });

    console.log("🎉 Form group fix completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFormGroupSubmitButton();

