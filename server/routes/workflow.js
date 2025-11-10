const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Middleware to authenticate requests
const { authenticateToken } = require("../middleware/auth");

/**
 * @route   POST /api/workflow/save
 * @desc    Save workflow for an app/page
 * @access  Private
 */
router.post("/save", authenticateToken, async (req, res) => {
  try {
    const { appId, pageId, elementId, name, nodes, edges, metadata } = req.body;
    const userId = req.user.id;

    console.log("💾 Saving workflow:", {
      appId,
      pageId,
      elementId,
      nodesCount: nodes?.length,
      edgesCount: edges?.length,
    });

    // Validate required fields
    if (!appId) {
      return res.status(400).json({
        success: false,
        message: "appId is required",
      });
    }

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        message: "nodes array is required",
      });
    }

    if (!edges || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        message: "edges array is required",
      });
    }

    // Verify app exists and user has access
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId,
      },
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found or access denied",
      });
    }

    // FIXED: Validate that either elementId or pageId is provided
    if (!elementId && !pageId) {
      console.error(
        "❌ Workflow save error: Neither elementId nor pageId provided"
      );
      return res.status(400).json({
        success: false,
        message: "Either elementId or pageId is required to create a workflow",
      });
    }

    // Check if workflow already exists for this element/page
    let workflow;
    if (elementId) {
      workflow = await prisma.workflow.findFirst({
        where: {
          appId: parseInt(appId),
          elementId: elementId,
        },
      });
    } else if (pageId) {
      workflow = await prisma.workflow.findFirst({
        where: {
          appId: parseInt(appId),
          pageId: pageId,
          elementId: null,
        },
      });
    }

    const workflowData = {
      name: name || `Workflow ${elementId || pageId || "default"}`,
      appId: parseInt(appId),
      pageId: pageId || null,
      elementId: elementId || null, // Can be null if pageId is provided
      nodes: nodes,
      edges: edges,
      metadata: metadata || {},
      updatedAt: new Date(),
    };

    if (workflow) {
      // Update existing workflow
      workflow = await prisma.workflow.update({
        where: { id: workflow.id },
        data: workflowData,
      });
      console.log("✅ Workflow updated:", workflow.id);
    } else {
      // Create new workflow
      workflow = await prisma.workflow.create({
        data: workflowData,
      });
      console.log("✅ Workflow created:", workflow.id);
    }

    res.json({
      success: true,
      message: "Workflow saved successfully",
      data: {
        id: workflow.id,
        appId: workflow.appId,
        pageId: workflow.pageId,
        elementId: workflow.elementId,
        nodesCount: nodes.length,
        edgesCount: edges.length,
      },
    });
  } catch (error) {
    console.error("❌ Error saving workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save workflow",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/workflow/:appId
 * @desc    Get all workflows for an app
 * @access  Private
 */
router.get("/:appId", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

    console.log("📖 Fetching workflows for app:", appId);

    // Verify app exists and user has access
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId,
      },
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found or access denied",
      });
    }

    // Get all workflows for this app
    const workflows = await prisma.workflow.findMany({
      where: {
        appId: parseInt(appId),
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    console.log(`✅ Found ${workflows.length} workflows for app ${appId}`);

    res.json({
      success: true,
      message: "Workflows retrieved successfully",
      data: workflows,
    });
  } catch (error) {
    console.error("❌ Error fetching workflows:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch workflows",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/workflow/:appId/element/:elementId
 * @desc    Get workflow for a specific element
 * @access  Private
 */
router.get(
  "/:appId/element/:elementId",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, elementId } = req.params;
      const userId = req.user.id;

      console.log("📖 Fetching workflow for element:", { appId, elementId });

      // Verify app exists and user has access
      const app = await prisma.app.findFirst({
        where: {
          id: parseInt(appId),
          ownerId: userId,
        },
      });

      if (!app) {
        return res.status(404).json({
          success: false,
          message: "App not found or access denied",
        });
      }

      // Get workflow for this element
      const workflow = await prisma.workflow.findFirst({
        where: {
          appId: parseInt(appId),
          elementId: elementId,
        },
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: "Workflow not found for this element",
        });
      }

      console.log("✅ Found workflow:", workflow.id);

      res.json({
        success: true,
        message: "Workflow retrieved successfully",
        data: workflow,
      });
    } catch (error) {
      console.error("❌ Error fetching workflow:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch workflow",
        error: error.message,
      });
    }
  }
);

/**
 * @route   DELETE /api/workflow/:workflowId
 * @desc    Delete a workflow
 * @access  Private
 */
router.delete("/:workflowId", authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    console.log("🗑️  Deleting workflow:", workflowId);

    // Get workflow and verify ownership
    const workflow = await prisma.workflow.findUnique({
      where: { id: parseInt(workflowId) },
      include: { app: true },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found",
      });
    }

    if (workflow.app.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Delete workflow
    await prisma.workflow.delete({
      where: { id: parseInt(workflowId) },
    });

    console.log("✅ Workflow deleted:", workflowId);

    res.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete workflow",
      error: error.message,
    });
  }
});

module.exports = router;
