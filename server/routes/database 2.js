const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { exportTableData } = require("../utils/exporters");

const prisma = new PrismaClient();

// ✅ Validate table names to prevent SQL injection
const isValidTableName = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

/**
 * @route   GET /api/database/:appId/tables
 * @desc    Get all tables for an app with metadata + sample data
 * @access  Private
 */
router.get("/:appId/tables", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

    console.log(`[DATABASE] Fetching tables for appId=${appId}`);

    // Verify ownership
    const app = await prisma.app.findFirst({
      where: { id: parseInt(appId), ownerId: userId },
    });
    if (!app)
      return res.status(403).json({ success: false, message: "Access denied to this app" });

    // Get table metadata
    const userTables = await prisma.userTable.findMany({
      where: { appId: parseInt(appId) },
      orderBy: { createdAt: "desc" },
    });

    if (!userTables.length) {
      console.log(`[DATABASE] No tables found for appId=${appId}`);
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
          console.warn(`[DATABASE] Table ${table.tableName} exists in metadata but not in DB`);
        }

        let safeColumns = [];
        try {
          safeColumns =
            typeof table.columns === "string" ? JSON.parse(table.columns) : table.columns;
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

    console.log(`[DATABASE] Tables data prepared for appId=${appId}`);
    res.json({
      success: true,
      tables: tablesWithData.filter(Boolean),
      totalTables: userTables.length,
    });
  } catch (error) {
    console.error(`[DATABASE] Error fetching tables:`, error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get database tables", error: error.message });
  }
});

/**
 * @route   GET /api/database/:appId/tables/:tableName/data
 * @desc    Get paginated data from a specific table
 * @access  Private
 */
router.get("/:appId/tables/:tableName/data", authenticateToken, async (req, res) => {
  try {
    const { appId, tableName } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (!isValidTableName(tableName)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }

    console.log(`[DATABASE] Fetching data for table=${tableName} page=${page} limit=${limit}`);

    // Verify app ownership
    const app = await prisma.app.findFirst({
      where: { id: parseInt(appId), ownerId: userId },
    });
    if (!app)
      return res.status(403).json({ success: false, message: "Access denied to this app" });

    // Verify table metadata
    const userTable = await prisma.userTable.findFirst({
      where: { tableName, appId: parseInt(appId) },
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
  } catch (error) {
    console.error(`[DATABASE] Error fetching table data:`, error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get table data", error: error.message });
  }
});

/**
 * @route   POST /api/database/:appId/tables/:tableName/export
 * @desc    Export table data as CSV or Excel
 * @access  Private
 */
router.post("/:appId/tables/:tableName/export", authenticateToken, async (req, res) => {
  try {
    const { appId, tableName } = req.params;
    const { format = "csv" } = req.body || {};
    const userId = req.user.id;

    console.log(`[DATABASE] Export request for table=${tableName}, format=${format}`);

    // ✅ Validate inputs
    if (!isValidTableName(tableName)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }
    if (!["csv", "excel"].includes(format)) {
      return res.status(400).json({ success: false, message: "Invalid format (use csv or excel)" });
    }

    // ✅ Verify app ownership
    const app = await prisma.app.findFirst({
      where: { id: parseInt(appId), ownerId: userId },
    });
    if (!app)
      return res.status(403).json({ success: false, message: "Access denied to this app" });

    // ✅ Validate table metadata
    const userTable = await prisma.userTable.findFirst({
      where: { tableName, appId: parseInt(appId) },
    });
    if (!userTable)
      return res.status(404).json({ success: false, message: "Table not found in metadata" });

    // ✅ Fetch table data
    const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" ORDER BY id DESC`);
    const columns =
      typeof userTable.columns === "string" ? JSON.parse(userTable.columns) : userTable.columns;

    // ✅ Generate export file
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
    console.error(`[DATABASE] Export error:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to export table",
      error: error.message,
    });
  }
});

module.exports = router;
