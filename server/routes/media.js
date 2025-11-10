const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const sharp = require("sharp");

const router = express.Router();
const prisma = new PrismaClient();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

// File filter - accept all file types
const fileFilter = (req, file, cb) => {
  // Accept all file types
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Helper function to generate thumbnail for images
const generateThumbnail = async (filePath, filename) => {
  try {
    const thumbnailPath = path.join(thumbnailsDir, `thumb_${filename}`);

    await sharp(filePath)
      .resize(200, 200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return `/api/media/thumbnails/thumb_${filename}`;
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return null;
  }
};

// POST /api/media/upload - Upload media files
router.post(
  "/upload",
  authenticateToken,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { appId } = req.body;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
      }

      // Verify app ownership if appId is provided
      if (appId) {
        const app = await prisma.app.findFirst({
          where: {
            id: parseInt(appId),
            ownerId: userId,
          },
        });

        if (!app) {
          // Clean up uploaded files
          files.forEach((file) => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });

          return res.status(404).json({
            success: false,
            message: "App not found or access denied",
          });
        }
      }

      const uploadedFiles = [];

      // Process each uploaded file
      for (const file of files) {
        try {
          const fileUrl = `/api/media/files/${file.filename}`;
          let thumbnailUrl = null;

          // Generate thumbnail for images
          if (
            file.mimetype.startsWith("image/") &&
            file.mimetype !== "image/svg+xml"
          ) {
            thumbnailUrl = await generateThumbnail(file.path, file.filename);
          }

          // Save file info to database
          const mediaFile = await prisma.mediaFile.create({
            data: {
              filename: file.filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              url: fileUrl,
              thumbnail: thumbnailUrl,
              userId,
              appId: appId ? parseInt(appId) : null,
              metadata: {
                uploadedAt: new Date(),
                dimensions: file.mimetype.startsWith("image/")
                  ? await getImageDimensions(file.path)
                  : null,
              },
            },
          });

          uploadedFiles.push(mediaFile);
        } catch (fileError) {
          console.error(
            `Error processing file ${file.originalname}:`,
            fileError
          );

          // Clean up file on error
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      res.json({
        success: true,
        data: uploadedFiles,
        message: `${uploadedFiles.length} files uploaded successfully`,
      });
    } catch (error) {
      console.error("File upload error:", error);

      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload files",
      });
    }
  }
);

// GET /api/media/files/:filename - Serve uploaded files
router.get("/files/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found",
    });
  }

  res.sendFile(filePath);
});

// GET /api/media/thumbnails/:filename - Serve thumbnail files
router.get("/thumbnails/:filename", (req, res) => {
  const { filename } = req.params;
  const thumbnailPath = path.join(thumbnailsDir, filename);

  if (!fs.existsSync(thumbnailPath)) {
    return res.status(404).json({
      success: false,
      message: "Thumbnail not found",
    });
  }

  res.sendFile(thumbnailPath);
});

// GET /api/media - Get user's media files
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { appId, type, page = 1, limit = 20 } = req.query;

    const where = { userId };

    if (appId) {
      where.appId = parseInt(appId);
    }

    if (type) {
      where.mimeType = { startsWith: type }; // e.g., 'image/', 'video/'
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.mediaFile.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get media files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve media files",
    });
  }
});

// DELETE /api/media/:id - Delete media file
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the file
    const mediaFile = await prisma.mediaFile.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!mediaFile) {
      return res.status(404).json({
        success: false,
        message: "File not found or access denied",
      });
    }

    // Delete physical files
    const filePath = path.join(uploadsDir, mediaFile.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete thumbnail if exists
    if (mediaFile.thumbnail) {
      const thumbnailFilename = path.basename(mediaFile.thumbnail);
      const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }

    // Delete from database
    await prisma.mediaFile.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete media file error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
    });
  }
});

// Helper function to get image dimensions
const getImageDimensions = async (filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    return null;
  }
};

module.exports = router;
