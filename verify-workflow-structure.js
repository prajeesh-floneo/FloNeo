#!/usr/bin/env node

/**
 * Workflow Structure Verification Script
 * Checks if workflows in database have valid JSON nodes/edges and proper trigger node structure
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verifyWorkflows() {
  console.log("🔍 Starting workflow structure verification...\n");

  try {
    // Get all workflows
    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        appId: true,
        elementId: true,
        name: true,
        nodes: true,
        edges: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log(`📊 Found ${workflows.length} workflows\n`);

    if (workflows.length === 0) {
      console.log("⚠️ No workflows found in database");
      return;
    }

    let validCount = 0;
    let invalidCount = 0;
    let noTriggerCount = 0;

    workflows.forEach((workflow, index) => {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Workflow ${index + 1}/${workflows.length}`);
      console.log(`${"=".repeat(80)}`);
      console.log(`ID: ${workflow.id}`);
      console.log(`App ID: ${workflow.appId}`);
      console.log(`Element ID: ${workflow.elementId || "NULL"}`);
      console.log(`Name: ${workflow.name}`);
      console.log(`Created: ${workflow.createdAt}`);
      console.log(`Updated: ${workflow.updatedAt}`);

      // Check nodes
      let nodes = workflow.nodes;
      let nodesValid = true;

      if (!nodes) {
        console.log("❌ Nodes: NULL");
        nodesValid = false;
      } else if (typeof nodes === "string") {
        try {
          nodes = JSON.parse(nodes);
          console.log(`✅ Nodes: Valid JSON (${nodes.length} nodes)`);
        } catch (e) {
          console.log(`❌ Nodes: Invalid JSON - ${e.message}`);
          console.log(`   Raw value (first 100 chars): ${String(nodes).substring(0, 100)}`);
          nodesValid = false;
        }
      } else if (Array.isArray(nodes)) {
        console.log(`✅ Nodes: Array (${nodes.length} nodes)`);
      } else {
        console.log(`❌ Nodes: Invalid type - ${typeof nodes}`);
        nodesValid = false;
      }

      // Check edges
      let edges = workflow.edges;
      let edgesValid = true;

      if (!edges) {
        console.log("❌ Edges: NULL");
        edgesValid = false;
      } else if (typeof edges === "string") {
        try {
          edges = JSON.parse(edges);
          console.log(`✅ Edges: Valid JSON (${edges.length} edges)`);
        } catch (e) {
          console.log(`❌ Edges: Invalid JSON - ${e.message}`);
          edgesValid = false;
        }
      } else if (Array.isArray(edges)) {
        console.log(`✅ Edges: Array (${edges.length} edges)`);
      } else {
        console.log(`❌ Edges: Invalid type - ${typeof edges}`);
        edgesValid = false;
      }

      // Check for trigger node
      let hasTrigger = false;
      if (Array.isArray(nodes) && nodes.length > 0) {
        const triggerNode = nodes.find(
          (n) =>
            n.data &&
            (n.data.category === "Triggers" ||
              n.data.isTrigger === true ||
              (n.data.label &&
                [
                  "onClick",
                  "onChange",
                  "onSubmit",
                  "onDrop",
                  "onHover",
                  "onFocus",
                ].includes(n.data.label)))
        );

        if (triggerNode) {
          console.log(
            `✅ Trigger Node: Found - ${triggerNode.data?.label || triggerNode.data?.category}`
          );
          hasTrigger = true;
        } else {
          console.log(`❌ Trigger Node: NOT FOUND`);
          console.log(
            `   Node types: ${nodes.map((n) => n.data?.label || n.data?.category || "unknown").join(", ")}`
          );
          noTriggerCount++;
        }
      }

      // Summary
      if (nodesValid && edgesValid && hasTrigger) {
        console.log("\n✅ STATUS: VALID - Workflow is ready for run app");
        validCount++;
      } else {
        console.log("\n❌ STATUS: INVALID - Workflow has issues");
        invalidCount++;
      }
    });

    // Final report
    console.log(`\n${"=".repeat(80)}`);
    console.log("📋 VERIFICATION SUMMARY");
    console.log(`${"=".repeat(80)}`);
    console.log(`Total Workflows: ${workflows.length}`);
    console.log(`✅ Valid: ${validCount}`);
    console.log(`❌ Invalid: ${invalidCount}`);
    console.log(`⚠️ Missing Trigger: ${noTriggerCount}`);
    console.log(`\nSuccess Rate: ${((validCount / workflows.length) * 100).toFixed(1)}%`);

    if (invalidCount > 0) {
      console.log(
        "\n⚠️ RECOMMENDATION: Fix invalid workflows or recreate them in the workflow builder"
      );
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyWorkflows();

