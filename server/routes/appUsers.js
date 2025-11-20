const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
const { emitAppUserCreated, emitAppUserUpdated, emitAppUserDeleted } = require("../utils/appUserEvents");

/**
 * CREATE APP USER WITH ROLE
 * POST /api/app-users/:appId/create
 * Body: { email, password, roleSlug, name? }
 */
router.post("/:appId/create", async (req, res) => {
  try {
    const { appId } = req.params;
    const { email, password, roleSlug, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Check if user already exists for this app
    const existingUser = await prisma.appUser.findUnique({
      where: {
        appId_email: {
          appId: Number(appId),
          email: email.trim().toLowerCase(),
        },
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists for this app",
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Find or create role if roleSlug is provided
    let roleId = null;
    if (roleSlug) {
      const roleSlugNormalized = roleSlug.trim().toLowerCase().replace(/\s+/g, "-");
      
      let role = await prisma.appRole.findFirst({
        where: {
          appId: Number(appId),
          slug: roleSlugNormalized,
        },
      });

      // Create role if it doesn't exist
      if (!role) {
        role = await prisma.appRole.create({
          data: {
            appId: Number(appId),
            name: roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1),
            slug: roleSlugNormalized,
            description: `Auto-created role: ${roleSlug}`,
            isPredefined: false,
          },
        });
        console.log(`✅ [APP-USER] Created new role: ${roleSlugNormalized}`);
      }

      roleId = role.id;
    }

    // Create AppUser
    const appUser = await prisma.appUser.create({
      data: {
        appId: Number(appId),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        name: name || null,
        isActive: true,
      },
    });

    // Assign role if provided
    if (roleId) {
      await prisma.appUserRole.create({
        data: {
          appUserId: appUser.id,
          appRoleId: roleId,
          grantedBy: null, // System granted
        },
      });
      console.log(`✅ [APP-USER] Assigned role ${roleId} to user ${appUser.id}`);
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = appUser;

    // Emit socket event for real-time update
    emitAppUserCreated(Number(appId), {
      user: userWithoutPassword,
      roleAssigned: roleId ? true : false,
    });

    res.json({
      success: true,
      message: "User created successfully",
      user: userWithoutPassword,
      roleAssigned: roleId ? true : false,
    });
  } catch (err) {
    console.error("❌ [APP-USER] Create error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to create user",
    });
  }
});

/**
 * LIST APP USERS
 * GET /api/app-users/:appId/list
 */
router.get("/:appId/list", async (req, res) => {
  try {
    const { appId } = req.params;

    const users = await prisma.appUser.findMany({
      where: { appId: Number(appId) },
      include: {
        roles: {
          include: {
            appRole: true,
          },
        },
        pageAccess: {
          include: {
            page: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Remove passwords from response
    const usersWithoutPasswords = users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json({
      success: true,
      users: usersWithoutPasswords,
    });
  } catch (err) {
    console.error("❌ [APP-USER] List error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to list users",
    });
  }
});

/**
 * ASSIGN ROLE TO APP USER
 * POST /api/app-users/:appUserId/assign-role
 * Body: { roleSlug }
 */
router.post("/:appUserId/assign-role", async (req, res) => {
  try {
    const { appUserId } = req.params;
    const { roleSlug } = req.body;

    if (!roleSlug) {
      return res.status(400).json({
        success: false,
        message: "roleSlug is required",
      });
    }

    // Get app user
    const appUser = await prisma.appUser.findUnique({
      where: { id: Number(appUserId) },
    });

    if (!appUser) {
      return res.status(404).json({
        success: false,
        message: "App user not found",
      });
    }

    // Find or create role
    const roleSlugNormalized = roleSlug.trim().toLowerCase().replace(/\s+/g, "-");
    
    let role = await prisma.appRole.findFirst({
      where: {
        appId: appUser.appId,
        slug: roleSlugNormalized,
      },
    });

    if (!role) {
      role = await prisma.appRole.create({
        data: {
          appId: appUser.appId,
          name: roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1),
          slug: roleSlugNormalized,
          description: `Auto-created role: ${roleSlug}`,
          isPredefined: false,
        },
      });
    }

    // Check if role already assigned
    const existingAssignment = await prisma.appUserRole.findUnique({
      where: {
        appUserId_appRoleId: {
          appUserId: Number(appUserId),
          appRoleId: role.id,
        },
      },
    });

    if (existingAssignment) {
      return res.json({
        success: true,
        message: "Role already assigned",
        role,
      });
    }

    // Assign role
    await prisma.appUserRole.create({
      data: {
        appUserId: Number(appUserId),
        appRoleId: role.id,
        grantedBy: null,
      },
    });

    res.json({
      success: true,
      message: "Role assigned successfully",
      role,
    });
  } catch (err) {
    console.error("❌ [APP-USER] Assign role error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to assign role",
    });
  }
});

/**
 * APP USER LOGIN
 * POST /api/app-users/:appId/login
 * Body: { email, password }
 */
router.post("/:appId/login", async (req, res) => {
  try {
    const { appId } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find AppUser
    const appUser = await prisma.appUser.findFirst({
      where: {
        appId: Number(appId),
        email: email.trim().toLowerCase(),
        isActive: true,
      },
      include: {
        roles: {
          include: {
            appRole: {
              include: {
                rolePages: {
                  include: {
                    appPage: true,
                  },
                },
              },
            },
          },
        },
        pageAccess: {
          include: {
            page: true,
          },
        },
      },
    });

    if (!appUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    if (!appUser.password) {
      return res.status(401).json({
        success: false,
        message: "Password not set for this user",
      });
    }

    const isValidPassword = await bcrypt.compare(password, appUser.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Get accessible pages
    // 1. Direct page access
    const directPages = appUser.pageAccess.map((pa) => pa.pageSlug);

    // 2. Role-based page access
    const rolePages = [];
    for (const userRole of appUser.roles) {
      const rolePageSlugs = userRole.appRole.rolePages.map((rp) => rp.appPage.slug);
      rolePages.push(...rolePageSlugs);
    }

    // Combine and deduplicate
    const accessiblePages = [...new Set([...directPages, ...rolePages])];

    // Get user roles
    const userRoles = appUser.roles.map((r) => r.appRole.slug);

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        appUserId: appUser.id,
        appId: Number(appId),
        email: appUser.email,
        roles: userRoles,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = appUser;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        roles: userRoles,
        accessiblePages,
      },
    });
  } catch (err) {
    console.error("❌ [APP-USER] Login error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to login",
    });
  }
});

/**
 * GET SINGLE APP USER
 * GET /api/app-users/:appUserId
 */
router.get("/:appUserId", async (req, res) => {
  try {
    const { appUserId } = req.params;

    const appUser = await prisma.appUser.findUnique({
      where: { id: Number(appUserId) },
      include: {
        roles: {
          include: {
            appRole: true,
          },
        },
        pageAccess: {
          include: {
            page: true,
          },
        },
      },
    });

    if (!appUser) {
      return res.status(404).json({
        success: false,
        message: "App user not found",
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = appUser;

    res.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error("❌ [APP-USER] Get user error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to get user",
    });
  }
});

/**
 * UPDATE APP USER
 * PUT /api/app-users/:appUserId
 * Body: { email?, name?, isActive?, roleSlug? }
 */
router.put("/:appUserId", async (req, res) => {
  try {
    const { appUserId } = req.params;
    const { email, name, isActive, roleSlug } = req.body;

    // Get app user
    const appUser = await prisma.appUser.findUnique({
      where: { id: Number(appUserId) },
      include: {
        roles: {
          include: {
            appRole: true,
          },
        },
      },
    });

    if (!appUser) {
      return res.status(404).json({
        success: false,
        message: "App user not found",
      });
    }

    // Update user fields
    const updateData = {};
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (name !== undefined) updateData.name = name || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update user
    const updatedUser = await prisma.appUser.update({
      where: { id: Number(appUserId) },
      data: updateData,
      include: {
        roles: {
          include: {
            appRole: true,
          },
        },
        pageAccess: {
          include: {
            page: true,
          },
        },
      },
    });

    // Update role if provided
    if (roleSlug) {
      const roleSlugNormalized = roleSlug.trim().toLowerCase().replace(/\s+/g, "-");
      
      let role = await prisma.appRole.findFirst({
        where: {
          appId: appUser.appId,
          slug: roleSlugNormalized,
        },
      });

      if (!role) {
        role = await prisma.appRole.create({
          data: {
            appId: appUser.appId,
            name: roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1),
            slug: roleSlugNormalized,
            description: `Auto-created role: ${roleSlug}`,
            isPredefined: false,
          },
        });
      }

      // Remove existing roles and assign new one
      await prisma.appUserRole.deleteMany({
        where: { appUserId: Number(appUserId) },
      });

      await prisma.appUserRole.create({
        data: {
          appUserId: Number(appUserId),
          appRoleId: role.id,
          grantedBy: null,
        },
      });

      // Reload user with updated roles
      const userWithNewRole = await prisma.appUser.findUnique({
        where: { id: Number(appUserId) },
        include: {
          roles: {
            include: {
              appRole: true,
            },
          },
          pageAccess: {
            include: {
              page: true,
            },
          },
        },
      });

      const { password: _, ...userWithoutPassword } = userWithNewRole;

      // Emit socket event for real-time update
      emitAppUserUpdated(appUser.appId, {
        user: userWithoutPassword,
      });

      return res.json({
        success: true,
        message: "User updated successfully",
        user: userWithoutPassword,
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    // Emit socket event for real-time update
    emitAppUserUpdated(appUser.appId, {
      user: userWithoutPassword,
    });

    res.json({
      success: true,
      message: "User updated successfully",
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error("❌ [APP-USER] Update error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update user",
    });
  }
});

/**
 * RESET APP USER PASSWORD (by app owner)
 * POST /api/app-users/:appUserId/reset-password
 * Body: { newPassword }
 */
router.post("/:appUserId/reset-password", async (req, res) => {
  try {
    const { appUserId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    // Validate password strength (optional - you can customize this)
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Get app user
    const appUser = await prisma.appUser.findUnique({
      where: { id: Number(appUserId) },
    });

    if (!appUser) {
      return res.status(404).json({
        success: false,
        message: "App user not found",
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.appUser.update({
      where: { id: Number(appUserId) },
      data: { password: hashedPassword },
    });

    console.log(`✅ [APP-USER] Password reset for user ${appUserId} by app owner`);

    // Emit socket event for real-time update (password reset is an update)
    emitAppUserUpdated(appUser.appId, {
      user: { id: appUser.id, email: appUser.email },
      action: "password_reset",
    });

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    console.error("❌ [APP-USER] Reset password error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to reset password",
    });
  }
});

/**
 * DELETE APP USER
 * DELETE /api/app-users/:appUserId
 */
router.delete("/:appUserId", async (req, res) => {
  try {
    const { appUserId } = req.params;

    // Check if user exists
    const appUser = await prisma.appUser.findUnique({
      where: { id: Number(appUserId) },
    });

    if (!appUser) {
      return res.status(404).json({
        success: false,
        message: "App user not found",
      });
    }

    // Delete user roles first (cascade)
    await prisma.appUserRole.deleteMany({
      where: { appUserId: Number(appUserId) },
    });

    // Delete page access
    await prisma.pageAccess.deleteMany({
      where: { appUserId: Number(appUserId) },
    });

    const appIdForEvent = appUser.appId;

    // Delete user
    await prisma.appUser.delete({
      where: { id: Number(appUserId) },
    });

    console.log(`✅ [APP-USER] Deleted user ${appUserId}`);

    // Emit socket event for real-time update
    emitAppUserDeleted(appIdForEvent, {
      userId: Number(appUserId),
      email: appUser.email,
    });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("❌ [APP-USER] Delete error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to delete user",
    });
  }
});

module.exports = router;

