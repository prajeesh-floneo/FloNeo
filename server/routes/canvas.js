const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const crypto = require("crypto");

// UUID v4 generator function
const uuidv4 = () => {
  return crypto.randomUUID();
};

const router = express.Router();
const prisma = new PrismaClient();

console.log("🔧 Canvas routes loaded with debug logging enabled");

let io; // Socket.io instance

// Inject Socket.io instance
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// ===== WORKFLOW MANAGEMENT (MUST BE BEFORE GENERIC /:appId ROUTE) =====

// GET /api/canvas/workflows/:appId - Get all workflows for an app (or specific element)
// IMPORTANT: This route MUST be defined before the generic /:appId route to be matched correctly
router.get(
  "/workflows/:appId",
  (req, res, next) => {
    if (req.query.preview) {
      console.log("🎥 WORKFLOWS: Bypassing auth for preview mode");
      next(); // Bypass auth for preview
    } else {
      authenticateToken(req, res, next);
    }
  },
  async (req, res) => {
    try {
      console.log(
        "📖 DEBUG: Workflow get endpoint hit for appId:",
        req.params.appId
      );
      const { appId } = req.params;
      const { elementId, preview } = req.query; // Optional query parameters
      const userId = req.user?.id;
      const isPreview = preview === "true";

      console.log("📖 DEBUG: Query params:", {
        appId,
        elementId: elementId || "all",
        preview: isPreview,
      });

      // For preview mode, skip user verification
      if (isPreview) {
        console.log("🎥 WORKFLOWS: Preview mode - skipping user verification");
      }

      // Verify user owns the app (skip for preview)
      const app = await prisma.app.findFirst({
        where: {
          id: parseInt(appId),
          ...(isPreview ? {} : { ownerId: userId }),
        },
      });

      if (!app) {
        return res.status(404).json({
          success: false,
          message: "App not found or access denied",
        });
      }

      // Build where clause with optional elementId filter
      const whereClause = {
        appId: parseInt(appId),
      };

      if (elementId) {
        whereClause.elementId = elementId;
        console.log("📖 DEBUG: Filtering by elementId:", elementId);
      }

      // Get workflows for this app (optionally filtered by elementId)
      const workflows = await prisma.workflow.findMany({
        where: whereClause,
        orderBy: {
          updatedAt: "desc",
        },
      });

      console.log(
        "✅ DEBUG: Found",
        workflows.length,
        "workflow(s) for appId:",
        appId,
        "elementId:",
        elementId || "all"
      );

      if (workflows.length > 0) {
        console.log(
          "✅ DEBUG: Workflow elementIds:",
          workflows.map((w) => w.elementId).join(", ")
        );
      }

      // Parse nodes and edges if they're strings (JSON stored in database)
      const parsedWorkflows = workflows.map((workflow) => {
        let nodes = workflow.nodes;
        let edges = workflow.edges;

        // Parse nodes if they're strings
        if (typeof nodes === "string") {
          try {
            nodes = JSON.parse(nodes);
            console.log(
              "🔄 DEBUG: Parsed nodes from string for workflow",
              workflow.id
            );
          } catch (e) {
            console.error(
              "❌ DEBUG: Failed to parse nodes for workflow",
              workflow.id,
              ":",
              e.message
            );
            nodes = [];
          }
        }

        // Parse edges if they're strings
        if (typeof edges === "string") {
          try {
            edges = JSON.parse(edges);
            console.log(
              "🔄 DEBUG: Parsed edges from string for workflow",
              workflow.id
            );
          } catch (e) {
            console.error(
              "❌ DEBUG: Failed to parse edges for workflow",
              workflow.id,
              ":",
              e.message
            );
            edges = [];
          }
        }

        return {
          ...workflow,
          nodes: nodes || [],
          edges: edges || [],
        };
      });

      // If elementId was specified, return single workflow or null
      if (elementId) {
        const workflow = parsedWorkflows[0] || null;
        if (workflow) {
          console.log(
            "✅ DEBUG: Returning workflow for element:",
            elementId,
            "with",
            workflow.nodes?.length || 0,
            "nodes"
          );

          // Process nodes to handle dynamic URLs and pageId
          if (workflow.nodes && Array.isArray(workflow.nodes)) {
            const processedNodes = workflow.nodes.map((node) => {
              if (
                node.data &&
                node.data.category === "Actions" &&
                node.data.label === "page.redirect"
              ) {
                // Keep dynamic URL references as-is for frontend processing
                console.log(
                  "🔄 DEBUG: Found page.redirect node with URL:",
                  node.data.url,
                  "pageId:",
                  node.data.pageId
                );

                // Ensure pageId is set for multi-page redirects
                if (!node.data.pageId && !node.data.url) {
                  // Default to page 2 for demo purposes
                  node.data.pageId = 2;
                  console.log(
                    "🔄 DEBUG: Set default pageId to 2 for page.redirect node"
                  );
                }

                return node;
              }
              return node;
            });
            workflow.nodes = processedNodes;
          }
        } else {
          console.log("ℹ️  DEBUG: No workflow found for element:", elementId);
        }
        res.json({
          success: true,
          data: workflow,
        });
      } else {
        // Return all workflows
        res.json({
          success: true,
          data: parsedWorkflows,
        });
      }
    } catch (error) {
      console.error("❌ Workflow get error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve workflows",
        error: error.message,
      });
    }
  }
);

// ===== CANVAS MANAGEMENT =====

// GET /api/canvas/:appId - Get canvas for an app
router.get(
  "/:appId",
  (req, res, next) => {
    if (req.query.preview) {
      console.log("🎥 CANVAS: Bypassing auth for preview mode");
      next(); // Bypass auth for preview
    } else {
      authenticateToken(req, res, next);
    }
  },
  async (req, res) => {
    try {
      const { appId } = req.params;
      const isPreview = req.query.preview;

      // For preview mode, skip user verification
      if (isPreview) {
        console.log("🎥 CANVAS: Preview mode - skipping user verification");
      }

      const userId = req.user?.id;

      // Verify user owns the app (skip for preview)
      const app = await prisma.app.findFirst({
        where: {
          id: parseInt(appId),
          ...(isPreview ? {} : { ownerId: userId }),
        },
      });

      if (!app) {
        return res.status(404).json({
          success: false,
          message: "App not found or access denied",
        });
      }

      // Get or create canvas
      let canvas = await prisma.canvas.findUnique({
        where: { appId: parseInt(appId) },
        select: {
          id: true,
          appId: true,
          name: true,
          description: true,
          width: true,
          height: true,
          background: true,
          zoomLevel: true,
          canvasState: true, // Include the canvasState field
          elements: {
            include: {
              interactions: true,
              validations: true,
              children: true,
            },
            orderBy: { zIndex: "asc" },
          },
        },
      });

      if (!canvas) {
        // Create default canvas
        canvas = await prisma.canvas.create({
          data: {
            appId: parseInt(appId),
            name: `${app.name} Canvas`,
            description: "Drag-and-drop canvas interface",
          },
          select: {
            id: true,
            appId: true,
            name: true,
            description: true,
            width: true,
            height: true,
            background: true,
            zoomLevel: true,
            canvasState: true, // Include the canvasState field
            elements: {
              include: {
                interactions: true,
                validations: true,
                children: true,
              },
              orderBy: { zIndex: "asc" },
            },
          },
        });
      }

      console.log(
        "📄 DEBUG: Loaded Canvas for GET request:",
        JSON.stringify(canvas, null, 2)
      );
      console.log("🔍 DEBUG: Canvas has canvasState:", !!canvas.canvasState);

      res.json({
        success: true,
        data: canvas,
      });
    } catch (error) {
      console.error("Get canvas error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve canvas",
      });
    }
  }
);

// PUT /api/canvas/:appId - Update canvas properties
router.put("/:appId", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const {
      name,
      description,
      width,
      height,
      background,
      gridEnabled,
      snapEnabled,
      zoomLevel,
    } = req.body;

    // Verify user owns the app
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

    const canvas = await prisma.canvas.update({
      where: { appId: parseInt(appId) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(width && { width }),
        ...(height && { height }),
        ...(background && { background }),
        ...(gridEnabled !== undefined && { gridEnabled }),
        ...(snapEnabled !== undefined && { snapEnabled }),
        ...(zoomLevel && { zoomLevel }),
      },
      include: {
        elements: {
          include: {
            interactions: true,
            validations: true,
            children: true,
          },
          orderBy: { zIndex: "asc" },
        },
      },
    });

    // Record history
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: "canvas_update",
        newState: {
          name,
          description,
          width,
          height,
          background,
          gridEnabled,
          snapEnabled,
          zoomLevel,
        },
        userId,
      },
    });

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit("canvas:updated", {
        appId: parseInt(appId),
        canvas,
        updatedBy: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      data: canvas,
    });
  } catch (error) {
    console.error("Update canvas error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update canvas",
    });
  }
});

// ===== ELEMENT MANAGEMENT =====

// POST /api/canvas/:appId/elements - Create new element
router.post("/:appId/elements", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const {
      type,
      name,
      x = 0,
      y = 0,
      width = 100,
      height = 50,
      rotation = 0,
      zIndex = 0,
      groupId,
      parentId,
      properties = {},
      styles = {},
      constraints = {},
    } = req.body;

    // Verify user owns the app
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

    // Get canvas
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        message: "Canvas not found",
      });
    }

    // Generate unique element ID
    const elementId = uuidv4();

    // Create element
    const element = await prisma.canvasElement.create({
      data: {
        canvasId: canvas.id,
        elementId,
        type,
        name: name || `${type} Element`,
        x: parseFloat(x),
        y: parseFloat(y),
        width: parseFloat(width),
        height: parseFloat(height),
        rotation: parseFloat(rotation),
        zIndex: parseInt(zIndex),
        groupId,
        parentId: parentId ? parseInt(parentId) : null,
        properties,
        styles,
        constraints,
      },
      include: {
        interactions: true,
        validations: true,
        children: true,
      },
    });

    // Record history
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: "element_create",
        elementId,
        newState: element,
        userId,
      },
    });

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit("element:created", {
        appId: parseInt(appId),
        element,
        createdBy: userId,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      data: element,
    });
  } catch (error) {
    console.error("Create element error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create element",
    });
  }
});

// PUT /api/canvas/:appId/elements/:elementId - Update element
router.put(
  "/:appId/elements/:elementId",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, elementId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      // Verify user owns the app
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

      // Get current element state for history
      const currentElement = await prisma.canvasElement.findUnique({
        where: { elementId },
        include: {
          interactions: true,
          validations: true,
          children: true,
        },
      });

      if (!currentElement) {
        return res.status(404).json({
          success: false,
          message: "Element not found",
        });
      }

      // Update element
      const element = await prisma.canvasElement.update({
        where: { elementId },
        data: {
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.x !== undefined && { x: parseFloat(updateData.x) }),
          ...(updateData.y !== undefined && { y: parseFloat(updateData.y) }),
          ...(updateData.width !== undefined && {
            width: parseFloat(updateData.width),
          }),
          ...(updateData.height !== undefined && {
            height: parseFloat(updateData.height),
          }),
          ...(updateData.rotation !== undefined && {
            rotation: parseFloat(updateData.rotation),
          }),
          ...(updateData.zIndex !== undefined && {
            zIndex: parseInt(updateData.zIndex),
          }),
          ...(updateData.locked !== undefined && { locked: updateData.locked }),
          ...(updateData.visible !== undefined && {
            visible: updateData.visible,
          }),
          ...(updateData.groupId !== undefined && {
            groupId: updateData.groupId,
          }),
          ...(updateData.parentId !== undefined && {
            parentId: updateData.parentId
              ? parseInt(updateData.parentId)
              : null,
          }),
          ...(updateData.properties && { properties: updateData.properties }),
          ...(updateData.styles && { styles: updateData.styles }),
          ...(updateData.constraints && {
            constraints: updateData.constraints,
          }),
        },
        include: {
          interactions: true,
          validations: true,
          children: true,
        },
      });

      // Record history
      await prisma.canvasHistory.create({
        data: {
          canvasId: currentElement.canvasId,
          action: "element_update",
          elementId,
          oldState: currentElement,
          newState: element,
          userId,
        },
      });

      // Emit real-time update
      if (io) {
        io.to(`app:${appId}`).emit("element:updated", {
          appId: parseInt(appId),
          element,
          updatedBy: userId,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        data: element,
      });
    } catch (error) {
      console.error("Update element error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update element",
      });
    }
  }
);

// DELETE /api/canvas/:appId/elements/:elementId - Delete element
router.delete(
  "/:appId/elements/:elementId",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, elementId } = req.params;
      const userId = req.user.id;

      // Verify user owns the app
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

      // Get element for history
      const element = await prisma.canvasElement.findUnique({
        where: { elementId },
        include: {
          interactions: true,
          validations: true,
          children: true,
        },
      });

      if (!element) {
        return res.status(404).json({
          success: false,
          message: "Element not found",
        });
      }

      // Delete element (cascade will handle interactions and validations)
      await prisma.canvasElement.delete({
        where: { elementId },
      });

      // Record history
      await prisma.canvasHistory.create({
        data: {
          canvasId: element.canvasId,
          action: "element_delete",
          elementId,
          oldState: element,
          userId,
        },
      });

      // Emit real-time update
      if (io) {
        io.to(`app:${appId}`).emit("element:deleted", {
          appId: parseInt(appId),
          elementId,
          deletedBy: userId,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Element deleted successfully",
      });
    } catch (error) {
      console.error("Delete element error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete element",
      });
    }
  }
);

// PATCH /api/canvas/:appId/state - Save complete canvas state
router.patch("/:appId/state", authenticateToken, async (req, res) => {
  try {
    console.log(
      "🚀 DEBUG: Canvas state save endpoint hit for appId:",
      req.params.appId
    );
    console.log(
      "📦 DEBUG: Incoming canvasState:",
      JSON.stringify(req.body.canvasState, null, 2)
    );
    const { appId } = req.params;
    const userId = req.user.id;
    const { canvasState } = req.body;
    console.log(
      "📊 DEBUG: Received canvasState:",
      !!canvasState,
      "has pages:",
      !!canvasState?.pages,
      "pages count:",
      canvasState?.pages?.length || 0
    );

    // Verify user owns the app
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

    // Get or create canvas
    let canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
    });

    if (!canvas) {
      canvas = await prisma.canvas.create({
        data: {
          appId: parseInt(appId),
          name: canvasState.name || "Untitled Canvas",
          width: canvasState.width || 1200,
          height: canvasState.height || 800,
          background: canvasState.background || {
            color: "#ffffff",
            opacity: 100,
          },
        },
      });
    }

    // Clear existing elements for this canvas
    await prisma.canvasElement.deleteMany({
      where: { canvasId: canvas.id },
    });

    // Also delete any existing elements with the same elementIds globally to avoid unique constraint issues
    if (canvasState.elements && Array.isArray(canvasState.elements)) {
      const elementIds = canvasState.elements
        .map((el) => el.id)
        .filter(Boolean);
      if (elementIds.length > 0) {
        await prisma.canvasElement.deleteMany({
          where: {
            elementId: { in: elementIds },
          },
        });
      }
    }

    // Create new elements from canvas state
    const elementsToCreate = [];
    if (canvasState.elements && Array.isArray(canvasState.elements)) {
      for (const element of canvasState.elements) {
        // Generate a unique elementId if not provided or ensure uniqueness
        const elementId =
          element.id ||
          `${element.type}-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

        elementsToCreate.push({
          canvasId: canvas.id,
          elementId: elementId,
          type: element.type || "SHAPE",
          name: element.name || "Untitled Element",
          x: parseFloat(element.x) || 0,
          y: parseFloat(element.y) || 0,
          width: parseFloat(element.width) || 100,
          height: parseFloat(element.height) || 50,
          rotation: parseFloat(element.rotation) || 0,
          zIndex: parseInt(element.zIndex) || 0,
          locked: Boolean(element.properties?.locked) || false,
          visible: !Boolean(element.properties?.hidden),
          groupId: element.groupId || null,
          properties: element.properties || {},
          styles: {
            backgroundColor: element.properties?.backgroundColor,
            color: element.properties?.color,
            fontSize: element.properties?.fontSize,
            fontWeight: element.properties?.fontWeight,
            textAlign: element.properties?.textAlign,
            borderRadius: element.properties?.borderRadius,
            borderWidth: element.properties?.borderWidth,
            borderColor: element.properties?.borderColor,
            opacity: element.opacity,
          },
        });
      }
    }

    // Bulk create elements
    if (elementsToCreate.length > 0) {
      await prisma.canvasElement.createMany({
        data: elementsToCreate,
      });
    }

    // Store the full canvasState (including pages array) as JSON
    let canvasStateJson = null;
    try {
      canvasStateJson = JSON.stringify(canvasState);
      console.log(
        "📄 DEBUG: Storing full canvasState with pages:",
        canvasStateJson.substring(0, 200) + "..."
      );
      console.log("📊 DEBUG: canvasState has pages:", !!canvasState.pages);
      console.log("📊 DEBUG: pages count:", canvasState.pages?.length || 0);
    } catch (jsonError) {
      console.error("❌ Failed to stringify canvasState:", jsonError);
      // Continue without storing canvasState if JSON serialization fails
    }

    console.log(
      "🔧 DEBUG: About to update canvas with canvasState:",
      !!canvasStateJson
    );

    // Update canvas properties
    try {
      console.log("🔧 DEBUG: About to update canvas with data:", {
        name: canvasState.name || canvas.name,
        canvasStateLength: canvasStateJson?.length || 0,
        hasCanvasState: !!canvasStateJson,
      });

      const updateResult = await prisma.canvas.update({
        where: { id: canvas.id },
        data: {
          name: canvasState.name || canvas.name,
          width: canvasState.width || canvas.width,
          height: canvasState.height || canvas.height,
          background: canvasState.background || canvas.background,
          canvasState: canvasStateJson, // Store full pages array
          zoomLevel: canvasState.zoomLevel || canvas.zoomLevel,
        },
      });

      console.log("✅ DEBUG: Canvas updated successfully!");
      console.log(
        "📄 DEBUG: Updated Canvas:",
        JSON.stringify(updateResult, null, 2)
      );
    } catch (updateError) {
      console.error("❌ DEBUG: Prisma update error:", updateError.message);
      console.error("❌ DEBUG: Error code:", updateError.code);
      throw updateError;
    }

    // Sync Canvas pages to AppPage table
    if (canvasState.pages && Array.isArray(canvasState.pages)) {
      try {
        console.log("📄 Syncing canvas pages to AppPage table:", canvasState.pages.length);
        
        for (const page of canvasState.pages) {
          if (!page.id || !page.name) continue;
          
          // Use page ID as slug for consistency (e.g., "page-1" stays as "page-1")
          // This ensures workflow blocks can reference pages by their canvas ID
          const slug = page.id;
          
          // Check if AppPage already exists (by slug or by matching page ID)
          const existingPage = await prisma.appPage.findFirst({
            where: {
              appId: parseInt(appId),
              OR: [
                { slug: slug },
                { slug: page.id }, // Also check by page ID
              ],
            },
          });
          
          if (!existingPage) {
            // Create new AppPage
            await prisma.appPage.create({
              data: {
                appId: parseInt(appId),
                title: page.name,
                slug: slug,
                path: `/${slug}`,
              },
            });
            console.log(`✅ Created AppPage: ${page.name} (${slug})`);
          } else {
            // Update existing AppPage if slug or title changed
            if (existingPage.slug !== slug || existingPage.title !== page.name) {
              await prisma.appPage.update({
                where: { id: existingPage.id },
                data: { 
                  title: page.name,
                  slug: slug, // Update slug to match page ID
                },
              });
              console.log(`🔄 Updated AppPage: ${page.name} (${slug})`);
            }
          }
        }
        
        console.log("✅ Canvas pages synced to AppPage table");
      } catch (syncError) {
        console.error("⚠️ Error syncing pages to AppPage table:", syncError);
        // Don't fail the entire save if page sync fails
      }
    }

    // Record history
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: "canvas_state_save",
        newState: canvasState,
        userId,
      },
    });

    // Emit real-time update
    if (io) {
      io.to(`canvas-${appId}`).emit("canvasStateSaved", {
        appId: parseInt(appId),
        canvasState,
        userId,
      });
    }

    res.json({
      success: true,
      message: "Canvas state saved successfully",
      data: {
        canvasId: canvas.id,
        elementsCount: elementsToCreate.length,
      },
    });
  } catch (error) {
    console.error("❌ Canvas state save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save canvas state",
      error: error.message,
    });
  }
});

// POST /api/canvas/:appId/elements/:elementId/duplicate - Duplicate element
router.post(
  "/:appId/elements/:elementId/duplicate",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, elementId } = req.params;
      const userId = req.user.id;
      const { offsetX = 20, offsetY = 20 } = req.body;

      // Verify user owns the app
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

      // Get original element
      const originalElement = await prisma.canvasElement.findUnique({
        where: { elementId },
        include: {
          interactions: true,
          validations: true,
        },
      });

      if (!originalElement) {
        return res.status(404).json({
          success: false,
          message: "Element not found",
        });
      }

      // Generate new element ID
      const newElementId = uuidv4();

      // Create duplicate element
      const duplicateElement = await prisma.canvasElement.create({
        data: {
          canvasId: originalElement.canvasId,
          elementId: newElementId,
          type: originalElement.type,
          name: `${originalElement.name} Copy`,
          x: originalElement.x + offsetX,
          y: originalElement.y + offsetY,
          width: originalElement.width,
          height: originalElement.height,
          rotation: originalElement.rotation,
          zIndex: originalElement.zIndex + 1,
          locked: originalElement.locked,
          visible: originalElement.visible,
          groupId: originalElement.groupId,
          parentId: originalElement.parentId,
          properties: originalElement.properties,
          styles: originalElement.styles,
          constraints: originalElement.constraints,
        },
        include: {
          interactions: true,
          validations: true,
          children: true,
        },
      });

      // Duplicate interactions
      for (const interaction of originalElement.interactions) {
        await prisma.elementInteraction.create({
          data: {
            elementId: duplicateElement.id,
            event: interaction.event,
            action: interaction.action,
          },
        });
      }

      // Duplicate validations
      for (const validation of originalElement.validations) {
        await prisma.elementValidation.create({
          data: {
            elementId: duplicateElement.id,
            rule: validation.rule,
            value: validation.value,
            message: validation.message,
          },
        });
      }

      // Record history
      await prisma.canvasHistory.create({
        data: {
          canvasId: originalElement.canvasId,
          action: "element_duplicate",
          elementId: newElementId,
          newState: duplicateElement,
          userId,
        },
      });

      // Emit real-time update
      if (io) {
        io.to(`app:${appId}`).emit("element:duplicated", {
          appId: parseInt(appId),
          originalElementId: elementId,
          duplicateElement,
          duplicatedBy: userId,
          timestamp: new Date(),
        });
      }

      res.status(201).json({
        success: true,
        data: duplicateElement,
      });
    } catch (error) {
      console.error("Duplicate element error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate element",
      });
    }
  }
);

// ===== WORKFLOW MANAGEMENT =====

// PATCH /api/workflows/:appId - Save workflow JSON
router.patch("/workflows/:appId", authenticateToken, async (req, res) => {
  try {
    console.log(
      "💾 DEBUG: Workflow save endpoint hit for appId:",
      req.params.appId
    );
    const { appId } = req.params;
    const userId = req.user.id;
    const { elementId, nodes, edges, metadata } = req.body;

    console.log("📦 DEBUG: Workflow data:", {
      appId,
      elementId,
      nodesCount: nodes?.length,
      edgesCount: edges?.length,
    });
    console.log("📦 DEBUG: Element ID:", elementId);
    console.log("📦 DEBUG: App ID:", appId);

    // Validate required fields
    if (!elementId) {
      console.error("❌ DEBUG: elementId is missing");
      return res.status(400).json({
        success: false,
        message: "elementId is required",
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

    // Verify user owns the app
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

    // VALIDATION: Check if workflow has at least one node
    if (!nodes || nodes.length === 0) {
      console.warn("⚠️ WARNING: Workflow saved with no nodes");
      // Still allow saving empty workflows, but log warning
    }

    // VALIDATION: Check if workflow has a trigger node
    const hasTriggerNode = nodes.some(
      (node) =>
        node.data &&
        (node.data.category === "Triggers" ||
          node.data.isTrigger === true ||
          (node.data.label &&
            [
              "onClick",
              "onChange",
              "onSubmit",
              "onDrop",
              "onHover",
              "onFocus",
            ].includes(node.data.label)))
    );

    if (!hasTriggerNode && nodes.length > 0) {
      console.warn(
        "⚠️ WARNING: Workflow saved without trigger node. It may not be triggered in run app."
      );
      console.warn(
        "Node types in workflow:",
        nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
          category: n.data?.category,
        }))
      );
    }

    // Upsert workflow (create if not exists, update if exists)
    console.log(
      "🔍 DEBUG: Looking for existing workflow with appId:",
      parseInt(appId),
      "elementId:",
      elementId
    );

    const workflow = await prisma.workflow.upsert({
      where: {
        appId_elementId: {
          appId: parseInt(appId),
          elementId: elementId,
        },
      },
      update: {
        nodes: nodes,
        edges: edges,
        metadata: metadata || {},
        updatedAt: new Date(),
      },
      create: {
        appId: parseInt(appId),
        elementId: elementId,
        name: `Workflow for ${elementId}`,
        nodes: nodes,
        edges: edges,
        metadata: metadata || {},
      },
    });

    console.log(
      "🔍 DEBUG: Workflow upserted:",
      workflow.id ? `ID ${workflow.id}` : "Unknown"
    );

    console.log(
      "✅ DEBUG: Workflow saved successfully - ID:",
      workflow.id,
      "elementId:",
      workflow.elementId,
      "appId:",
      workflow.appId
    );

    // Record history
    await prisma.canvasHistory
      .create({
        data: {
          canvasId:
            (
              await prisma.canvas.findUnique({
                where: { appId: parseInt(appId) },
              })
            )?.id || 0,
          action: "workflow_save",
          elementId: elementId,
          newState: { nodes, edges, metadata },
          userId,
        },
      })
      .catch((err) => console.warn("History save failed:", err.message));

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit("workflow:saved", {
        appId: parseInt(appId),
        elementId,
        workflow,
        savedBy: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: "Workflow saved successfully",
      data: workflow,
    });
  } catch (error) {
    console.error("❌ Workflow save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save workflow",
      error: error.message,
    });
  }
});

// ===== DATA DISCOVERY FOR BINDING =====

/**
 * @route   GET /api/canvas/:appId/elements/:elementId/available-data
 * @desc    Discover available data sources for an element's binding
 * @access  Private
 */
router.get(
  "/:appId/elements/:elementId/available-data",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, elementId } = req.params;
      const userId = req.user.id;

      console.log("🔍 [DATA-DISCOVERY] Fetching available data for element:", {
        appId,
        elementId,
      });

      // Verify app access
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

      // Get all workflows for this element
      const workflows = await prisma.workflow.findMany({
        where: {
          appId: parseInt(appId),
          elementId: elementId,
        },
      });

      console.log(
        `🔍 [DATA-DISCOVERY] Found ${workflows.length} workflow(s) for element`
      );

      const dataSources = [];

      // Analyze each workflow to extract data sources
      for (const workflow of workflows) {
        const nodes = workflow.nodes || [];

        for (const node of nodes) {
          const label = node.data?.label;
          const category = node.data?.category;

          // db.find block
          if (label === "db.find" && category === "Actions") {
            const tableName = node.data?.tableName;
            if (tableName) {
              // Get table schema from database
              const fullTableName = tableName.startsWith("app_")
                ? tableName
                : `app_${parseInt(appId)}_${tableName}`;

              try {
                // Get table columns from information_schema
                const columns = await prisma.$queryRawUnsafe(`
                  SELECT column_name, data_type
                  FROM information_schema.columns
                  WHERE table_name = '${fullTableName}'
                  AND column_name NOT IN ('app_id', 'created_at', 'updated_at')
                  ORDER BY ordinal_position
                `);

                // Get sample data
                const sampleData = await prisma.$queryRawUnsafe(
                  `SELECT * FROM "${fullTableName}" LIMIT 1`
                );

                const fields = columns.map((col) => {
                  const sample =
                    sampleData.length > 0
                      ? sampleData[0][col.column_name]
                      : null;
                  return {
                    name: col.column_name,
                    type: mapPostgresType(col.data_type),
                    sample: sample,
                  };
                });

                dataSources.push({
                  name: "dbFindResult",
                  type: "array",
                  from: `db.find block (table: ${tableName})`,
                  workflowName: workflow.name,
                  fields: fields,
                  isArray: true,
                  arrayItemType: "object",
                });
              } catch (error) {
                console.warn(
                  `⚠️ [DATA-DISCOVERY] Could not fetch schema for table ${fullTableName}:`,
                  error.message
                );
              }
            }
          }

          // db.create block
          if (label === "db.create" && category === "Actions") {
            dataSources.push({
              name: "dbCreateResult",
              type: "object",
              from: "db.create block",
              workflowName: workflow.name,
              fields: [
                { name: "tableName", type: "string", sample: null },
                { name: "recordId", type: "number", sample: null },
                { name: "tableCreated", type: "boolean", sample: null },
                { name: "executionTime", type: "number", sample: null },
              ],
              isArray: false,
            });
          }

          // db.update block
          if (label === "db.update" && category === "Actions") {
            dataSources.push({
              name: "dbUpdateResult",
              type: "object",
              from: "db.update block",
              workflowName: workflow.name,
              fields: [
                { name: "tableName", type: "string", sample: null },
                { name: "updatedCount", type: "number", sample: null },
                { name: "updatedRecords", type: "array", sample: null },
                { name: "executionTime", type: "number", sample: null },
              ],
              isArray: false,
            });
          }

          // http.request block
          if (label === "http.request" && category === "Actions") {
            const saveResponseTo = node.data?.saveResponseTo || "httpResponse";
            dataSources.push({
              name: saveResponseTo,
              type: "object",
              from: "http.request block",
              workflowName: workflow.name,
              fields: [
                { name: "status", type: "number", sample: 200 },
                { name: "data", type: "any", sample: null },
                { name: "headers", type: "object", sample: null },
              ],
              isArray: false,
            });
          }

          // onSubmit trigger
          if (label === "onSubmit" && category === "Triggers") {
            dataSources.push({
              name: "formData",
              type: "object",
              from: "onSubmit trigger",
              workflowName: workflow.name,
              fields: [
                {
                  name: "(dynamic form fields)",
                  type: "string",
                  sample: "Form field values",
                },
              ],
              isArray: false,
            });
          }
        }
      }

      // Add common data sources that are always available
      dataSources.push({
        name: "urlParams",
        type: "object",
        from: "URL parameters",
        workflowName: "Built-in",
        fields: [
          {
            name: "(dynamic URL params)",
            type: "string",
            sample: "URL parameter values",
          },
        ],
        isArray: false,
      });

      console.log(
        `✅ [DATA-DISCOVERY] Found ${dataSources.length} data source(s)`
      );

      res.json({
        success: true,
        dataSources: dataSources,
        elementId: elementId,
        workflowsAnalyzed: workflows.length,
      });
    } catch (error) {
      console.error("❌ [DATA-DISCOVERY] Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to discover available data",
        error: error.message,
      });
    }
  }
);

// Helper function to map PostgreSQL types to user-friendly types
function mapPostgresType(pgType) {
  const typeMap = {
    integer: "number",
    bigint: "number",
    numeric: "number",
    "double precision": "number",
    real: "number",
    smallint: "number",
    "character varying": "string",
    text: "string",
    char: "string",
    boolean: "boolean",
    date: "date",
    timestamp: "date",
    "timestamp without time zone": "date",
    "timestamp with time zone": "date",
    json: "object",
    jsonb: "object",
  };

  return typeMap[pgType.toLowerCase()] || "string";
}

module.exports = router;
module.exports.setSocketIO = setSocketIO;
