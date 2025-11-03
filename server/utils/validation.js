const Joi = require('joi');
const { createStandardError } = require('./errorHandler');

// Common validation schemas
const schemas = {
  // User validation
  signup: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
    role: Joi.string().valid('user', 'developer', 'admin').default('user')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false)
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers'
    })
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required()
  }),

  // App validation (renamed from Project)
  createApp: Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'App name cannot be empty',
      'string.max': 'App name cannot exceed 100 characters'
    }),
    description: Joi.string().max(500).allow('').optional(),
    templateId: Joi.number().integer().positive().optional()
  }),

  updateApp: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).allow('').optional()
  }),

  updateAppStatus: Joi.object({
    status: Joi.string().valid('Draft', 'Published', 'Active').required()
  }),

  // Team collaboration validation removed - developer-only platform

  // Query parameters validation
  appsQuery: Joi.object({
    status: Joi.string().valid('Draft', 'Published', 'Active').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(100).optional()
  }),

  // ID parameter validation
  mongoId: Joi.string().pattern(/^[0-9]+$/).required().messages({
    'string.pattern.base': 'Invalid ID format'
  }),

  // Params validation for routes with ID
  idParams: Joi.object({
    id: Joi.string().pattern(/^[0-9]+$/).required().messages({
      'string.pattern.base': 'Invalid ID format'
    })
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      // Create detailed validation error message
      const fieldNames = errors.map(e => e.field).join(', ');
      const errorMessage = errors.length === 1
        ? errors[0].message
        : `Validation failed for fields: ${fieldNames}`;

      return res.status(400).json(createStandardError('INVALID_INPUT', errorMessage, {
        validationErrors: errors
      }));
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

// Utility functions
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateInviteToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const sanitizeUser = (user) => {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

const sanitizeApp = (app) => {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    status: app.status,
    archived: app.archived,
    ownerId: app.ownerId,
    templateId: app.templateId,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    template: app.template ? {
      id: app.template.id,
      name: app.template.name,
      category: app.template.category
    } : undefined
  };
};

module.exports = {
  schemas,
  validate,
  generateOTP,
  generateInviteToken,
  sanitizeUser,
  sanitizeApp
};
