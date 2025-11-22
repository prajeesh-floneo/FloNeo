/**
 * Security validation utilities for database operations
 * Provides comprehensive input validation, sanitization, and access control
 */

/**
 * Security validator class for database operations
 */
class SecurityValidator {
  constructor() {
    // SQL injection patterns to detect
    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(--|\/\*|\*\/|;|'|"|`)/,
      /(\bOR\b|\bAND\b).*(\b=\b|\bLIKE\b)/i,
      /(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/i,
      /(xp_|sp_|fn_)/i
    ];

    // Dangerous table/column name patterns
    // Note: Removed "password" from forbidden patterns as it's a legitimate column name
    // Security is maintained by app-specific table prefixes (app_<appId>_)
    this.dangerousPatterns = [
      /^(pg_|information_schema|sys|mysql|sqlite_)/i,
      /^(users|admin|auth|session|token)$/i, // Only block exact matches, not prefixes
      /(drop|delete|truncate|alter|create)/i
    ];

    // Maximum lengths for security
    this.maxLengths = {
      tableName: 63,    // PostgreSQL identifier limit
      columnName: 63,   // PostgreSQL identifier limit
      stringValue: 10000, // Reasonable limit for string values
      arrayLength: 1000   // Maximum array length
    };
  }

  /**
   * Validate table name for security
   * @param {string} tableName - The table name to validate
   * @param {number} appId - The app ID for ownership validation
   * @throws {Error} - If validation fails
   */
  validateTableName(tableName, appId) {
    // Basic validation
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Table name is required and must be a string');
    }

    // Length validation
    if (tableName.length > this.maxLengths.tableName) {
      throw new Error(`Table name too long. Maximum ${this.maxLengths.tableName} characters allowed`);
    }

    // Pattern validation
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Table name must start with letter and contain only alphanumeric characters and underscores');
    }

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(tableName)) {
        throw new Error(`Table name contains forbidden pattern: ${tableName}`);
      }
    }

    // Check for SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(tableName)) {
        throw new Error(`Table name contains potentially dangerous SQL: ${tableName}`);
      }
    }

    // Ensure table name follows app-specific naming convention
    const expectedPrefix = `app_${appId}_`;
    if (!tableName.startsWith(expectedPrefix)) {
      throw new Error(`Table name must start with ${expectedPrefix} for security`);
    }
  }

  /**
   * Validate column name for security
   * @param {string} columnName - The column name to validate
   * @param {boolean} allowReserved - If true, allow reserved names (for WHERE clauses, etc.)
   * @throws {Error} - If validation fails
   */
  validateColumnName(columnName, allowReserved = false) {
    if (!columnName || typeof columnName !== 'string') {
      throw new Error('Column name is required and must be a string');
    }

    if (columnName.length > this.maxLengths.columnName) {
      throw new Error(`Column name too long. Maximum ${this.maxLengths.columnName} characters allowed`);
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new Error('Column name must start with letter and contain only alphanumeric characters and underscores');
    }

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(columnName)) {
        throw new Error(`Column name contains forbidden pattern: ${columnName}`);
      }
    }

    // Check for SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(columnName)) {
        throw new Error(`Column name contains potentially dangerous SQL: ${columnName}`);
      }
    }

    // Reserved column names (only block if allowReserved is false)
    // Reserved names can be used in WHERE clauses but not in SET clauses
    if (!allowReserved) {
      const reservedNames = ['id', 'created_at', 'updated_at', 'app_id'];
      if (reservedNames.includes(columnName.toLowerCase())) {
        throw new Error(`Column name '${columnName}' is reserved`);
      }
    }
  }

  /**
   * Validate and sanitize input value
   * @param {any} value - The value to validate
   * @param {string} columnType - The expected column type
   * @returns {any} - The sanitized value
   * @throws {Error} - If validation fails
   */
  validateValue(value, columnType) {
    // Handle null values
    if (value === null || value === undefined) {
      return null;
    }

    // String validation
    if (typeof value === 'string') {
      if (value.length > this.maxLengths.stringValue) {
        throw new Error(`String value too long. Maximum ${this.maxLengths.stringValue} characters allowed`);
      }

      // Check for SQL injection in string values
      for (const pattern of this.sqlInjectionPatterns) {
        if (pattern.test(value)) {
          throw new Error('String value contains potentially dangerous SQL patterns');
        }
      }

      // Basic XSS prevention
      if (/<script|javascript:|on\w+\s*=/i.test(value)) {
        throw new Error('String value contains potentially dangerous script content');
      }
    }

    // Array validation
    if (Array.isArray(value)) {
      if (value.length > this.maxLengths.arrayLength) {
        throw new Error(`Array too long. Maximum ${this.maxLengths.arrayLength} elements allowed`);
      }

      // Recursively validate array elements
      return value.map(item => this.validateValue(item, columnType));
    }

    // Object validation
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      if (keys.length > 100) { // Reasonable limit for object properties
        throw new Error('Object has too many properties. Maximum 100 allowed');
      }

      // Recursively validate object properties
      const sanitizedObject = {};
      for (const [key, val] of Object.entries(value)) {
        this.validateColumnName(key); // Validate property names
        sanitizedObject[key] = this.validateValue(val, columnType);
      }
      return sanitizedObject;
    }

    return value;
  }

  /**
   * Validate query conditions for security
   * @param {Array} conditions - Array of condition objects
   * @throws {Error} - If validation fails
   */
  validateConditions(conditions) {
    if (!Array.isArray(conditions)) {
      throw new Error('Conditions must be an array');
    }

    if (conditions.length > 50) { // Reasonable limit
      throw new Error('Too many conditions. Maximum 50 allowed');
    }

    for (const condition of conditions) {
      if (!condition || typeof condition !== 'object') {
        throw new Error('Each condition must be an object');
      }

      const { field, operator, value } = condition;

      // Validate field name (allow reserved names in WHERE conditions)
      this.validateColumnName(field, true);

      // Validate operator
      const allowedOperators = ['=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'ILIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];
      if (!allowedOperators.includes(operator?.toUpperCase())) {
        throw new Error(`Invalid operator: ${operator}`);
      }

      // Validate value based on operator
      if (operator?.toUpperCase() === 'IN' || operator?.toUpperCase() === 'NOT IN') {
        if (!Array.isArray(value)) {
          throw new Error(`${operator} operator requires an array value`);
        }
        if (value.length > 100) {
          throw new Error('IN/NOT IN arrays cannot exceed 100 elements');
        }
      }

      // Validate the value
      if (value !== null && value !== undefined) {
        this.validateValue(value, 'text'); // Default to text validation
      }
    }
  }

  /**
   * Validate pagination parameters
   * @param {number} limit - The limit value
   * @param {number} offset - The offset value
   * @throws {Error} - If validation fails
   */
  validatePagination(limit, offset) {
    if (limit !== null && limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000) {
        throw new Error('Limit must be an integer between 0 and 1000');
      }
    }

    if (offset !== null && offset !== undefined) {
      if (!Number.isInteger(offset) || offset < 0) {
        throw new Error('Offset must be a non-negative integer');
      }
    }
  }

  /**
   * Validate app ownership and access
   * @param {number} appId - The app ID
   * @param {number} userId - The user ID
   * @param {object} prisma - Prisma client instance
   * @returns {Promise<boolean>} - True if user has access
   */
  async validateAppAccess(appId, userId, prisma) {
    try {
      const app = await prisma.app.findFirst({
        where: {
          id: parseInt(appId),
          ownerId: parseInt(userId)
        },
        select: { id: true }
      });

      return !!app;
    } catch (error) {
      console.error('Error validating app access:', error);
      return false;
    }
  }

  /**
   * Rate limiting check (basic implementation)
   * @param {string} userId - The user ID
   * @param {string} operation - The operation type
   * @returns {boolean} - True if within rate limits
   */
  checkRateLimit(userId, operation) {
    // Basic rate limiting - in production, use Redis or similar
    const key = `${userId}:${operation}`;
    const now = Date.now();
    
    // Simple in-memory rate limiting (not suitable for production)
    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    const userLimits = this.rateLimitStore.get(key) || [];
    
    // Remove old entries (older than 1 minute)
    const recentRequests = userLimits.filter(timestamp => now - timestamp < 60000);
    
    // Check limits based on operation
    const limits = {
      'db.find': 100,    // 100 queries per minute
      'db.update': 50,   // 50 updates per minute
      'db.create': 20    // 20 creates per minute
    };

    const limit = limits[operation] || 10;
    
    if (recentRequests.length >= limit) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.rateLimitStore.set(key, recentRequests);
    
    return true;
  }
}

module.exports = {
  SecurityValidator
};
