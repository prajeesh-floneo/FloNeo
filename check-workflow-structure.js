const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkWorkflowStructure() {
  try {
    console.log("=== Checking Workflow Structure ===\n");

    const workflow = await prisma.workflow.findFirst({ where: { appId: 1 } });

    if (!workflow) {
      console.log("❌ No workflow found");
      return;
    }

    console.log("Workflow ID:", workflow.id);
    console.log("Workflow Name:", workflow.name);

    // Parse nodes
    let nodes = [];
    try {
      // Check if nodes is already an object or a string
      if (typeof workflow.nodes === "string") {
        nodes = JSON.parse(workflow.nodes);
      } else if (Array.isArray(workflow.nodes)) {
        nodes = workflow.nodes;
      } else {
        console.log("Nodes type:", typeof workflow.nodes);
        console.log("Nodes value:", workflow.nodes);
        return;
      }
    } catch (e) {
      console.log("Error parsing nodes:", e.message);
      console.log("Nodes type:", typeof workflow.nodes);
      return;
    }

    console.log("\n📊 Nodes:", nodes.length);
    nodes.forEach((node, i) => {
      console.log(`\n${i + 1}. ${node.data?.label || "Unknown"}`);
      console.log(`   ID: ${node.id}`);
      console.log(`   Category: ${node.data?.category}`);
      console.log(`   Position: x=${node.position?.x}, y=${node.position?.y}`);
    });

    // Parse edges
    let edges = [];
    try {
      if (typeof workflow.edges === "string") {
        edges = JSON.parse(workflow.edges);
      } else if (Array.isArray(workflow.edges)) {
        edges = workflow.edges;
      } else {
        edges = [];
      }
    } catch (e) {
      console.log("Error parsing edges:", e.message);
      edges = [];
    }

    console.log("\n\n🔗 Edges (Connectors):", edges.length);
    edges.forEach((edge, i) => {
      console.log(`\n${i + 1}. ${edge.source} → ${edge.target}`);
      console.log(`   Label: ${edge.label || "none"}`);
      console.log(`   Type: ${edge.type || "default"}`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkflowStructure();
