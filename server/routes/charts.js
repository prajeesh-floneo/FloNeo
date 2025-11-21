const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const isValidIdentifier = (value = "") => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
const sanitizeIdentifier = (value) => value.replace(/"/g, "\"\"");

const parseAppId = (appIdParam) => {
  const id = Number(appIdParam);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

async function assertAppAccess(appId, userId) {
  const app = await prisma.app.findUnique({
    where: { id: appId },
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

const parseColumns = (columns) => {
  if (typeof columns === "string") {
    try {
      const parsed = JSON.parse(columns);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[CHART-DATA] Failed to parse column metadata", error.message);
      return [];
    }
  }

  if (Array.isArray(columns)) {
    return columns;
  }

  if (typeof columns === "object" && columns !== null) {
    return Object.entries(columns).map(([name, definition]) => ({
      name,
      type: definition?.type || definition || "TEXT",
      required: Boolean(definition?.required),
    }));
  }

  return [];
};

const hasColumn = async (tableName, columnName) => {
  const query = `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      AND column_name = '${columnName}'
    ) as exists`;

  const result = await prisma.$queryRawUnsafe(query);
  return Boolean(result?.[0]?.exists);
};

const toNumeric = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

router.get(
  "/:appId/tables/:tableName",
  authenticateToken,
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const { xKey, yKey, chartType = "chart-line", limit = "500" } = req.query;
      const appId = parseAppId(req.params.appId);
      const userId = req.user.id;

      if (!appId) {
        return res.status(400).json({ success: false, message: "Invalid appId" });
      }

      if (!isValidIdentifier(tableName)) {
        return res.status(400).json({ success: false, message: "Invalid table name" });
      }

      if (!xKey || !isValidIdentifier(xKey)) {
        return res.status(400).json({ success: false, message: "Invalid x-axis column" });
      }

      if (!yKey || !isValidIdentifier(yKey)) {
        return res.status(400).json({ success: false, message: "Invalid y-axis column" });
      }

      const normalizedChartType = chartType?.toString().toLowerCase();
      const limitInt = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 2000);

      await assertAppAccess(appId, userId);

      const userTable = await prisma.userTable.findFirst({
        where: { appId, tableName },
      });

      if (!userTable) {
        return res.status(404).json({ success: false, message: "Table not found" });
      }

      const tableColumns = parseColumns(userTable.columns);
      const xMeta = tableColumns.find((column) => column.name === xKey);
      const yMeta = tableColumns.find((column) => column.name === yKey);

      if (!xMeta) {
        return res.status(400).json({ success: false, message: `Column "${xKey}" does not exist on ${tableName}` });
      }

      if (!yMeta) {
        return res.status(400).json({ success: false, message: `Column "${yKey}" does not exist on ${tableName}` });
      }

      const safeTableName = sanitizeIdentifier(tableName);
      const safeXKey = sanitizeIdentifier(xKey);
      const safeYKey = sanitizeIdentifier(yKey);

      const tableHasAppId = await hasColumn(safeTableName, "app_id");
      const whereClause = tableHasAppId ? `WHERE app_id = ${appId}` : "";

      const query = `SELECT "${safeXKey}" as x_value, "${safeYKey}" as y_value FROM "${safeTableName}" ${whereClause} ORDER BY id ASC LIMIT ${limitInt}`;
      const rawRows = await prisma.$queryRawUnsafe(query);
      const mappedRows = rawRows.map((row) => ({
        [xKey]: row.x_value,
        [yKey]: row.y_value,
      }));

      const warnings = [];
      let nonNumericCount = 0;
      let processedData = mappedRows;

      if (!mappedRows.length) {
        warnings.push("No data available");
      }

      if (mappedRows.length) {
        if (normalizedChartType === "chart-bar") {
          const grouped = new Map();

          mappedRows.forEach((row) => {
            const xValue = row[xKey];
            const key = xValue === null || xValue === undefined || xValue === "" ? "(empty)" : String(xValue);
            if (!grouped.has(key)) {
              grouped.set(key, {
                displayValue: xValue === null || xValue === undefined || xValue === "" ? "(empty)" : xValue,
                total: 0,
                count: 0,
                numericCount: 0,
              });
            }

            const entry = grouped.get(key);
            const numericY = toNumeric(row[yKey]);

            if (numericY === null && row[yKey] !== null && row[yKey] !== undefined && row[yKey] !== "") {
              nonNumericCount += 1;
            } else if (numericY !== null) {
              entry.total += numericY;
              entry.numericCount += 1;
            }

            entry.count += 1;
          });

          processedData = Array.from(grouped.values()).map((group) => ({
            [xKey]: group.displayValue,
            [yKey]: group.numericCount > 0 ? group.total : group.count,
          }));
        } else if (normalizedChartType === "chart-pie" || normalizedChartType === "chart-donut") {
          const grouped = new Map();

          mappedRows.forEach((row) => {
            const xValue = row[xKey];
            const key = xValue === null || xValue === undefined || xValue === "" ? "(empty)" : String(xValue);
            if (!grouped.has(key)) {
              grouped.set(key, {
                displayValue: xValue === null || xValue === undefined || xValue === "" ? "(empty)" : xValue,
                total: 0,
              });
            }

            const entry = grouped.get(key);
            const numericY = toNumeric(row[yKey]);

            if (numericY === null && row[yKey] !== null && row[yKey] !== undefined && row[yKey] !== "") {
              nonNumericCount += 1;
              return;
            }

            entry.total += numericY || 0;
          });

          const totalValue = Array.from(grouped.values()).reduce(
            (sum, group) => sum + group.total,
            0,
          );

          processedData = Array.from(grouped.values()).map((group) => ({
            [xKey]: group.displayValue,
            [yKey]: group.total,
            percentage:
              totalValue > 0
                ? Number(((group.total / totalValue) * 100).toFixed(2))
                : 0,
          }));
        } else {
          processedData = mappedRows.map((row) => {
            const numericY = toNumeric(row[yKey]);
            if (numericY === null && row[yKey] !== null && row[yKey] !== undefined && row[yKey] !== "") {
              nonNumericCount += 1;
            }

            return {
              [xKey]: row[xKey],
              [yKey]: numericY,
            };
          });
        }

        if (nonNumericCount > 0) {
          warnings.push("Selected Y-axis column contains non-numeric values");
        }
      }

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      res.json({
        success: true,
        data: processedData,
        metadata: {
          appId,
          tableName,
          chartType: normalizedChartType,
          rowCount: mappedRows.length,
          xKey,
          yKey,
          yColumnType: yMeta?.type || null,
        },
        warnings,
        columns: tableColumns,
      });
    } catch (error) {
      const status = error.status || 500;
      console.error("[CHART-DATA] Failed to fetch chart data", error);
      res.status(status).json({
        success: false,
        message: error.status ? error.message : "Failed to fetch chart data",
        error: error.message,
      });
    }
  }
);

module.exports = router;
