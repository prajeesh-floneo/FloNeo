/**
 * Centralized Error Handling Utilities for FloNeo LCNC Platform
 * Provides consistent error responses across all API endpoints
 */

class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard error response format for all APIs
 */
const createErrorResponse = (message, statusCode = 500, code = null, details = null) => {
  const error = {
    success: false,
    message,
    error: {
      code: code || `ERROR_${statusCode}`,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  if (details && process.env.NODE_ENV === 'development') {
    error.error.details = details;
  }

  return error;
};

/**
 * Common error types for consistent messaging
 */
const ErrorTypes = {
  // Authentication & Authorization (401)
  INVALID_CREDENTIALS: {
    message: 'Invalid email or password',
    statusCode: 401,
    code: 'INVALID_CREDENTIALS'
  },
  UNAUTHORIZED: {
    message: 'Access denied. Please provide a valid authentication token',
    statusCode: 401,
    code: 'UNAUTHORIZED'
  },
  TOKEN_EXPIRED: {
    message: 'Authentication token has expired. Please login again',
    statusCode: 401,
    code: 'TOKEN_EXPIRED'
  },
  INVALID_TOKEN: {
    message: 'Invalid authentication token provided',
    statusCode: 401,
    code: 'INVALID_TOKEN'
  },
  INSUFFICIENT_PERMISSIONS: {
    message: 'Insufficient permissions to access this resource',
    statusCode: 403,
    code: 'INSUFFICIENT_PERMISSIONS'
  },

  // Validation Errors (400)
  MISSING_REQUIRED_FIELDS: {
    message: 'Missing required fields in request',
    statusCode: 400,
    code: 'MISSING_REQUIRED_FIELDS'
  },
  INVALID_INPUT: {
    message: 'Invalid input provided',
    statusCode: 400,
    code: 'INVALID_INPUT'
  },
  INVALID_EMAIL_FORMAT: {
    message: 'Invalid email format provided',
    statusCode: 400,
    code: 'INVALID_EMAIL_FORMAT'
  },
  INVALID_TEMPLATE_ID: {
    message: 'Invalid template ID provided',
    statusCode: 400,
    code: 'INVALID_TEMPLATE_ID'
  },
  INVALID_APP_ID: {
    message: 'Invalid app ID provided',
    statusCode: 400,
    code: 'INVALID_APP_ID'
  },

  // Not Found Errors (404)
  USER_NOT_FOUND: {
    message: 'User not found',
    statusCode: 404,
    code: 'USER_NOT_FOUND'
  },
  APP_NOT_FOUND: {
    message: 'App not found or you do not have permission to access it',
    statusCode: 404,
    code: 'APP_NOT_FOUND'
  },
  TEMPLATE_NOT_FOUND: {
    message: 'Template not found',
    statusCode: 404,
    code: 'TEMPLATE_NOT_FOUND'
  },
  RESOURCE_NOT_FOUND: {
    message: 'Requested resource not found',
    statusCode: 404,
    code: 'RESOURCE_NOT_FOUND'
  },

  // Conflict Errors (409)
  EMAIL_ALREADY_EXISTS: {
    message: 'An account with this email already exists',
    statusCode: 409,
    code: 'EMAIL_ALREADY_EXISTS'
  },
  DUPLICATE_RESOURCE: {
    message: 'Resource already exists',
    statusCode: 409,
    code: 'DUPLICATE_RESOURCE'
  },

  // Server Errors (500)
  INTERNAL_SERVER_ERROR: {
    message: 'An internal server error occurred. Please try again later',
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR'
  },
  DATABASE_ERROR: {
    message: 'Database operation failed. Please try again later',
    statusCode: 500,
    code: 'DATABASE_ERROR'
  },
  EXTERNAL_SERVICE_ERROR: {
    message: 'External service unavailable. Please try again later',
    statusCode: 500,
    code: 'EXTERNAL_SERVICE_ERROR'
  }
};

/**
 * Create standardized error response
 */
const createStandardError = (errorType, customMessage = null, details = null) => {
  const error = ErrorTypes[errorType];
  if (!error) {
    return createErrorResponse('Unknown error type', 500, 'UNKNOWN_ERROR');
  }

  return createErrorResponse(
    customMessage || error.message,
    error.statusCode,
    error.code,
    details
  );
};

/**
 * Express error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error(`❌ Error in ${req.method} ${req.path}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    user: req.user?.email || 'Anonymous',
    timestamp: new Date().toISOString()
  });

  // Prisma/Database errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return res.status(409).json(createStandardError('DUPLICATE_RESOURCE', 
      `Duplicate value for ${field}. This ${field} already exists.`));
  }

  if (err.code === 'P2025') {
    return res.status(404).json(createStandardError('RESOURCE_NOT_FOUND'));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(createStandardError('INVALID_TOKEN'));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(createStandardError('TOKEN_EXPIRED'));
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json(createStandardError('INVALID_INPUT', message));
  }

  // Operational errors (custom AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json(createErrorResponse(
      err.message,
      err.statusCode,
      err.code
    ));
  }

  // Default server error
  res.status(500).json(createStandardError('INTERNAL_SERVER_ERROR'));
};

/**
 * Async error wrapper to catch async errors in route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation helper functions
 */
const validateRequired = (fields, body) => {
  const missing = fields.filter(field => !body[field] || body[field].toString().trim() === '');
  if (missing.length > 0) {
    throw new AppError(
      `Missing required fields: ${missing.join(', ')}`,
      400,
      'MISSING_REQUIRED_FIELDS'
    );
  }
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError(
      'Invalid email format provided',
      400,
      'INVALID_EMAIL_FORMAT'
    );
  }
};

const validateId = (id, type = 'ID') => {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new AppError(
      `Invalid ${type} provided. Must be a positive integer`,
      400,
      `INVALID_${type.toUpperCase()}_ID`
    );
  }
  return numId;
};

/**
 * Success response helper
 */
const createSuccessResponse = (message, data = null, meta = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (meta !== null) {
    response.meta = meta;
  }

  return response;
};

module.exports = {
  AppError,
  ErrorTypes,
  createErrorResponse,
  createStandardError,
  errorHandler,
  asyncHandler,
  validateRequired,
  validateEmail,
  validateId,
  createSuccessResponse
};
