const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const {
  validate,
  schemas,
  generateOTP,
  sanitizeUser,
} = require("../utils/validation");
// Simplified authentication - refresh token functions removed
const emailService = require("../utils/email");
const {
  AppError,
  createStandardError,
  asyncHandler,
  validateRequired,
  validateEmail,
  createSuccessResponse,
} = require("../utils/errorHandler");

const router = express.Router();
const prisma = new PrismaClient();

// POST /auth/signup
router.post("/signup", validate(schemas.signup), async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user and OTP in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          verified: false,
        },
      });

      await tx.otp.create({
        data: {
          email,
          otp,
          type: "signup",
          expiresAt: otpExpiresAt,
        },
      });

      return user;
    });

    // Send OTP email
    await emailService.sendOTP(email, otp, "signup");

    res.status(201).json({
      success: true,
      message:
        "User created successfully. Please verify your email with the OTP sent.",
      data: {
        userId: result.id,
        email: result.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
});

// POST /auth/verify-otp - Removed (developers are pre-verified)

// POST /auth/resend-otp
router.post(
  "/resend-otp",
  validate(schemas.forgotPassword),
  async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.verified) {
        return res.status(400).json({
          success: false,
          message: "Email already verified",
        });
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Invalidate old OTPs and create new one
      await prisma.$transaction(async (tx) => {
        await tx.otp.updateMany({
          where: { email, used: false },
          data: { used: true },
        });

        await tx.otp.create({
          data: {
            email,
            otp,
            type: "signup",
            expiresAt: otpExpiresAt,
          },
        });
      });

      // Send OTP email
      await emailService.sendOTP(email, otp, "signup");

      res.json({
        success: true,
        message: "New OTP sent to your email",
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP",
      });
    }
  }
);

// POST /auth/login - Simplified developer-only login
router.post(
  "/login",
  validate(schemas.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate required fields
    validateRequired(["email", "password"], req.body);
    validateEmail(email);

    // Risk Mitigation: Verify JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET not configured");
      return res
        .status(500)
        .json(
          createStandardError(
            "EXTERNAL_SERVICE_ERROR",
            "Authentication service unavailable"
          )
        );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json(createStandardError("INVALID_CREDENTIALS"));
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

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json(createStandardError("INVALID_CREDENTIALS"));
    }

    // Developers are pre-verified, but check anyway for safety
    if (!user.verified) {
      return res
        .status(401)
        .json(
          createStandardError(
            "UNAUTHORIZED",
            "Account not verified. Please verify your account first"
          )
        );
    }

    // Generate simple access token (1 hour expiry for better UX)
    const jwt = require("jsonwebtoken");
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: "developer",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Longer expiry since no refresh token
    );

    // Log successful login
    const fs = require("fs");
    const logDir = "server/logs";
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logEntry = `${new Date().toISOString()}: Login success for ${email}\n`;
    try {
      fs.appendFileSync(`${logDir}/auth.log`, logEntry);
    } catch (logError) {
      console.log(logEntry.trim()); // Fallback to console
    }

    // Return success response
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    console.log("✅ AUTH: Login successful for:", email);
    console.log(
      "✅ AUTH: Access token generated:",
      accessToken.substring(0, 20) + "..."
    );
    console.log("✅ AUTH: Token will be sent in response as data.accessToken");

    res.json(
      createSuccessResponse("Login successful", {
        user: sanitizeUser(user),
        accessToken,
        expiresAt: expiresAt.toISOString(),
      })
    );
  })
);

// POST /auth/forgot-password - Static logging implementation (Risk Mitigation)
router.post(
  "/forgot-password",
  validate(schemas.forgotPassword),
  async (req, res) => {
    try {
      const { email } = req.body;

      // Risk Mitigation: Static logging for forgot password requests
      const fs = require("fs");
      const logDir = "server/logs";
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

      const logEntry = `${new Date().toISOString()}: Forgot Password not implemented for ${email}\n`;
      try {
        fs.appendFileSync(`${logDir}/auth.log`, logEntry);
      } catch (logError) {
        console.log(logEntry.trim()); // Fallback to console if file write fails
      }

      // Log to console as well
      console.log(
        `${new Date().toISOString()}: Forgot Password not implemented for ${email}`
      );

      // Return static response indicating feature is not implemented
      res.json({
        success: false,
        message:
          "Forgot password functionality is not implemented in this developer-only platform",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process password reset request",
      });
    }
  }
);

// POST /auth/reset-password
router.post(
  "/reset-password",
  validate(schemas.resetPassword),
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      // Find valid OTP
      const otpRecord = await prisma.otp.findFirst({
        where: {
          email,
          otp,
          type: "forgot-password",
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and mark OTP as used
      await prisma.$transaction(async (tx) => {
        await tx.otp.update({
          where: { id: otpRecord.id },
          data: { used: true },
        });

        await tx.user.update({
          where: { email },
          data: { password: hashedPassword },
        });

        // Refresh tokens removed - simplified authentication
      });

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
      });
    }
  }
);

// POST /auth/refresh - Refresh access token to prevent expiry
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    // Get access token from Authorization header
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (!accessToken) {
      return res
        .status(400)
        .json(
          createStandardError(
            "MISSING_REQUIRED_FIELDS",
            "Access token required in Authorization header"
          )
        );
    }

    try {
      const jwt = require("jsonwebtoken");

      // Verify the current token (even if expired, we can still refresh)
      let decoded;
      try {
        decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          // Token is expired, but we can still decode it to get user info
          decoded = jwt.decode(accessToken);
          if (!decoded) {
            return res.status(401).json(createStandardError("INVALID_TOKEN"));
          }
        } else {
          return res.status(401).json(createStandardError("INVALID_TOKEN"));
        }
      }

      // Check if token is blacklisted
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token: accessToken },
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

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          verified: true,
        },
      });

      if (!user || !user.verified) {
        return res.status(401).json(createStandardError("UNAUTHORIZED"));
      }

      // Generate new access token (1 hour expiry)
      const newAccessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: "developer",
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      console.log("✅ AUTH: Token refreshed for user:", user.email);

      res.json(
        createSuccessResponse("Token refreshed successfully", {
          accessToken: newAccessToken,
          expiresAt: expiresAt.toISOString(),
        })
      );
    } catch (error) {
      console.error("❌ Token refresh error:", error);
      res
        .status(500)
        .json(
          createStandardError(
            "INTERNAL_SERVER_ERROR",
            "Failed to refresh token"
          )
        );
    }
  })
);

// POST /auth/logout - Simplified logout (blacklist access token)
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // Get access token from Authorization header
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (!accessToken) {
      return res
        .status(400)
        .json(
          createStandardError(
            "MISSING_REQUIRED_FIELDS",
            "Access token required in Authorization header"
          )
        );
    }

    // Verify token to get user info for logging
    const jwt = require("jsonwebtoken");
    let userId = null;
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
      userId = payload.id;
    } catch (error) {
      // Token might be invalid, but we still want to blacklist it
    }

    // Add access token to blacklist with 1-hour expiry (matches token expiry)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await prisma.blacklistedToken.create({
      data: {
        token: accessToken,
        expiresAt,
      },
    });

    // Log successful logout
    const fs = require("fs");
    const logDir = "server/logs";
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logEntry = `${new Date().toISOString()}: Logout for userId: ${
      userId || "unknown"
    }\n`;
    try {
      fs.appendFileSync(`${logDir}/auth.log`, logEntry);
    } catch (logError) {
      console.log(logEntry.trim()); // Fallback to console
    }

    res.json(
      createSuccessResponse("Logged out successfully", {
        tokenBlacklisted: true,
        loggedOutAt: new Date().toISOString(),
      })
    );
  })
);

module.exports = router;
