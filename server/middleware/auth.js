const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { sanitizeUser } = require("../utils/validation");
const { createStandardError } = require("../utils/errorHandler");

const prisma = new PrismaClient();

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json(createStandardError("UNAUTHORIZED"));
    }

    // Check if token is blacklisted
    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (blacklisted) {
      return res
        .status(401)
        .json(
          createStandardError(
            "TOKEN_EXPIRED",
            "Token has been revoked. Please login again"
          )
        );
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json(createStandardError("USER_NOT_FOUND"));
    }

    // Developer-only platform: Check role
    if (user.role !== "developer") {
      return res
        .status(403)
        .json(
          createStandardError(
            "INSUFFICIENT_PERMISSIONS",
            "Access restricted to developers only"
          )
        );
    }

    if (!user.verified) {
      return res.status(401).json({
        success: false,
        message: "Account not verified",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json(createStandardError("INVALID_TOKEN"));
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json(createStandardError("TOKEN_EXPIRED"));
    }

    console.error("❌ Auth middleware error:", error);
    return res
      .status(500)
      .json(
        createStandardError("INTERNAL_SERVER_ERROR", "Authentication failed")
      );
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    req.user = user && user.verified ? user : null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Clean up expired tokens from database
const cleanExpiredTokens = async () => {
  try {
    const result = await prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`🧹 Cleaned up ${result.count} expired tokens`);
  } catch (error) {
    console.error("❌ Error cleaning expired tokens:", error);
  }
};

// Generate JWT tokens
// generateTokens function removed - simplified authentication

// Refresh token functions removed - simplified authentication

module.exports = {
  authenticateToken,
  optionalAuth,
  cleanExpiredTokens,
};
