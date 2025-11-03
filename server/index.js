require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { PrismaClient } = require("@prisma/client");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { errorHandler } = require("./utils/errorHandler");

// Import routes
const authRoutes = require("./routes/auth");
const appRoutes = require("./routes/apps");
const templateRoutes = require("./routes/templates");
const aiRoutes = require("./routes/ai");
// Admin user routes removed - developer-only platform
// Team routes removed - developer-only platform
const videoRoutes = require("./routes/videos");
const schemaRoutes = require("./routes/schemas");
const statsRoutes = require("./routes/stats");
// Clear require cache for notifications to ensure fresh load
delete require.cache[require.resolve("./routes/notifications")];
const notificationRoutes = require("./routes/notifications");

// Canvas routes
const canvasRoutes = require("./routes/canvas");
const canvasAdvancedRoutes = require("./routes/canvas-advanced");
const canvasHistoryRoutes = require("./routes/canvas-history");
const canvasExportRoutes = require("./routes/canvas-export");
const mediaRoutes = require("./routes/media");
const workflowRoutes = require("./routes/workflow");
const workflowExecutionRoutes = require("./routes/workflow-execution");
const databaseRoutes = require("./routes/database");
const publishRoutes = require("./routes/publish");

// Import middleware
const { cleanExpiredTokens } = require("./middleware/auth");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "FloNeo LCNC Platform API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API routes
app.use("/auth", authRoutes);
app.use("/api/apps", appRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/floneo-ai", aiRoutes);
// Admin user API removed - developer-only platform
// Team API removed - developer-only platform
app.use("/api/videos", videoRoutes);
app.use("/api/schemas", schemaRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationRoutes);

// Canvas API routes
app.use("/api/canvas", canvasRoutes);
app.use("/api/canvas", canvasAdvancedRoutes);
app.use("/api/canvas", canvasHistoryRoutes);
app.use("/api/canvas", canvasExportRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/workflow", workflowRoutes);
app.use("/api/workflow", workflowExecutionRoutes);
app.use("/api/database", databaseRoutes);
app.use("/api", publishRoutes);

// Socket.io authentication middleware - Developer-only (Risk Mitigation)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Risk Mitigation: Check if token is blacklisted
    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (blacklisted) {
      return next(new Error("Token has been invalidated"));
    }

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Developer-only platform: Check role in JWT payload
    if (decoded.role !== "developer") {
      return next(new Error("Access restricted to developers only"));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, verified: true },
    });

    if (!user || !user.verified || user.role !== "developer") {
      return next(new Error("Invalid or unverified developer"));
    }

    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.userRole = user.role;

    // Log Socket.io authentication
    const fs = require("fs");
    const logDir = "server/logs";
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logEntry = `${new Date().toISOString()}: Socket.io auth success for ${
      user.email
    }\n`;
    try {
      fs.appendFileSync(`${logDir}/socket.log`, logEntry);
    } catch (logError) {
      console.log(logEntry.trim()); // Fallback to console
    }

    next();
  } catch (error) {
    next(new Error("Authentication failed"));
  }
});

// Socket.io connection handling
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.userEmail} (ID: ${socket.userId})`);

  // Store user connection
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    email: socket.userEmail,
    role: socket.userRole,
    connectedAt: new Date(),
  });

  // Broadcast user online status
  socket.broadcast.emit("user:online", {
    userId: socket.userId,
    email: socket.userEmail,
    timestamp: new Date(),
  });

  // Join user to their own room for direct messages
  socket.join(`user:${socket.userId}`);

  // Handle project room joining
  socket.on("project:join", async (projectId) => {
    try {
      // Verify user has access to this project
      const project = await prisma.project.findFirst({
        where: {
          id: parseInt(projectId),
          OR: [
            { ownerId: socket.userId },
            { members: { some: { userId: socket.userId } } },
          ],
        },
      });

      if (project) {
        socket.join(`project:${projectId}`);
        socket.to(`project:${projectId}`).emit("user:joined-project", {
          userId: socket.userId,
          email: socket.userEmail,
          projectId,
          timestamp: new Date(),
        });
        console.log(`👥 User ${socket.userEmail} joined project ${projectId}`);
      }
    } catch (error) {
      console.error("Project join error:", error);
    }
  });

  // Handle project updates
  socket.on("project:update", (data) => {
    socket.to(`project:${data.projectId}`).emit("project:updated", {
      ...data,
      updatedBy: {
        userId: socket.userId,
        email: socket.userEmail,
      },
      timestamp: new Date(),
    });
  });

  // Handle typing indicators
  socket.on("typing:start", (data) => {
    socket.to(`project:${data.projectId}`).emit("user:typing", {
      userId: socket.userId,
      email: socket.userEmail,
      projectId: data.projectId,
      timestamp: new Date(),
    });
  });

  socket.on("typing:stop", (data) => {
    socket.to(`project:${data.projectId}`).emit("user:stopped-typing", {
      userId: socket.userId,
      email: socket.userEmail,
      projectId: data.projectId,
      timestamp: new Date(),
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(
      `🔌 User disconnected: ${socket.userEmail} (ID: ${socket.userId})`
    );

    // Remove from connected users
    connectedUsers.delete(socket.userId);

    // Broadcast user offline status
    socket.broadcast.emit("user:offline", {
      userId: socket.userId,
      email: socket.userEmail,
      timestamp: new Date(),
    });
  });
});

// Global function to emit metric updates (Dashboard)
global.emitMetricUpdate = (projectId, metrics) => {
  const updateData = {
    projectId,
    ...metrics,
    timestamp: new Date(),
  };

  io.to(`project:${projectId}`).emit("metric:updated", updateData);

  // Log metric update
  const fs = require("fs");
  const logDir = "server/logs";
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logEntry = `${new Date().toISOString()}: Metric update emitted for project ${projectId}\n`;
  try {
    fs.appendFileSync(`${logDir}/socket.log`, logEntry);
  } catch (logError) {
    console.log(logEntry.trim()); // Fallback to console
  }

  console.log(`📊 Metric update emitted for project ${projectId}`);
};

// Global function to emit notifications
global.emitNotification = (notification) => {
  io.to(`user:${notification.userId}`).emit("notification:new", {
    userId: notification.userId,
    type: notification.type,
    message: notification.message,
    id: notification.id,
    createdAt: notification.createdAt,
    timestamp: new Date(),
  });
  console.log(
    `🔔 Notification emitted to user ${notification.userId}: ${notification.type}`
  );
};

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Cleanup expired tokens every hour
const cleanupInterval = setInterval(async () => {
  try {
    await cleanExpiredTokens();
    console.log("🧹 Cleaned expired tokens");
  } catch (error) {
    console.error("Token cleanup error:", error);
  }
}, 60 * 60 * 1000);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);

  // Clear the cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    console.log("🧹 Cleanup interval cleared");
  }

  // Disconnect from database
  await prisma.$disconnect();

  // Close server
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Initialize canvas Socket.io events
const { initializeCanvasEvents } = require("./utils/canvasSocketEvents");
initializeCanvasEvents(io);

// Inject Socket.io instance into routes that need real-time functionality
appRoutes.setSocketIO(io);
templateRoutes.setSocketIO(io);
aiRoutes.setSocketIO(io);
canvasRoutes.setSocketIO(io);
canvasAdvancedRoutes.setSocketIO(io);
canvasHistoryRoutes.setSocketIO(io);
canvasExportRoutes.setSocketIO(io);

// Error handling middleware (must be last)
app.use(errorHandler);

// Only start server if not in test environment
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(
      `🚀 FloNeo LCNC Platform API running on http://localhost:${PORT}`
    );
    console.log(`🔌 Socket.io server ready for real-time connections`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

module.exports = app;
