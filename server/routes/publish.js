const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Publish an app
router.post("/apps/:appId/publish", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const { name, description, version, isPublic, publishedAt } = req.body;
    const userId = req.user.id;

    console.log("🚀 [PUBLISH] Publishing app:", appId, "by user:", userId);

    // Validate required fields
    if (!name || !description || !version) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and version are required",
      });
    }

    // Validate version format (X.Y.Z)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version)) {
      return res.status(400).json({
        success: false,
        message: "Version must be in format X.Y.Z (e.g., 1.0.0)",
      });
    }

    // Check if user owns the app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId,
      },
      include: {
        canvas: true,
      },
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found or you do not have permission to publish it",
      });
    }

    // Check if this version already exists for this app
    const existingPublication = await prisma.appPublication.findFirst({
      where: {
        appId: parseInt(appId),
        version: version,
      },
    });

    if (existingPublication) {
      return res.status(409).json({
        success: false,
        message: `Version ${version} has already been published for this app`,
      });
    }

    // Get the current canvas state for publishing
    const canvas = await prisma.canvas.findFirst({
      where: {
        appId: parseInt(appId),
      },
    });

    if (!canvas) {
      return res.status(400).json({
        success: false,
        message:
          "No canvas data found for this app. Please save your app before publishing.",
      });
    }

    // Create the publication record
    const publication = await prisma.appPublication.create({
      data: {
        appId: parseInt(appId),
        name: name.trim(),
        description: description.trim(),
        version: version.trim(),
        isPublic: isPublic || false,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        canvasSnapshot: canvas.canvasState, // Store the canvas state at time of publishing
        publishedBy: userId,
      },
    });

    // Update the app's published status and latest publication info
    await prisma.app.update({
      where: {
        id: parseInt(appId),
      },
      data: {
        isPublished: true,
        publishedVersion: version,
        publishedAt: new Date(publishedAt || new Date()),
        updatedAt: new Date(),
      },
    });

    console.log("✅ [PUBLISH] App published successfully:", publication.id);

    res.json({
      success: true,
      message: "App published successfully",
      data: {
        publicationId: publication.id,
        appId: parseInt(appId),
        name: publication.name,
        description: publication.description,
        version: publication.version,
        isPublic: publication.isPublic,
        publishedAt: publication.publishedAt,
        publishUrl: isPublic ? `/published/${publication.id}` : null,
      },
    });
  } catch (error) {
    console.error("❌ [PUBLISH] Error publishing app:", error);
    res.status(500).json({
      success: false,
      message: "Failed to publish app",
      error: error.message,
    });
  }
});

// Get published versions of an app
router.get("/apps/:appId/publications", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

    // Check if user owns the app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId,
      },
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message:
          "App not found or you do not have permission to view its publications",
      });
    }

    const publications = await prisma.appPublication.findMany({
      where: {
        appId: parseInt(appId),
      },
      orderBy: {
        publishedAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublic: true,
        publishedAt: true,
        publishedBy: true,
      },
    });

    res.json({
      success: true,
      data: publications,
    });
  } catch (error) {
    console.error("❌ [PUBLISH] Error fetching publications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch publications",
      error: error.message,
    });
  }
});

// Get public published apps (for discovery)
router.get("/published/discover", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      isPublic: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [publications, total] = await Promise.all([
      prisma.appPublication.findMany({
        where: whereClause,
        orderBy: {
          publishedAt: "desc",
        },
        skip: offset,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          publishedAt: true,
          app: {
            select: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.appPublication.count({
        where: whereClause,
      }),
    ]);

    res.json({
      success: true,
      data: {
        publications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("❌ [PUBLISH] Error fetching public publications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public publications",
      error: error.message,
    });
  }
});

// Get a specific published app
router.get("/published/:publicationId", async (req, res) => {
  try {
    const { publicationId } = req.params;

    const publication = await prisma.appPublication.findFirst({
      where: {
        id: parseInt(publicationId),
        isPublic: true, // Only allow access to public publications
      },
      include: {
        app: {
          select: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: "Published app not found or not publicly available",
      });
    }

    res.json({
      success: true,
      data: publication,
    });
  } catch (error) {
    console.error("❌ [PUBLISH] Error fetching published app:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch published app",
      error: error.message,
    });
  }
});

module.exports = router;
