const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { validate, schemas, sanitizeApp } = require("../utils/validation");
const { authenticateToken } = require("../middleware/auth");
const {
  AppError,
  createStandardError,
  asyncHandler,
  validateRequired,
  validateId,
  createSuccessResponse,
} = require("../utils/errorHandler");

const router = express.Router();
const prisma = new PrismaClient();

// Socket.io instance will be injected
let io;

// All routes require authentication
router.use(authenticateToken);

// GET /api/apps - List developer's apps (Dashboard)
router.get("/", validate(schemas.appsQuery, "query"), async (req, res) => {
  try {
    // Developer-only platform: Check role (already done in middleware)
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.id;
    const skip = (page - 1) * limit;

    // Build where clause - only owned apps for dashboard
    const where = {
      ownerId: userId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get apps with pagination - dashboard specific fields
    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          archived: true,
          templateId: true,
          createdAt: true,
          updatedAt: true,
          template: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.app.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: "Apps retrieved successfully",
      data: {
        apps: apps.map(sanitizeApp),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get apps error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve apps",
    });
  }
});

// POST /api/apps - Create new app
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, description, templateId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    validateRequired(["name"], req.body);

    // Validate template if provided
    let template = null;
    if (templateId) {
      const validatedTemplateId = validateId(templateId, "TEMPLATE");

      template = await prisma.template.findUnique({
        where: { id: validatedTemplateId },
      });

      if (!template) {
        return res.status(404).json(createStandardError("TEMPLATE_NOT_FOUND"));
      }
    }

    // Create app with template relationship
    const app = await prisma.app.create({
      data: {
        name,
        description: description || "",
        status: "Draft", // Default status
        ownerId: userId,
        templateId: templateId || null,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
            app_schema: true,
          },
        },
      },
    });

    // If template is used, create initial AppSchema based on template
    if (template && template.app_schema) {
      try {
        await prisma.appSchema.create({
          data: {
            appId: app.id,
            name: `${template.name} Schema`,
            // Note: The AppSchema model doesn't have a schema field
            // This is a placeholder for future schema storage implementation
          },
        });
      } catch (schemaError) {
        console.log(
          "Note: AppSchema creation skipped - model structure needs enhancement for template schemas"
        );
      }
    }

    // Emit Socket.io event for app creation
    if (io) {
      const eventData = {
        userId: req.user.id,
        userEmail: req.user.email,
        action: "app_created",
        app: {
          id: app.id,
          name: app.name,
          status: app.status,
          templateId: app.templateId,
          templateName: app.template?.name || null,
          templateCategory: app.template?.category || null,
        },
        timestamp: new Date().toISOString(),
      };

      // Emit to all connected users (for demo purposes)
      io.emit("app:created", eventData);

      // Also emit to user's personal room if they have one
      io.to(`user_${req.user.id}`).emit("dashboard:update", {
        type: "app_added",
        app: eventData.app,
      });
    }

    res.status(201).json(
      createSuccessResponse("App created successfully", {
        app: sanitizeApp(app),
      })
    );
  })
);

// GET /api/apps/:id - Get individual app details (Dashboard)
router.get(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const appId = validateId(req.params.id, "APP");
    const userId = req.user.id;

    // Verify app ownership and get app with canvas data
    const app = await prisma.app.findFirst({
      where: {
        id: appId,
        ownerId: userId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        canvas: {
          include: {
            elements: {
              include: {
                interactions: true,
              },
            },
          },
        },
      },
    });

    if (!app) {
      return res.status(404).json(createStandardError("APP_NOT_FOUND"));
    }

    // Format response with canvas data
    const appData = {
      ...sanitizeApp(app),
      canvasData: app.canvas
        ? {
            id: app.canvas.id,
            name: app.canvas.name,
            description: app.canvas.description,
            width: app.canvas.width,
            height: app.canvas.height,
            background: app.canvas.background,
            gridEnabled: app.canvas.gridEnabled,
            snapEnabled: app.canvas.snapEnabled,
            zoomLevel: app.canvas.zoomLevel,
            elements: app.canvas.elements || [],
            pages: [
              {
                id: "page-1",
                name: "Page 1",
                elements: app.canvas.elements || [],
                visible: true,
                canvasBackground: app.canvas.background,
                groups: [],
                canvasWidth: app.canvas.width,
                canvasHeight: app.canvas.height,
              },
            ],
            currentPageId: "page-1",
          }
        : null,
      canvasUpdatedAt: app.canvas?.updatedAt || null,
    };

    res.json(
      createSuccessResponse("App retrieved successfully", {
        app: appData,
      })
    );
  })
);

// GET /api/apps/:id/status - Get app status and production metrics (Dashboard)
router.get(
  "/:id/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const appId = validateId(req.params.id, "APP");
    const userId = req.user.id;

    // Verify app ownership
    const app = await prisma.app.findFirst({
      where: {
        id: appId,
        ownerId: userId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    if (!app) {
      return res.status(404).json(createStandardError("APP_NOT_FOUND"));
    }

    // Enhanced mock production metrics with industry-specific context
    const generateIndustrySpecificMetrics = (app) => {
      const isActive = app.status === "Active";
      const activeDays = isActive ? Math.floor(Math.random() * 30) + 5 : 0;
      const templateCategory = app.template?.category || "General";

      // Base metrics
      const baseMetrics = {
        activeDays,
        numberOfUsers: isActive ? Math.floor(Math.random() * 500) + 50 : 0,
        trafficStats: {
          requestsPerDay: isActive ? Math.floor(Math.random() * 5000) + 500 : 0,
          peakHour: isActive
            ? `${Math.floor(Math.random() * 12) + 9}:00`
            : null,
          avgResponseTime: isActive ? Math.floor(Math.random() * 300) + 150 : 0,
          bandwidth: isActive ? Math.floor(Math.random() * 2000) + 200 : 0, // MB
        },
      };

      // Industry-specific downtime logs and issues
      let downtimeLogs = [];
      let issuesAndWarnings = [];

      if (isActive && activeDays > 0) {
        // Generate 1-3 downtime incidents
        const incidentCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < incidentCount; i++) {
          const daysAgo = Math.floor(Math.random() * activeDays);
          const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

          downtimeLogs.push({
            date: date.toISOString().split("T")[0],
            duration: `${Math.floor(Math.random() * 120) + 15}m`,
            reason: getIndustrySpecificDowntimeReason(templateCategory),
          });
        }

        // Generate 2-5 issues and warnings
        const issueCount = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < issueCount; i++) {
          issuesAndWarnings.push({
            type: Math.random() > 0.7 ? "error" : "warning",
            message: getIndustrySpecificIssue(templateCategory),
            timestamp: new Date(
              Date.now() - Math.random() * activeDays * 24 * 60 * 60 * 1000
            ).toISOString(),
            severity:
              Math.random() > 0.8
                ? "high"
                : Math.random() > 0.5
                ? "medium"
                : "low",
          });
        }
      }

      return {
        ...baseMetrics,
        downtimeLogs: downtimeLogs.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        ),
        issuesAndWarnings: issuesAndWarnings.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        ),
      };
    };

    // Industry-specific downtime reasons
    const getIndustrySpecificDowntimeReason = (category) => {
      const reasons = {
        Insurance: [
          "Policy database maintenance",
          "Claims processing system update",
          "Regulatory compliance update",
          "Security audit maintenance",
        ],
        CRM: [
          "Customer data synchronization",
          "Lead scoring algorithm update",
          "Sales pipeline optimization",
          "Contact database cleanup",
        ],
        "E-commerce": [
          "Payment gateway maintenance",
          "Inventory system update",
          "Order processing optimization",
          "Product catalog refresh",
        ],
        Forms: [
          "Form validation engine update",
          "Data collection system maintenance",
          "Submission processing upgrade",
          "Field validation improvements",
        ],
        Dashboards: [
          "Analytics engine maintenance",
          "Data visualization update",
          "Report generation optimization",
          "Chart rendering improvements",
        ],
      };

      const categoryReasons = reasons[category] || reasons["Forms"];
      return categoryReasons[
        Math.floor(Math.random() * categoryReasons.length)
      ];
    };

    // Industry-specific issues and warnings
    const getIndustrySpecificIssue = (category) => {
      const issues = {
        Insurance: [
          "High API latency during policy quote generation",
          "Policy submission spike detected - 150% above normal",
          "Claims processing queue backup - 45 pending items",
          "Regulatory compliance check taking longer than expected",
          "Premium calculation service experiencing delays",
        ],
        CRM: [
          "Lead conversion rate dropped by 12% this week",
          "Customer data sync lag detected - 5 minute delay",
          "Sales pipeline report generation slow",
          "Contact duplicate detection needs attention",
          "Email campaign delivery rate below threshold",
        ],
        "E-commerce": [
          "Cart abandonment rate increased to 68%",
          "Payment processing delays during peak hours",
          "Inventory sync issues with 3 products",
          "Product recommendation engine needs tuning",
          "Checkout process timeout warnings",
        ],
        Forms: [
          "Form submission validation errors increased",
          "File upload size limit exceeded warnings",
          "Required field validation bypass attempts",
          "Form completion rate below 75%",
          "Data export processing delays",
        ],
        Dashboards: [
          "Chart rendering performance degraded",
          "Real-time data refresh lag detected",
          "Dashboard load time exceeds 3 seconds",
          "Data aggregation queries timing out",
          "Export functionality memory usage high",
        ],
      };

      const categoryIssues = issues[category] || issues["Forms"];
      return categoryIssues[Math.floor(Math.random() * categoryIssues.length)];
    };

    const mockMetrics = generateIndustrySpecificMetrics(app);

    res.json(
      createSuccessResponse("App status retrieved successfully", {
        app: sanitizeApp(app),
        metrics: mockMetrics,
      })
    );
  })
);

// PUT /api/apps/:id/status - Update app status
router.put(
  "/:id/status",
  validate(schemas.idParams, "params"),
  validate(schemas.updateAppStatus),
  async (req, res) => {
    try {
      const appId = parseInt(req.params.id);
      const { status } = req.body;
      const userId = req.user.id;

      // Verify app ownership
      const existingApp = await prisma.app.findFirst({
        where: {
          id: appId,
          ownerId: userId,
        },
      });

      if (!existingApp) {
        return res.status(404).json({
          success: false,
          message: "App not found",
        });
      }

      // Update app status
      const app = await prisma.app.update({
        where: { id: appId },
        data: {
          status,
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "App status updated successfully",
        data: {
          app: sanitizeApp(app),
        },
      });
    } catch (error) {
      console.error("Update app status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update app status",
      });
    }
  }
);

// PATCH /api/apps/:id - Update app properties (including archived status)
router.patch("/:id", validate(schemas.idParams, "params"), async (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const userId = req.user.id;
    const { archived, name, description, status } = req.body;

    // Verify app ownership
    const existingApp = await prisma.app.findFirst({
      where: {
        id: appId,
        ownerId: userId,
      },
    });

    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: "App not found or access denied",
      });
    }

    // Build update data object
    const updateData = {};
    if (archived !== undefined) updateData.archived = archived;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    // Update the app
    const updatedApp = await prisma.app.update({
      where: { id: appId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    console.log(`✅ App ${appId} updated:`, updateData);

    res.json({
      success: true,
      message: "App updated successfully",
      data: {
        app: sanitizeApp(updatedApp),
      },
    });
  } catch (error) {
    console.error("❌ Error updating app:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update app",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE /api/apps/:id - Delete app permanently
router.delete(
  "/:id",
  validate(schemas.idParams, "params"),
  async (req, res) => {
    try {
      const appId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify app ownership
      const existingApp = await prisma.app.findFirst({
        where: {
          id: appId,
          ownerId: userId,
        },
      });

      if (!existingApp) {
        return res.status(404).json({
          success: false,
          message: "App not found or access denied",
        });
      }

      // Delete the app (cascade will handle related records)
      await prisma.app.delete({
        where: { id: appId },
      });

      console.log(`✅ App ${appId} deleted permanently`);

      res.json({
        success: true,
        message: "App deleted successfully",
        data: {
          deletedAppId: appId,
        },
      });
    } catch (error) {
      console.error("❌ Error deleting app:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete app",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Function to inject Socket.io instance
router.setSocketIO = (socketIO) => {
  io = socketIO;
};

module.exports = router;
