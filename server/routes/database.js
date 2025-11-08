const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { exportTableData } = require("../utils/exporters");
const { emitTableCreated, emitDataUpdated } = require("../utils/dbEvents");

const prisma = new PrismaClient();

// Validate table names to prevent SQL injection
const isValidTableName = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

// ✅ helper: parse & validate appId once
function parseAppId(appIdParam) {                       // ⬅️ NEW
  const id = Number(appIdParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// ✅ helper: strict app check (404 if not found, 403 if not owner)
async function assertAppAccess(appIdInt, userId) {      // ⬅️ NEW
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

/**
 * @route   GET /api/database/:appId/tables
 * @desc    Get all tables for an app with metadata + sample data
 * @access  Private
 */
router.get("/:appId/tables", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);       // ⬅️ NEW
    const userId = req.user.id;

    if (!appIdInt) {                                     // ⬅️ NEW
      return res.status(400).json({ success: false, message: "Invalid appId" });
    }

    console.log(`[DATABASE] Fetching tables for appId=${appIdInt}`);

    // strict app access (404 vs 403)
    await assertAppAccess(appIdInt, userId);             // ⬅️ NEW

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

    // Build table data with sample rows
    const tablesWithData = await Promise.all(
      userTables.map(async (table) => {
        if (!isValidTableName(table.tableName)) return null;

        let rowCount = 0;
        let sampleData = [];

        try {
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

        let safeColumns = [];
        try {
          safeColumns =
            typeof table.columns === "string"
              ? JSON.parse(table.columns)
              : table.columns;
        } catch {
          safeColumns = [];
        }

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

    console.log(`[DATABASE] Tables data prepared for appId=${appIdInt}`);
    res.json({
      success: true,
      tables: tablesWithData.filter(Boolean),
      totalTables: userTables.length,
    });
  } catch (error) {
    const status = error.status || 500;                  // ⬅️ NEW
    console.error(`[DATABASE] Error fetching tables:`, error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Failed to get database tables",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/database/:appId/tables/:tableName/data
 * @desc    Get paginated data from a specific table
 * @access  Private
 */
router.get("/:appId/tables/:tableName/data", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);       // ⬅️ NEW
    const { tableName } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (!appIdInt) {                                     // ⬅️ NEW
      return res.status(400).json({ success: false, message: "Invalid appId" });
    }
    if (!isValidTableName(tableName)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }

    console.log(`[DATABASE] Fetching data for appId=${appIdInt} table=${tableName} page=${page} limit=${limit}`);

    // strict app access
    await assertAppAccess(appIdInt, userId);             // ⬅️ NEW

    // Verify table metadata belongs to this app
    const userTable = await prisma.userTable.findFirst({
      where: { tableName, appId: appIdInt },
    });
    if (!userTable)
      return res.status(404).json({ success: false, message: "Table not found in metadata" });

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

    let safeColumns = [];
    try {
      safeColumns =
        typeof userTable.columns === "string" ? JSON.parse(userTable.columns) : userTable.columns;
    } catch {
      safeColumns = [];
    }

    console.log(`[DATABASE] Data fetched for table=${tableName} successfully`);
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
    const status = error.status || 500;                  // ⬅️ NEW
    console.error(`[DATABASE] Error fetching table data:`, error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Failed to get table data",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/database/:appId/tables/:tableName/export
 * @desc    Export table data as CSV or Excel
 * @access  Private
 */
router.post("/:appId/tables/:tableName/export", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);       // ⬅️ NEW
    const { tableName } = req.params;
    const { format = "csv" } = req.body || {};
    const userId = req.user.id;

    console.log(`[DATABASE] Export request appId=${appIdInt} table=${tableName} format=${format}`);

    if (!appIdInt) {                                     // ⬅️ NEW
      return res.status(400).json({ success: false, message: "Invalid appId" });
    }
    if (!isValidTableName(tableName)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }
    if (!["csv", "excel"].includes(format)) {
      return res.status(400).json({ success: false, message: "Invalid format (use csv or excel)" });
    }

    // strict app access
    await assertAppAccess(appIdInt, userId);             // ⬅️ NEW

    // Validate table metadata
    const userTable = await prisma.userTable.findFirst({
      where: { tableName, appId: appIdInt },
    });
    if (!userTable)
      return res.status(404).json({ success: false, message: "Table not found in metadata" });

    // Fetch table data (global physical table)
    const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" ORDER BY id DESC`);
    const columns =
      typeof userTable.columns === "string" ? JSON.parse(userTable.columns) : userTable.columns;

    // Generate export file
    const buffer = await exportTableData(data, columns, format);

    if (format === "csv") {
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
      res.setHeader("Content-Type", "text/csv");
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.xlsx"`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    }

    console.log(`[DATABASE] Export completed successfully for ${tableName}`);
    res.send(buffer);
  } catch (error) {
    const status = error.status || 500;                  // ⬅️ NEW
    console.error(`[DATABASE] Export error:`, error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Failed to export table",
      error: error.message,
    });
  }
});

/**
 * Debug route to test socket events manually
 * @route POST /api/database/:appId/debug/broadcast
 */
router.post("/:appId/debug/broadcast", authenticateToken, 
  authenticateToken,
  (req, res, next) => {
    if (req.is("text/plain")) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid JSON body" });
      }
    }
    next();
  },
  express.json(),async (req, res) => {
  console.log('DEBUG BODY:', req.headers['content-type'], req.body);

  try {
    const appIdInt = parseAppId(req.params.appId);       // ⬅️ NEW
    if (!appIdInt) return res.status(400).json({ success: false, message: "Invalid appId" });
    const { type = "updated", tableName = "users", action = "update", rowsAffected = 1, preview = [], columns = [] } = req.body;

    // ensure access before emitting
    await assertAppAccess(appIdInt, req.user.id);        // ⬅️ NEW

    let payload;
    if (type === "created") {
      payload = emitTableCreated(appIdInt, {
        tableName,
        columns: columns.length ? columns : [
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
    const status = error.status || 500;                  // ⬅️ NEW
    console.error("[DATABASE DEBUG] Broadcast failed:", error);
    res.status(status).json({
      success: false,
      message: error.status ? error.message : "Socket broadcast failed",
      error: error.message,
    });
  }
});

module.exports = router;
