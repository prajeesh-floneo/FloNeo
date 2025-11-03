// Role-Based Access Control Middleware

// Role hierarchy: admin > developer > user
const roleHierarchy = {
  admin: 3,
  developer: 2,
  user: 1
};

// Check if user has required role or higher
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${requiredRole} role or higher required.`
      });
    }

    next();
  };
};

// Check if user has exact role
const requireExactRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${role} role required.`
      });
    }

    next();
  };
};

// Check if user has any of the specified roles
const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. One of these roles required: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Admin functionality removed - developer-only platform
// Developer only access
const requireDeveloper = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'developer') {
    return res.status(403).json({
      success: false,
      message: 'Only developers allowed'
    });
  }

  next();
};

// Any authenticated user
const requireUser = requireRole('user');

// Project ownership or developer access
const requireProjectOwnerOrDeveloper = async (req, res, next) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const projectId = parseInt(req.params.id || req.params.projectId);
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID required'
      });
    }

    // Check if user owns the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Allow access if user owns the project OR is a developer
    if (project.ownerId !== req.user.id && req.user.role !== 'developer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  } catch (error) {
    console.error('RBAC project owner check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Access control check failed'
    });
  }
};

// Team collaboration functions removed - developer-only platform

module.exports = {
  requireRole,
  requireExactRole,
  requireAnyRole,
  requireDeveloper,
  requireUser,
  requireProjectOwnerOrDeveloper
};
