const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const prisma = new PrismaClient();

/**
 * @route   GET /api/database/:appId/tables
 * @desc    Get all user-created tables for an app
 * @access  Private
 */
router.get("/:appId/tables", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

    console.log("🗄️ [DATABASE] Getting tables for app:", appId);

    // Verify user has access to this app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId,
      },
    });

    if (!app) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this app",
      });
    }

    // Get all user tables for this app
    const userTables = await prisma.userTable.findMany({
      where: { appId: parseInt(appId) },
      orderBy: { createdAt: "desc" },
    });

    console.log("📋 [DATABASE] Found tables:", userTables.length);
    console.log("📋 [DATABASE] Tables:", userTables);
    // Handle empty tables case
    if (userTables.length === 0) {
      console.log("📋 [DATABASE] No tables found for app:", appId);
      return res.json({
        success: true,
        tables: [],
        message:
          "No tables found for this app. Create tables using the workflow builder's db.create block.",
        totalTables: 0,
      });
    }

    // Helper function to safely parse JSON columns
    const parseColumns = (columns) => {
      if (typeof columns === 'string') {
        try {
          return JSON.parse(columns);
        } catch (e) {
          return {};
        }
      }
      return columns; // Already an object
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
        console.error(`Error checking table existence for ${tableName}:`, error);
        return false;
      }
    };

    // Get table data for each table
    const tablesWithData = await Promise.all(
      userTables.map(async (table) => {
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
          const rowCount = parseInt(countResult[0]?.count || 0);

          // Get sample data (first 5 rows)
          const sampleData = await prisma.$queryRawUnsafe(
            `SELECT * FROM "${table.tableName}" ORDER BY id DESC LIMIT 5`
          );

          return {
            id: table.id,
            name: table.tableName,
            columns: parseColumns(table.columns),
            rowCount,
            sampleData,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt,
            exists: true,
          };
        } catch (error) {
          console.error(
            `Error getting data for table ${table.tableName}:`,
            error
          );
          return {
            id: table.id,
            name: table.tableName,
            columns: parseColumns(table.columns),
            rowCount: 0,
            sampleData: [],
            createdAt: table.createdAt,
            updatedAt: table.updatedAt,
            error: error.message,
            exists: false,
          };
        }
      })
    );

    console.log("✅ [DATABASE] Tables data prepared successfully");

    res.json({
      success: true,
      tables: tablesWithData,
      totalTables: userTables.length,
    });
  } catch (error) {
    console.error("❌ [DATABASE] Error getting tables:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get database tables",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/database/:appId/tables/:tableName/data
 * @desc    Get all data from a specific table
 * @access  Private
 */
router.get(
  "/:appId/tables/:tableName/data",
  authenticateToken,
  async (req, res) => {
    try {
      const { appId, tableName } = req.params;
      const userId = req.user.id;
      const { page = 1, limit = 50 } = req.query;

      console.log("📊 [DATABASE] Getting data for table:", tableName);

      // Verify user has access to this app
      const app = await prisma.app.findFirst({
        where: {
          id: parseInt(appId),
          ownerId: userId,
        },
      });

      if (!app) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this app",
        });
      }

      // Verify table belongs to this app
      const userTable = await prisma.userTable.findFirst({
        where: {
          tableName,
          appId: parseInt(appId),
        },
      });

      if (!userTable) {
        return res.status(404).json({
          success: false,
          message: "Table not found",
        });
      }

      // Check if table actually exists in database
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
          exists: false,
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get total count
      const countResult = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      const totalRows = parseInt(countResult[0]?.count || 0);

      // Get paginated data
      const data = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" ORDER BY id DESC LIMIT ${parseInt(
          limit
        )} OFFSET ${offset}`
      );

      console.log("✅ [DATABASE] Table data retrieved successfully");

      // Helper function to safely parse JSON columns
      const parseColumns = (columns) => {
        if (typeof columns === 'string') {
          try {
            return JSON.parse(columns);
          } catch (e) {
            return {};
          }
        }
        return columns; // Already an object
      };

      res.json({
        success: true,
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalRows,
          totalPages: Math.ceil(totalRows / parseInt(limit)),
        },
        columns: parseColumns(userTable.columns),
      });
    } catch (error) {
      console.error("❌ [DATABASE] Error getting table data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get table data",
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
