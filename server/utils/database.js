const { PrismaClient } = require("@prisma/client");

/**
 * SafeQueryBuilder - A secure query builder class to prevent SQL injection
 * and provide type-safe database operations for dynamic tables
 */
class SafeQueryBuilder {
  constructor() {
    this.params = [];
    this.paramIndex = 1;
    this.whereConditions = [];
    this.orderByFields = [];
    this.limitValue = null;
    this.offsetValue = null;
  }

  /**
   * Add a parameter to the query and return its placeholder
   * @param {any} value - The value to add as a parameter
   * @returns {string} - The parameter placeholder (e.g., $1, $2)
   */
  addParam(value) {
    this.params.push(value);
    return `$${this.paramIndex++}`;
  }

  /**
   * Validate and sanitize table name
   * @param {string} tableName - The table name to validate
   * @returns {string} - The sanitized table name
   * @throws {Error} - If table name is invalid
   */
  validateTableName(tableName) {
    if (!tableName || typeof tableName !== "string") {
      throw new Error("Table name is required and must be a string");
    }

    // Allow only alphanumeric characters, underscores, and must start with letter
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(
        `Invalid table name: ${tableName}. Must start with letter and contain only alphanumeric characters and underscores.`
      );
    }

    // Prevent SQL keywords and dangerous names
    const forbiddenNames = [
      "select",
      "insert",
      "update",
      "delete",
      "drop",
      "create",
      "alter",
      "truncate",
      "union",
      "exec",
      "execute",
      "sp_",
      "xp_",
      "information_schema",
      "pg_",
      "sys",
    ];

    if (
      forbiddenNames.some((forbidden) =>
        tableName.toLowerCase().includes(forbidden)
      )
    ) {
      throw new Error(`Table name contains forbidden keywords: ${tableName}`);
    }

    return tableName;
  }

  /**
   * Validate and sanitize column name
   * @param {string} columnName - The column name to validate
   * @returns {string} - The sanitized column name
   * @throws {Error} - If column name is invalid
   */
  validateColumnName(columnName) {
    if (!columnName || typeof columnName !== "string") {
      throw new Error("Column name is required and must be a string");
    }

    // Allow only alphanumeric characters, underscores, and must start with letter
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new Error(
        `Invalid column name: ${columnName}. Must start with letter and contain only alphanumeric characters and underscores.`
      );
    }

    return `"${columnName}"`; // Quote for safety
  }

  /**
   * Validate SQL operator
   * @param {string} operator - The operator to validate
   * @returns {string} - The validated operator
   * @throws {Error} - If operator is invalid
   */
  validateOperator(operator) {
    const allowedOperators = [
      "=",
      "!=",
      "<>",
      ">",
      "<",
      ">=",
      "<=",
      "LIKE",
      "ILIKE",
      "IN",
      "NOT IN",
      "IS NULL",
      "IS NOT NULL",
    ];

    if (!allowedOperators.includes(operator.toUpperCase())) {
      throw new Error(
        `Invalid operator: ${operator}. Allowed operators: ${allowedOperators.join(
          ", "
        )}`
      );
    }

    return operator.toUpperCase();
  }

  /**
   * Add a WHERE condition
   * @param {string} field - The field name
   * @param {string} operator - The comparison operator
   * @param {any} value - The value to compare (null for IS NULL/IS NOT NULL)
   * @param {string} logic - The logic operator (AND/OR)
   */
  addWhere(field, operator, value, logic = "AND") {
    const safeField = this.validateColumnName(field);
    const safeOperator = this.validateOperator(operator);

    let condition;
    if (safeOperator === "IS NULL" || safeOperator === "IS NOT NULL") {
      condition = `${safeField} ${safeOperator}`;
    } else if (safeOperator === "IN" || safeOperator === "NOT IN") {
      if (!Array.isArray(value)) {
        throw new Error(`${safeOperator} operator requires an array value`);
      }
      const placeholders = value.map((v) => this.addParam(v)).join(", ");
      condition = `${safeField} ${safeOperator} (${placeholders})`;
    } else {
      const paramPlaceholder = this.addParam(value);
      condition = `${safeField} ${safeOperator} ${paramPlaceholder}`;
    }

    this.whereConditions.push({
      condition,
      logic: logic.toUpperCase(),
    });
  }

  /**
   * Add ORDER BY clause
   * @param {string} field - The field to order by
   * @param {string} direction - ASC or DESC
   */
  addOrderBy(field, direction = "ASC") {
    const safeField = this.validateColumnName(field);
    const safeDirection = direction.toUpperCase();

    if (!["ASC", "DESC"].includes(safeDirection)) {
      throw new Error(
        `Invalid order direction: ${direction}. Must be ASC or DESC.`
      );
    }

    this.orderByFields.push(`${safeField} ${safeDirection}`);
  }

  /**
   * Set LIMIT clause
   * @param {number} limit - The maximum number of rows to return
   */
  setLimit(limit) {
    if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
      throw new Error("Limit must be a non-negative integer");
    }
    this.limitValue = limit;
  }

  /**
   * Set OFFSET clause
   * @param {number} offset - The number of rows to skip
   */
  setOffset(offset) {
    if (offset !== null && (!Number.isInteger(offset) || offset < 0)) {
      throw new Error("Offset must be a non-negative integer");
    }
    this.offsetValue = offset;
  }

  /**
   * Build WHERE clause from conditions
   * @returns {string} - The WHERE clause
   */
  buildWhereClause() {
    if (this.whereConditions.length === 0) {
      return "";
    }

    let whereClause = "WHERE ";
    this.whereConditions.forEach((condition, index) => {
      if (index > 0) {
        whereClause += ` ${condition.logic} `;
      }
      whereClause += condition.condition;
    });

    return whereClause;
  }

  /**
   * Build ORDER BY clause
   * @returns {string} - The ORDER BY clause
   */
  buildOrderByClause() {
    if (this.orderByFields.length === 0) {
      return "";
    }
    return `ORDER BY ${this.orderByFields.join(", ")}`;
  }

  /**
   * Build LIMIT and OFFSET clause
   * @returns {string} - The LIMIT/OFFSET clause
   */
  buildLimitClause() {
    let clause = "";
    if (this.limitValue !== null) {
      clause += `LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== null) {
      clause += ` OFFSET ${this.offsetValue}`;
    }
    return clause;
  }

  /**
   * Build a SELECT query
   * @param {string} tableName - The table to select from
   * @param {string[]} columns - The columns to select (default: ['*'])
   * @returns {object} - Object with query string and parameters
   */
  buildSelectQuery(tableName, columns = ["*"]) {
    const safeTableName = this.validateTableName(tableName);

    // Validate columns
    const safeColumns = columns
      .map((col) => {
        if (col === "*") return "*";
        return this.validateColumnName(col);
      })
      .join(", ");

    const whereClause = this.buildWhereClause();
    const orderByClause = this.buildOrderByClause();
    const limitClause = this.buildLimitClause();

    const query = [
      `SELECT ${safeColumns}`,
      `FROM "${safeTableName}"`,
      whereClause,
      orderByClause,
      limitClause,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      query: query.trim(),
      params: this.params,
    };
  }

  /**
   * Build an UPDATE query
   * @param {string} tableName - The table to update
   * @param {object} updateData - The data to update {column: value}
   * @returns {object} - Object with query string and parameters
   */
  buildUpdateQuery(tableName, updateData) {
    const safeTableName = this.validateTableName(tableName);

    if (
      !updateData ||
      typeof updateData !== "object" ||
      Object.keys(updateData).length === 0
    ) {
      throw new Error("Update data is required and must be a non-empty object");
    }

    // Build SET clause
    const setClause = Object.entries(updateData)
      .map(([column, value]) => {
        const safeColumn = this.validateColumnName(column);
        const paramPlaceholder = this.addParam(value);
        return `${safeColumn} = ${paramPlaceholder}`;
      })
      .join(", ");

    const whereClause = this.buildWhereClause();

    if (!whereClause) {
      throw new Error("UPDATE queries must have WHERE conditions for safety");
    }

    const query = [
      `UPDATE "${safeTableName}"`,
      `SET ${setClause}`,
      whereClause,
      "RETURNING *",
    ].join(" ");

    return {
      query: query.trim(),
      params: this.params,
    };
  }

  /**
   * Reset the query builder for reuse
   */
  reset() {
    this.params = [];
    this.paramIndex = 1;
    this.whereConditions = [];
    this.orderByFields = [];
    this.limitValue = null;
    this.offsetValue = null;
  }
}

/**
 * Database utility functions for schema discovery and type conversion
 */
class DatabaseUtils {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Discover table schema from information_schema
   * @param {string} tableName - The table name to discover
   * @returns {Promise<Array>} - Array of column information
   */
  async discoverTableSchema(tableName) {
    try {
      const columns = await this.prisma.$queryRaw`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;

      return columns.map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
        default: col.column_default,
        maxLength: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale,
      }));
    } catch (error) {
      console.error(`Error discovering schema for table ${tableName}:`, error);
      throw new Error(`Failed to discover table schema: ${error.message}`);
    }
  }

  /**
   * Check if a table exists
   * @param {string} tableName - The table name to check
   * @returns {Promise<boolean>} - True if table exists
   */
  async tableExists(tableName) {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${tableName}
        );
      `;
      return result[0].exists;
    } catch (error) {
      console.error(`Error checking table existence for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get all user-created tables for an app
   * @param {number} appId - The app ID
   * @returns {Promise<Array>} - Array of table information
   */
  async getUserTables(appId) {
    try {
      const tables = await this.prisma.userTable.findMany({
        where: { appId: parseInt(appId) },
        orderBy: { createdAt: "desc" },
      });

      return tables.map((table) => ({
        id: table.id,
        name: table.tableName,
        columns: JSON.parse(table.columns),
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      }));
    } catch (error) {
      console.error(`Error getting user tables for app ${appId}:`, error);
      throw new Error(`Failed to get user tables: ${error.message}`);
    }
  }

  /**
   * Convert value to appropriate type based on column type
   * @param {any} value - The value to convert
   * @param {string} columnType - The PostgreSQL column type
   * @returns {any} - The converted value
   */
  convertValue(value, columnType) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    switch (columnType.toLowerCase()) {
      case "integer":
      case "bigint":
      case "smallint":
        const intValue = parseInt(value);
        return isNaN(intValue) ? null : intValue;

      case "numeric":
      case "decimal":
      case "real":
      case "double precision":
        const floatValue = parseFloat(value);
        return isNaN(floatValue) ? null : floatValue;

      case "boolean":
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          return value.toLowerCase() === "true" || value === "1";
        }
        return Boolean(value);

      case "timestamp":
      case "timestamp with time zone":
      case "timestamp without time zone":
      case "date":
        try {
          return new Date(value);
        } catch (error) {
          return null;
        }

      case "json":
      case "jsonb":
        if (typeof value === "object") return value;
        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }

      case "text":
      case "varchar":
      case "character varying":
      case "char":
      case "character":
      default:
        return String(value);
    }
  }

  /**
   * Validate data against table schema
   * @param {object} data - The data to validate
   * @param {Array} schema - The table schema
   * @returns {object} - Validated and converted data
   */
  validateAndConvertData(data, schema) {
    const validatedData = {};
    const errors = [];

    for (const [key, value] of Object.entries(data)) {
      const column = schema.find((col) => col.name === key);

      if (!column) {
        errors.push(`Unknown column: ${key}`);
        continue;
      }

      // Check for required fields
      if (
        !column.nullable &&
        (value === null || value === undefined || value === "")
      ) {
        errors.push(`Column ${key} is required`);
        continue;
      }

      // Convert value to appropriate type
      try {
        validatedData[key] = this.convertValue(value, column.type);
      } catch (error) {
        errors.push(`Invalid value for column ${key}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Data validation failed: ${errors.join(", ")}`);
    }

    return validatedData;
  }

  /**
   * Record query performance metrics
   * @param {number} appId - The app ID
   * @param {string} tableName - The table name
   * @param {string} queryType - The type of query (find, update, create, delete)
   * @param {number} executionTimeMs - Execution time in milliseconds
   * @param {number} rowCount - Number of rows affected/returned
   */
  async recordQueryPerformance(
    appId,
    tableName,
    queryType,
    executionTimeMs,
    rowCount
  ) {
    try {
      await this.prisma.queryPerformance.create({
        data: {
          appId: parseInt(appId),
          tableName,
          queryType,
          executionTimeMs,
          rowCount,
        },
      });
    } catch (error) {
      // Don't throw error for performance logging failures
      console.warn(`Failed to record query performance:`, error.message);
    }
  }
}

module.exports = {
  SafeQueryBuilder,
  DatabaseUtils,
};
