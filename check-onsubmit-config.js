const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: 1 },
    });

    if (!workflow) {
      console.log("Workflow not found");
      return;
    }

    console.log("Workflow Config:");
    console.log(JSON.stringify(workflow, null, 2));

    // Also check canvas for form groups
    const canvas = await prisma.canvas.findUnique({
      where: { id: 1 },
    });

    if (canvas && canvas.canvasState) {
      const state = JSON.parse(canvas.canvasState);
      console.log("\n\nForm Groups in Canvas:");
      state.pages[0].groups.forEach((group) => {
        console.log(`- ${group.id}: ${group.name}`);
        console.log(`  Elements: ${group.elementIds.join(", ")}`);
        console.log(`  submitButtonId: ${group.submitButtonId || "NOT SET"}`);
      });
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
