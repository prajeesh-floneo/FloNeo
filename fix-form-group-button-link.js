const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { id: 1 },
    });

    if (!canvas || !canvas.canvasState) {
      console.log("Canvas not found");
      return;
    }

    const state = JSON.parse(canvas.canvasState);
    
    // Find the form group that the workflow is using
    const formGroup = state.pages[0].groups.find(g => g.id === "form-group-1761033542306");
    
    if (!formGroup) {
      console.log("Form group not found");
      return;
    }

    console.log("Before fix:");
    console.log(`Form Group: ${formGroup.id}`);
    console.log(`submitButtonId: ${formGroup.submitButtonId || "NOT SET"}`);

    // Add the submitButtonId to link the button to the form group
    formGroup.submitButtonId = "button-1761029260312";

    console.log("\nAfter fix:");
    console.log(`submitButtonId: ${formGroup.submitButtonId}`);

    // Save the updated canvas state
    await prisma.canvas.update({
      where: { id: 1 },
      data: {
        canvasState: JSON.stringify(state),
      },
    });

    console.log("\n✅ Form group updated successfully!");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
})();

