const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { exportTableData } = require("../utils/exporters");
const { emitTableCreated, emitDataUpdated } = require("../utils/dbEvents");
const {
  parseAppId,
} = require("../utils/databaseHelpers");

const prisma = new PrismaClient();

// ✅ helper: parse & validate appId once (using imported version)
// Note: parseAppId is imported from databaseHelpers

// ✅ helper: strict app check (404 if not found, 403 if not owner)
// Local version that uses file-scoped prisma instance
async function assertAppAccess(appIdInt, userId) {
  const app = await prisma.app.findUnique({
    where: { id: appIdInt },
    select: { id: true, ownerId: true },
  });
  if (!app) {
    const err = new Error("App not found");
    err.status = 404;
    throw err;
  }
  if (app.ownerId !== userId) {
    const err = new Error("Access denied to this app");
    err.status = 403;
    throw err;
  }
  return app;
}

// Validate table names to prevent SQL injection
const isValidTableName = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

/**
 * @route   GET /api/database/:appId/tables
 * @desc    Get all tables for an app with metadata + sample data
 * @access  Private
 */
router.get("/:appId/tables", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId); // ⬅️ NEW
    const userId = req.user.id;

    if (!appIdInt) {
      // ⬅️ NEW
      return res.status(400).json({ success: false, message: "Invalid appId" });
    }

    console.log(`[DATABASE] Fetching tables for appId=${appIdInt}`);

    // strict app access (404 vs 403)
    await assertAppAccess(appIdInt, userId);

    // Get table metadata only for this app
    const userTables = await prisma.userTable.findMany({
      where: { appId: appIdInt },
      orderBy: { createdAt: "desc" },
    });

    if (!userTables.length) {
      console.log(`[DATABASE] No tables found for appId=${appIdInt}`);
      return res.json({
        success: true,
        tables: [],
        message:
          "No tables found for this app. Create tables using the workflow builder's db.create block.",
        totalTables: 0,
      });
    }

    // Helper function to safely parse JSON columns
    // Columns are stored as JSON stringified array: [{name: "col1", type: "TEXT"}, ...]
    const parseColumns = (columns) => {
      if (typeof columns === "string") {
        try {
          const parsed = JSON.parse(columns);
          // Ensure it's always an array
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn("⚠️ [DATABASE] Failed to parse columns JSON:", e.message);
          return [];
        }
      }
      // If already parsed, ensure it's an array
      if (Array.isArray(columns)) {
        return columns;
      }
      // If it's an object, try to convert to array
      if (typeof columns === "object" && columns !== null) {
        return Object.entries(columns).map(([name, def]) => ({
          name,
          type: def?.type || def || "TEXT",
          required: def?.required || false,
        }));
      }
      return [];
    };

    // Helper function to check if table exists
    const tableExists = async (tableName) => {
      try {
        // Escape table name to prevent SQL injection
        const escapedTableName = tableName.replace(/"/g, '""');
        const result = await prisma.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${escapedTableName}'
          ) as exists`
        );
        return result[0]?.exists || false;
      } catch (error) {
        console.error(
          `Error checking table existence for ${tableName}:`,
          error
        );
        return false;
      }
    };

    // Get table data for each table
    const tablesWithData = await Promise.all(
      userTables.map(async (table) => {
        if (!isValidTableName(table.tableName)) return null;

        let rowCount = 0;
        let sampleData = [];

        try {
          // Check if table actually exists in database
          const exists = await tableExists(table.tableName);

          if (!exists) {
            console.warn(
              `⚠️ [DATABASE] Table "${table.tableName}" registered but doesn't exist in database`
            );
            return {
              id: table.id,
              name: table.tableName,
              columns: parseColumns(table.columns),
              rowCount: 0,
              sampleData: [],
              createdAt: table.createdAt,
              updatedAt: table.updatedAt,
              error: `Table "${table.tableName}" does not exist in database`,
              exists: false,
            };
          }

          // Get row count
          const countResult = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${table.tableName}"`
          );
          rowCount = parseInt(countResult[0]?.count || 0);

          sampleData = await prisma.$queryRawUnsafe(
            `SELECT * FROM "${table.tableName}" ORDER BY id DESC LIMIT 5`
          );
        } catch {
          console.warn(
            `[DATABASE] Table ${table.tableName} exists in metadata but not in DB`
          );
        }

        // Parse columns using the same helper function
        const parseColumns = (columns) => {
          if (typeof columns === "string") {
            try {
              const parsed = JSON.parse(columns);
              return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.warn("⚠️ [DATABASE] Failed to parse columns JSON:", e.message);
              return [];
            }
          }
          if (Array.isArray(columns)) {
            return columns;
          }
          if (typeof columns === "object" && columns !== null) {
            return Object.entries(columns).map(([name, def]) => ({
              name,
              type: def?.type || def || "TEXT",
              required: def?.required || false,
            }));
          }
          return [];
        };
        
        const safeColumns = parseColumns(table.columns);

        return {
          id: table.id,
          name: table.tableName,
          columns: safeColumns,
          rowCount,
          sampleData,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        };
      })
    );

    const filteredTables = tablesWithData.filter(Boolean);
    console.log(
      `[DATABASE] Tables data prepared for appId=${appIdInt}, returning ${filteredTables.length} tables`
    );

    // Set cache headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      tables: filteredTables,
      totalTables: userTables.length,
    });
  } catch (error) {
    const status = error.status || 500; // ⬅️ NEW
    console.error(`[DATABASE] Error fetching tables:`, error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Failed to get database tables",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/database/:appId/tables/create
 * @desc    Create a new table manually from the database page UI
 * @access  Private
 */
router.post("/:appId/tables/create", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);
    const userId = req.user.id;
    const { tableName, columns } = req.body;

    console.log(
      `[DATABASE] Create table request appId=${appIdInt} tableName=${tableName}`
    );

    // Validate inputs
    if (!appIdInt) {
      return res.status(400).json({ success: false, message: "Invalid appId" });
    }
    if (!tableName || !isValidTableName(tableName)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid table name. Use only letters, numbers, and underscores.",
      });
    }
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one column is required",
      });
    }

    // strict app access
    await assertAppAccess(appIdInt, userId);

    // Check if table already exists in metadata
    const existingTable = await prisma.userTable.findFirst({
      where: { tableName, appId: appIdInt },
    });

    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `Table "${tableName}" already exists for this app`,
      });
    }

    // Map column types from UI to PostgreSQL types
    // Handles both UI types (Text, Number, Boolean) and SQL types (TEXT, INTEGER, BOOLEAN)
    const mapColumnTypeToSQL = (type) => {
      if (!type) return "TEXT";
      
      const upperType = type.toUpperCase();
      
      // If already a SQL type, return as-is (but normalize common variations)
      if (upperType === "TEXT" || upperType === "VARCHAR" || upperType.startsWith("VARCHAR")) {
        return upperType.startsWith("VARCHAR") ? type : "TEXT";
      }
      if (upperType === "INTEGER" || upperType === "INT" || upperType === "SERIAL") {
        return "INTEGER";
      }
      if (upperType === "BOOLEAN" || upperType === "BOOL") {
        return "BOOLEAN";
      }
      if (upperType === "DECIMAL" || upperType.startsWith("DECIMAL")) {
        return upperType.startsWith("DECIMAL") ? type : "DECIMAL(10,2)";
      }
      if (upperType === "DATE") {
        return "DATE";
      }
      if (upperType === "TIMESTAMP" || upperType === "DATETIME") {
        return "TIMESTAMP";
      }
      
      // Map UI types to SQL types
      const typeMap = {
        Text: "TEXT",
        Number: "DECIMAL(10,2)",
        Integer: "INTEGER",
        Boolean: "BOOLEAN",
        Date: "DATE",
        DateTime: "TIMESTAMP",
        Email: "VARCHAR(255)",
        Phone: "VARCHAR(20)",
        URL: "TEXT",
      };
      
      return typeMap[type] || typeMap[type.charAt(0).toUpperCase() + type.slice(1)] || "TEXT";
    };
    
    console.log("🔨 [CREATE TABLE] Received columns:", JSON.stringify(columns, null, 2));

    // Build column definitions for CREATE TABLE
    const sqlColumns = ["id SERIAL PRIMARY KEY"];
    const columnDefinitions = [];

    columns.forEach((col) => {
      const columnName = col.name;

      // Skip 'id' column as it's already added as SERIAL PRIMARY KEY
      if (columnName.toLowerCase() === "id") {
        console.log(
          "⚠️  [DATABASE] Skipping 'id' column from user input - already added as PRIMARY KEY"
        );
        return;
      }

      // Validate column name
      if (!isValidTableName(columnName)) {
        throw new Error(`Invalid column name: ${columnName}`);
      }

      const sqlType = mapColumnTypeToSQL(col.type);
      const notNull = col.required ? " NOT NULL" : "";

      sqlColumns.push(`"${columnName}" ${sqlType}${notNull}`);

      columnDefinitions.push({
        name: columnName,
        type: sqlType, // Store SQL type (TEXT, INTEGER, BOOLEAN, etc.)
        required: col.required || false,
        elementId:
          col.elementId || columnName.toLowerCase().replace(/\s+/g, "_"),
        originalName: col.originalName || columnName,
      });
      
      console.log(`🔨 [CREATE TABLE] Column "${columnName}": UI type="${col.type}" -> SQL type="${sqlType}"`);
    });

    // Add metadata columns
    sqlColumns.push("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    sqlColumns.push("updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    sqlColumns.push(`app_id INTEGER NOT NULL DEFAULT ${appIdInt}`);

    // Auto-prepend app prefix to match workflow execution behavior
    // This ensures consistency between UI-created tables and workflow-created tables
    const fullTableName = tableName.startsWith("app_")
      ? tableName
      : `app_${appIdInt}_${tableName}`;

    console.log(
      `🔨 [DATABASE] Creating table: ${tableName} -> ${fullTableName}`
    );

    // Create the physical table
    const createTableSQL = `CREATE TABLE "${fullTableName}" (${sqlColumns.join(
      ", "
    )})`;

    console.log("🔨 [DATABASE] Creating table with SQL:", createTableSQL);

    await prisma.$executeRawUnsafe(createTableSQL);

    // Create index for app_id for better performance
    await prisma.$executeRawUnsafe(
      `CREATE INDEX idx_${fullTableName}_app_id ON "${fullTableName}" (app_id)`
    );

    // Register table in the UserTable metadata (store the full name)
    const createdTableMetadata = await prisma.userTable.create({
      data: {
        appId: appIdInt,
        tableName: fullTableName,
        columns: JSON.stringify(columnDefinitions),
      },
    });

    console.log(
      `✅ [DATABASE] Table "${fullTableName}" created successfully with metadata ID: ${createdTableMetadata.id}`
    );

    // Emit socket event for real-time updates
    emitTableCreated(appIdInt, {
      tableName: fullTableName,
      columns: columnDefinitions,
      createdBy: { id: userId, email: req.user.email },
    });

    res.json({
      success: true,
      message: `Table "${fullTableName}" created successfully`,
      table: {
        name: fullTableName,
        columns: columnDefinitions,
      },
    });
  } catch (error) {
    const status = error.status || 500;
    console.error(`[DATABASE] Error creating table:`, error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Failed to create table",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/database/:appId/tables/:tableName/data
 * @desc    Get paginated data from a specific table
 * @access  Private
 */
router.get(
  "/:appId/tables/:tableName/data",
  authenticateToken,
  async (req, res) => {
    try {
      const appIdInt = parseAppId(req.params.appId); // ⬅️ NEW
      const { tableName } = req.params;
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      if (!appIdInt) {
        // ⬅️ NEW
        return res
          .status(400)
          .json({ success: false, message: "Invalid appId" });
      }
      if (!isValidTableName(tableName)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid table name" });
      }

      console.log(
        `[DATABASE] Fetching data for appId=${appIdInt} table=${tableName} page=${page} limit=${limit}`
      );

      // strict app access
      await assertAppAccess(appIdInt, userId); // ⬅️ NEW

      // Verify table metadata belongs to this app
      const userTable = await prisma.userTable.findFirst({
        where: { tableName, appId: appIdInt },
      });
      if (!userTable)
        return res
          .status(404)
          .json({ success: false, message: "Table not found in metadata" });

      let totalRows = 0;
      let data = [];

      try {
        const countResult = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${tableName}"`
        );
        totalRows = parseInt(countResult[0]?.count || 0);

        data = await prisma.$queryRawUnsafe(
          `SELECT * FROM "${tableName}" ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
        );
      } catch {
        return res.status(404).json({
          success: false,
          message: `Table "${tableName}" exists in metadata but not yet created by workflow`,
        });
      }
      
      //Remove This Due To Duplication Error OF SafeColumn
      // let safeColumns = [];
      // try {
      //   safeColumns =
      //     typeof userTable.columns === "string"
      //       ? JSON.parse(userTable.columns)
      //       : userTable.columns;
      // } catch {
      //   safeColumns = [];
      // }

      console.log(
        `[DATABASE] Data fetched for table=${tableName} successfully`
      );
      console.log("✅ [DATABASE] Table data retrieved successfully");

      // Helper function to safely parse JSON columns
      // Columns are stored as JSON stringified array: [{name: "col1", type: "TEXT"}, ...]
      const parseColumns = (columns) => {
        if (typeof columns === "string") {
          try {
            const parsed = JSON.parse(columns);
            // Ensure it's always an array
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.warn("⚠️ [DATABASE] Failed to parse columns JSON:", e.message);
            return [];
          }
        }
        // If already parsed, ensure it's an array
        if (Array.isArray(columns)) {
          return columns;
        }
        // If it's an object, try to convert to array
        if (typeof columns === "object" && columns !== null) {
          return Object.entries(columns).map(([name, def]) => ({
            name,
            type: def?.type || def || "TEXT",
            required: def?.required || false,
          }));
        }
        return [];
      };

      const safeColumns = parseColumns(userTable.columns);
      
      // Debug log to verify columns structure
      console.log(`📊 [DATABASE] Raw userTable.columns (type: ${typeof userTable.columns}):`, 
        typeof userTable.columns === 'string' ? userTable.columns : JSON.stringify(userTable.columns));
      console.log(`📊 [DATABASE] Parsed columns for ${tableName}:`, JSON.stringify(safeColumns, null, 2));
      console.log(`📊 [DATABASE] First column type:`, safeColumns[0]?.type, `(typeof: ${typeof safeColumns[0]?.type})`);

      // Set cache headers to prevent caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          totalRows,
          totalPages: Math.ceil(totalRows / limit),
        },
        columns: safeColumns,
      });

      // Phase-2 prep: emit read
      emitDataUpdated(appIdInt, {
        tableName,
        action: "read",
        rowsAffected: data.length,
        preview: data.slice(0, 5),
      });
    } catch (error) {
      const status = error.status || 500; // ⬅️ NEW
      console.error(`[DATABASE] Error fetching table data:`, error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Failed to get table data",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/database/:appId/tables/:tableName/records
 * @desc    Insert a new record into a table
 * @access  Private
 */
router.post(
  "/:appId/tables/:tableName/records",
  authenticateToken,
  async (req, res) => {
    try {
      const appIdInt = parseAppId(req.params.appId);
      const { tableName } = req.params;
      const userId = req.user.id;
      const recordData = req.body;

      console.log(
        `[DATABASE] Insert record request appId=${appIdInt} table=${tableName}`
      );

      // Validate inputs
      if (!appIdInt) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid appId" });
      }
      if (!isValidTableName(tableName)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid table name" });
      }
      if (!recordData || Object.keys(recordData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Record data is required" });
      }

      // Verify app access
      await assertAppAccess(appIdInt, userId);

      // Verify table metadata belongs to this app
      const userTable = await prisma.userTable.findFirst({
        where: { tableName, appId: appIdInt },
      });
      if (!userTable) {
        return res
          .status(404)
          .json({ success: false, message: "Table not found in metadata" });
      }

      // Parse table columns
      let tableColumns = [];
      try {
        tableColumns =
          typeof userTable.columns === "string"
            ? JSON.parse(userTable.columns)
            : userTable.columns;
      } catch {
        return res.status(500).json({
          success: false,
          message: "Failed to parse table column metadata",
        });
      }

      // Build INSERT query
      const insertColumns = [];
      const insertValues = [];
      const insertParams = [];
      let paramIndex = 1;

      // First, ensure all required columns are present (especially booleans that might be false)
      // For boolean columns that are NOT NULL, if they're missing from recordData, default to false
      for (const columnDef of tableColumns) {
        if (
          columnDef.name === "id" ||
          columnDef.name === "created_at" ||
          columnDef.name === "updated_at" ||
          columnDef.name === "app_id"
        ) {
          continue;
        }
        
        const colType = (columnDef.type || "").toUpperCase();
        // If it's a boolean column and not in recordData, add it as false
        if ((colType.includes("BOOLEAN") || colType.includes("BOOL")) && !(columnDef.name in recordData)) {
          recordData[columnDef.name] = false;
        }
      }

      // Process each field in recordData
      for (const [key, value] of Object.entries(recordData)) {
        // Skip id, created_at, updated_at, app_id as they are auto-generated
        if (
          key === "id" ||
          key === "created_at" ||
          key === "updated_at" ||
          key === "app_id"
        ) {
          continue;
        }

        // Find column definition
        const columnDef = tableColumns.find((col) => col.name === key);
        if (!columnDef) {
          console.warn(
            `[DATABASE] Column "${key}" not found in table metadata, skipping`
          );
          continue;
        }

        insertColumns.push(`"${key}"`);
        insertValues.push(`$${paramIndex}`);

        // Convert value based on column type (handle both SQL types and UI types)
        let processedValue = value;
        const colType = (columnDef.type || "").toUpperCase();
        
        if (colType.includes("INTEGER") || colType.includes("INT") || colType.includes("DECIMAL") || colType.includes("NUMERIC") || colType.includes("NUMBER")) {
          // Number types
          processedValue =
            value === "" || value === null || value === undefined ? null : Number(value);
        } else if (colType.includes("BOOLEAN") || colType.includes("BOOL")) {
          // Boolean types - ensure we convert to actual boolean
          // Handle both boolean and string representations from frontend
          if (value === true || value === "true" || value === 1 || value === "1") {
            processedValue = true;
          } else if (value === false || value === "false" || value === 0 || value === "0" || value === "" || value === null) {
            processedValue = false;
          } else {
            // Fallback: convert truthy/falsy values
            processedValue = Boolean(value);
          }
        } else if (colType.includes("DATE") || colType.includes("TIMESTAMP") || colType.includes("DATETIME")) {
          // Date/Time types
          processedValue = value && value !== "" ? new Date(value) : null;
        } else {
          // Text, String, VARCHAR, etc.
          processedValue = value === null || value === undefined ? null : String(value);
        }

        console.log(`🔍 [DATABASE] Column: ${key}, Type: ${colType}, Raw value: ${value} (${typeof value}), Processed: ${processedValue} (${typeof processedValue})`);
        insertParams.push(processedValue);
        paramIndex++;
      }

      // Add app_id
      insertColumns.push('"app_id"');
      insertValues.push(`$${paramIndex}`);
      insertParams.push(appIdInt);

      if (insertColumns.length === 1) {
        // Only app_id, no actual data
        return res.status(400).json({
          success: false,
          message: "No valid columns provided for insert",
        });
      }

      // Build SQL with properly escaped values
      const escapedValues = insertParams.map((param) => {
        const value = param;
        if (value === null || value === undefined) {
          return 'NULL';
        }
        if (typeof value === 'boolean') {
          // PostgreSQL boolean literals (no quotes)
          return value ? 'TRUE' : 'FALSE';
        }
        if (value instanceof Date) {
          // PostgreSQL timestamp format
          return `'${value.toISOString()}'::timestamp`;
        }
        if (typeof value === 'number') {
          return String(value);
        }
        // Escape single quotes for strings (PostgreSQL style)
        return `'${String(value).replace(/'/g, "''")}'`;
      });

      const insertSQL = `INSERT INTO "${tableName}" (${insertColumns.join(
        ", "
      )}) VALUES (${escapedValues.join(", ")}) RETURNING *`;

      console.log("💾 [DATABASE] Final SQL:", insertSQL);
      console.log("💾 [DATABASE] Escaped values:", escapedValues);
      console.log("💾 [DATABASE] Insert params (raw):", insertParams);
      
      const insertResult = await prisma.$queryRawUnsafe(insertSQL);
      const insertedRecord = insertResult[0];

      console.log(
        "✅ [DATABASE] Record inserted successfully, ID:",
        insertedRecord?.id
      );

      // Emit socket event for real-time updates
      emitDataUpdated(appIdInt, {
        tableName,
        action: "insert",
        rowsAffected: 1,
        preview: [insertedRecord],
      });

      // Trigger workflows with onRecordCreate triggers (async, don't block response)
      try {
        const workflows = await prisma.workflow.findMany({
          where: { appId: appIdInt },
        });

        for (const wf of workflows) {
          let nodes = wf.nodes;
          let edges = wf.edges;
          
          // Parse JSON if stored as string
          if (typeof nodes === "string") {
            try {
              nodes = JSON.parse(nodes);
            } catch (e) {
              console.warn(`⚠️ [DATABASE] Failed to parse workflow nodes for workflow ${wf.id}:`, e.message);
              nodes = [];
            }
          }
          if (typeof edges === "string") {
            try {
              edges = JSON.parse(edges);
            } catch (e) {
              console.warn(`⚠️ [DATABASE] Failed to parse workflow edges for workflow ${wf.id}:`, e.message);
              edges = [];
            }
          }

          // Find onRecordCreate trigger nodes for this table
          const recordCreateTriggers = (nodes || []).filter(
            (node) =>
              node.data?.category === "Triggers" &&
              node.data?.label === "onRecordCreate" &&
              node.data?.tableName === tableName &&
              node.data?.enabled !== false
          );

          if (recordCreateTriggers.length > 0) {
            console.log(
              `📝 [DATABASE] Found ${recordCreateTriggers.length} onRecordCreate trigger(s) for table ${tableName}`
            );

            // Create context with the inserted record
            const initialContext = {
              createdRecord: insertedRecord,
              record: insertedRecord,
              recordData: insertedRecord,
              triggerTableName: tableName,
              tableName: tableName,
              workflowId: wf.id,
              // Also spread record fields directly into context
              ...insertedRecord,
            };

            // Enqueue workflow for processing
            const { enqueueWorkflow } = require("../utils/workflow-queue");
            await enqueueWorkflow(
              nodes || [],
              edges || [],
              initialContext,
              appIdInt,
              userId
            );

            console.log(
              `✅ [DATABASE] Enqueued workflow ${wf.id} for onRecordCreate trigger`
            );
          }
        }
      } catch (workflowError) {
        // Don't fail the insert if workflow triggering fails
        console.error(
          "⚠️ [DATABASE] Failed to trigger workflows after insert:",
          workflowError.message || workflowError
        );
      }

      res.json({
        success: true,
        message: "Record inserted successfully",
        record: insertedRecord,
      });
    } catch (error) {
      const status = error.status || 500;
      console.error(`[DATABASE] Error inserting record:`, error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Failed to insert record",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/database/:appId/tables/:tableName/export
 * @desc    Export table data as CSV or Excel
 * @access  Private
 */
router.post(
  "/:appId/tables/:tableName/export",
  authenticateToken,
  async (req, res) => {
    try {
      const appIdInt = parseAppId(req.params.appId); // ⬅️ NEW
      const { tableName } = req.params;
      const { format = "csv" } = req.body || {};
      const userId = req.user.id;

      console.log(
        `[DATABASE] Export request appId=${appIdInt} table=${tableName} format=${format}`
      );

      if (!appIdInt) {
        // ⬅️ NEW
        return res
          .status(400)
          .json({ success: false, message: "Invalid appId" });
      }
      if (!isValidTableName(tableName)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid table name" });
      }
      if (!["csv", "excel"].includes(format)) {
        return res.status(400).json({
          success: false,
          message: "Invalid format (use csv or excel)",
        });
      }

      // strict app access
      await assertAppAccess(appIdInt, userId); // ⬅️ NEW

      // Validate table metadata
      const userTable = await prisma.userTable.findFirst({
        where: { tableName, appId: appIdInt },
      });
      if (!userTable)
        return res
          .status(404)
          .json({ success: false, message: "Table not found in metadata" });

      // Fetch table data (global physical table)
      const data = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" ORDER BY id DESC`
      );
      const columns =
        typeof userTable.columns === "string"
          ? JSON.parse(userTable.columns)
          : userTable.columns;

      // Generate export file
      const buffer = await exportTableData(data, columns, format);

      if (format === "csv") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${tableName}.csv"`
        );
        res.setHeader("Content-Type", "text/csv");
      } else {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${tableName}.xlsx"`
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      }

      console.log(`[DATABASE] Export completed successfully for ${tableName}`);
      res.send(buffer);
    } catch (error) {
      const status = error.status || 500; // ⬅️ NEW
      console.error(`[DATABASE] Export error:`, error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Failed to export table",
        error: error.message,
      });
    }
  }
);

/**
 * Debug route to test socket events manually
 * @route   DELETE /api/database/:appId/tables/:tableName
 * @desc    Delete a table from the database
 * @access  Private
 */
router.delete(
  "/:appId/tables/:tableName",
  authenticateToken,
  async (req, res) => {
    try {
      const appIdInt = parseAppId(req.params.appId);
      const { tableName } = req.params;
      const userId = req.user.id;

      // Validate inputs
      if (!appIdInt) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid appId" });
      }
      if (!isValidTableName(tableName)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid table name" });
      }

      console.log(
        `[DATABASE] Deleting table: ${tableName} for appId=${appIdInt}`
      );

      // Verify app access
      await assertAppAccess(appIdInt, userId);

      // Verify table metadata belongs to this app
      const userTable = await prisma.userTable.findFirst({
        where: { tableName, appId: appIdInt },
      });
      if (!userTable) {
        return res
          .status(404)
          .json({ success: false, message: "Table not found in metadata" });
      }

      // Drop the actual table from the database
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}"`);
        console.log(`[DATABASE] Table "${tableName}" dropped successfully`);
      } catch (error) {
        console.error(`[DATABASE] Error dropping table "${tableName}":`, error);
        // Continue even if table doesn't exist in database
      }

      // Delete the table metadata
      await prisma.userTable.delete({
        where: { id: userTable.id },
      });

      console.log(`[DATABASE] Table metadata deleted for "${tableName}"`);

      // Emit socket event for real-time updates
      emitTableCreated(appIdInt, {
        tableName,
        action: "deleted",
        deletedBy: { id: userId },
      });

      res.json({
        success: true,
        message: "Table deleted successfully",
        tableName,
      });
    } catch (error) {
      const status = error.status || 500;
      console.error(`[DATABASE] Error deleting table:`, error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Failed to delete table",
        error: error.message,
      });
    }
  }
);

/**
 * @route POST /api/database/:appId/debug/broadcast
 */
router.post(
  "/:appId/debug/broadcast",
  authenticateToken,
  authenticateToken,
  (req, res, next) => {
    if (req.is("text/plain")) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON body" });
      }
    }
    next();
  },
  express.json(),
  async (req, res) => {
    console.log("DEBUG BODY:", req.headers["content-type"], req.body);

    try {
      const appIdInt = parseAppId(req.params.appId); // ⬅️ NEW
      if (!appIdInt)
        return res
          .status(400)
          .json({ success: false, message: "Invalid appId" });
      const {
        type = "updated",
        tableName = "users",
        action = "update",
        rowsAffected = 1,
        preview = [],
        columns = [],
      } = req.body;

    // ensure access before emitting
    await assertAppAccess(appIdInt, req.user.id);

      let payload;
      if (type === "created") {
        payload = emitTableCreated(appIdInt, {
          tableName,
          columns: columns.length
            ? columns
            : [
                { name: "id", type: "Int" },
                { name: "name", type: "String" },
              ],
          createdBy: { id: req.user.id, email: req.user.email },
        });
      } else {
        payload = emitDataUpdated(appIdInt, {
          tableName,
          action,
          rowsAffected,
          preview: preview.length ? preview : [{ id: 1, name: "Dynamic Test" }],
        });
      }

      res.json({ success: true, emitted: payload });
    } catch (error) {
      const status = error.status || 500; // ⬅️ NEW
      console.error("[DATABASE DEBUG] Broadcast failed:", error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Socket broadcast failed",
        error: error.message,
      });
    }
  }
);
/**
 * @route   POST /api/database/:appId/tables/:tableName/export
 * @desc    Export table data as CSV or Excel
 * @access  Private
 */
router.post(
  "/:appId/tables/:tableName/export",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, tableName } = req.params;
      const { format = "csv" } = req.body || {};
      const userId = req.user.id;

      console.log(
        `[DATABASE] Export request for table=${tableName}, format=${format}`
      );

      // ✅ Validate inputs
      if (!isValidTableName(tableName)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid table name" });
      }
      if (!["csv", "excel"].includes(format)) {
        return res.status(400).json({
          success: false,
          message: "Invalid format (use csv or excel)",
        });
      }

      // ✅ Verify app ownership
      const app = await prisma.app.findFirst({
        where: { id: parseInt(appId), ownerId: userId },
      });
      if (!app)
        return res
          .status(403)
          .json({ success: false, message: "Access denied to this app" });

      // ✅ Validate table metadata
      const userTable = await prisma.userTable.findFirst({
        where: { tableName, appId: parseInt(appId) },
      });
      if (!userTable)
        return res
          .status(404)
          .json({ success: false, message: "Table not found in metadata" });

      // ✅ Check if table actually exists in database
      const escapedTableName = tableName.replace(/"/g, '""');
      const tableExistsResult = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${escapedTableName}'
      ) as exists`
      );

      const exists = tableExistsResult[0]?.exists || false;
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: `Table "${tableName}" is registered but does not exist in database`,
        });
      }

      // ✅ Fetch table data
      const data = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" ORDER BY id DESC`
      );

      // ✅ Parse and transform columns format
      let columnsObj =
        typeof userTable.columns === "string"
          ? JSON.parse(userTable.columns)
          : userTable.columns;

      // Transform from object format to array format expected by exportTableData
      // Input: { id: {...}, firstName: {...}, ... }
      // Output: [{ name: 'id', ... }, { name: 'firstName', ... }, ... ]
      const columns = Object.entries(columnsObj).map(([name, def]) => ({
        name,
        ...def,
      }));

      // ✅ Generate export file
      const buffer = await exportTableData(data, columns, format);

      if (format === "csv") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${tableName}.csv"`
        );
        res.setHeader("Content-Type", "text/csv");
      } else {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${tableName}.xlsx"`
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      }

      console.log(`[DATABASE] Export completed successfully for ${tableName}`);
      res.send(buffer);
    } catch (error) {
      console.error(`[DATABASE] Export error:`, error);
      res.status(500).json({
        success: false,
        message: "Failed to export table",
        error: error.message,
      });
    }
  }
);
module.exports = router;


