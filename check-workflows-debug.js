const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkWorkflows() {
  try {
    console.log("=== Checking Workflows in Database ===\n");

    // Get all workflows
    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        name: true,
        appId: true,
        elementId: true,
        pageId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`Total workflows found: ${workflows.length}\n`);

    if (workflows.length === 0) {
      console.log("❌ No workflows found in database!");
      return;
    }

    workflows.forEach((wf, index) => {
      console.log(`Workflow ${index + 1}:`);
      console.log(`  ID: ${wf.id}`);
      console.log(`  Name: ${wf.name}`);
      console.log(`  App ID: ${wf.appId}`);
      console.log(`  Element ID: ${wf.elementId || "NULL"}`);
      console.log(`  Page ID: ${wf.pageId || "NULL"}`);
      console.log(`  Created: ${wf.createdAt}`);
      console.log(`  Updated: ${wf.updatedAt}`);
      console.log("");
    });

    // Check for workflows with nodes/edges
    console.log("\n=== Checking Workflow Content ===\n");
    const workflowsWithContent = await prisma.workflow.findMany({
      select: {
        id: true,
        name: true,
        appId: true,
        elementId: true,
        nodes: true,
        edges: true,
      },
    });

    workflowsWithContent.forEach((wf, index) => {
      const nodesCount = Array.isArray(wf.nodes) ? wf.nodes.length : 0;
      const edgesCount = Array.isArray(wf.edges) ? wf.edges.length : 0;
      console.log(`Workflow ${wf.id} (${wf.name}):`);
      console.log(`  Nodes: ${nodesCount}`);
      console.log(`  Edges: ${edgesCount}`);
      console.log(`  Element ID: ${wf.elementId || "NULL"}`);
      console.log("");
    });

    // Check apps
    console.log("\n=== Checking Apps ===\n");
    const apps = await prisma.app.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

    console.log(`Total apps: ${apps.length}`);
    apps.forEach((app) => {
      console.log(`  App ${app.id}: ${app.name} (Owner: ${app.ownerId})`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkflows();

