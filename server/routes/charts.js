const express = require("express");
const { PrismaClient, Prisma } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const {
  assertAppAccess,
  isValidColumnName,
  isValidTableName,
  normalizeColumns,
  parseAppId,
} = require("../utils/databaseHelpers");

const prisma = new PrismaClient();
const router = express.Router();

const { sql, raw, join } = Prisma;
const empty = Prisma.empty || Prisma.sql``;

const CHART_TYPES = new Set(["line", "bar", "pie", "donut"]);
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const AGGREGATION_MAP = {
  sum: "SUM",
  avg: "AVG",
  average: "AVG",
  count: "COUNT",
  min: "MIN",
  max: "MAX",
};
const COMPARATOR_MAP = {
  eq: "=",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const sanitizeLimit = (value = DEFAULT_LIMIT) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(num), 1), MAX_LIMIT);
};

const sanitizeDirection = (direction = "asc") =>
  direction && direction.toString().toLowerCase() === "desc" ? "desc" : "asc";

const coerceNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const tableIdentifier = (tableName) => raw(`"${tableName}"`);

function ensureColumn(columns, targetName, { requireNumeric = false } = {}) {
  const normalized = (targetName || "").trim();
  if (!normalized) {
    const err = new Error("Column name is required");
    err.status = 400;
    throw err;
  }

  if (!isValidColumnName(normalized)) {
    const err = new Error(`Invalid column name: ${normalized}`);
    err.status = 400;
    throw err;
  }

  const columnMeta = columns.find(
    (col) =>
      col.name === normalized ||
      col.name?.toLowerCase() === normalized.toLowerCase()
  );

  if (!columnMeta) {
    const err = new Error(`Column "${normalized}" not found in metadata`);
    err.status = 404;
    throw err;
  }

  if (requireNumeric && !columnMeta.isNumeric) {
    const err = new Error(
      `Column "${normalized}" must be numeric for this chart`
    );
    err.status = 400;
    throw err;
  }

  return {
    name: columnMeta.name,
    meta: columnMeta,
    identifier: raw(`"${columnMeta.name}"`),
  };
}

function buildFilterClauses(filters = [], columns = []) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return [];
  }

  const clauses = [];
  filters.slice(0, 10).forEach((filter) => {
    if (!filter || !filter.column) return;

    const operatorKey = (filter.operator || "eq").toLowerCase();
    const comparator = COMPARATOR_MAP[operatorKey];
    if (!comparator) return;

    const { identifier } = ensureColumn(columns, filter.column);
    if (filter.value === undefined || filter.value === null) return;

    clauses.push(sql`${identifier} ${raw(comparator)} ${filter.value}`);
  });

  return clauses;
}

function buildWhereClause(requiredColumns = [], filterClauses = []) {
  const base = requiredColumns.map((column) => sql`${column} IS NOT NULL`);
  const allClauses = [...base, ...filterClauses];

  if (!allClauses.length) {
    return empty;
  }

  return sql`WHERE ${join(allClauses, sql` AND `)}`;
}

function buildOrderClause(identifier, direction = "asc") {
  if (!identifier) return empty;
  const normalized = sanitizeDirection(direction);
  const directionSql = normalized === "desc" ? raw("DESC") : raw("ASC");
  return sql`ORDER BY ${identifier} ${directionSql}`;
}

function buildAggregatorExpression(aggregation = "sum", columnName) {
  const key = aggregation?.toLowerCase?.() || "sum";
  const sqlFunction = AGGREGATION_MAP[key] || AGGREGATION_MAP.sum;
  return {
    key: AGGREGATION_MAP[key] ? key : "sum",
    expression: raw(`${sqlFunction}("${columnName}")::double precision`),
  };
}

async function fetchTableMetadata(appId, tableName) {
  const table = await prisma.userTable.findFirst({
    where: { appId, tableName },
  });

  if (!table) {
    const err = new Error(`Table "${tableName}" not found in metadata`);
    err.status = 404;
    throw err;
  }

  const columns = normalizeColumns(table.columns);
  if (!columns.length) {
    const err = new Error(
      `Table "${tableName}" has no column metadata. Define columns before binding charts.`
    );
    err.status = 400;
    throw err;
  }

  return { table, columns };
}

async function runLineChartQuery({
  tableName,
  columns,
  xAxis,
  yAxis,
  filters,
  limit,
  sortDirection,
}) {
  const xColumn = ensureColumn(columns, xAxis);
  const yColumn = ensureColumn(columns, yAxis, { requireNumeric: true });
  const tbl = tableIdentifier(tableName);
  const filterClauses = buildFilterClauses(filters, columns);
  const whereClause = buildWhereClause(
    [xColumn.identifier, yColumn.identifier],
    filterClauses
  );
  const orderClause = buildOrderClause(xColumn.identifier, sortDirection);

  const query = sql`
    SELECT ${xColumn.identifier} AS x_value, ${yColumn.identifier} AS y_value
    FROM ${tbl}
    ${whereClause}
    ${orderClause}
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRaw(query);
  const data = rows.map((row) => ({
    [xColumn.name]: row.x_value,
    [yColumn.name]: coerceNumber(row.y_value),
  }));

  return {
    data,
    meta: {
      xAxis: xColumn.name,
      yAxis: yColumn.name,
      sortDirection: sanitizeDirection(sortDirection),
    },
  };
}

async function runGroupedChartQuery({
  tableName,
  columns,
  categoryColumn,
  valueColumn,
  filters,
  limit,
  sortDirection,
  aggregation,
}) {
  const xColumn = ensureColumn(columns, categoryColumn);
  const yColumn = ensureColumn(columns, valueColumn, { requireNumeric: true });
  const tbl = tableIdentifier(tableName);
  const filterClauses = buildFilterClauses(filters, columns);
  const whereClause = buildWhereClause(
    [xColumn.identifier, yColumn.identifier],
    filterClauses
  );
  const { key: resolvedAggregation, expression } = buildAggregatorExpression(
    aggregation,
    yColumn.name
  );
  const orderClause = buildOrderClause(raw("value"), sortDirection);

  const query = sql`
    SELECT ${xColumn.identifier} AS category, ${expression} AS value
    FROM ${tbl}
    ${whereClause}
    GROUP BY ${xColumn.identifier}
    ${orderClause}
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRaw(query);
  const data = rows.map((row) => ({
    [xColumn.name]: row.category,
    [yColumn.name]: coerceNumber(row.value),
  }));

  return {
    data,
    meta: {
      categoryColumn: xColumn.name,
      valueColumn: yColumn.name,
      aggregation: resolvedAggregation,
      sortDirection: sanitizeDirection(sortDirection),
    },
  };
}

router.get("/:appId/tables", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);
    if (!appIdInt) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appId supplied" });
    }

    await assertAppAccess(prisma, appIdInt, req.user.id);

    const tables = await prisma.userTable.findMany({
      where: { appId: appIdInt },
      orderBy: { createdAt: "desc" },
    });

    const payload = tables.map((table) => {
      const columns = normalizeColumns(table.columns);
      return {
        id: table.id,
        name: table.tableName,
        columns,
        numericColumns: columns.filter((col) => col.isNumeric).map((col) => col.name),
        totalColumns: columns.length,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      };
    });

    return res.json({
      success: true,
      tables: payload,
      totalTables: payload.length,
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("[CHARTS] Failed to load tables", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to load tables",
    });
  }
});

router.post("/:appId/query", authenticateToken, async (req, res) => {
  try {
    const appIdInt = parseAppId(req.params.appId);
    if (!appIdInt) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appId supplied" });
    }

    await assertAppAccess(prisma, appIdInt, req.user.id);

    const {
      chartType,
      tableName,
      xAxis,
      yAxis,
      labelColumn,
      valueColumn,
      filters = [],
      limit = DEFAULT_LIMIT,
      sortDirection,
      aggregation = "sum",
    } = req.body || {};

    const normalizedChartType = chartType?.toString().toLowerCase();
    if (!normalizedChartType || !CHART_TYPES.has(normalizedChartType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported chart type",
      });
    }

    if (!tableName || !isValidTableName(tableName)) {
      return res.status(400).json({
        success: false,
        message: "Valid tableName is required",
      });
    }

    const { columns } = await fetchTableMetadata(appIdInt, tableName);
    const limitValue = sanitizeLimit(limit);

    let queryResult;
    if (normalizedChartType === "line") {
      if (!xAxis || !yAxis) {
        return res.status(400).json({
          success: false,
          message: "Line charts require xAxis and yAxis columns",
        });
      }

      queryResult = await runLineChartQuery({
        tableName,
        columns,
        xAxis,
        yAxis,
        filters,
        limit: limitValue,
        sortDirection: sortDirection || "asc",
      });
    } else {
      const categoryColumn = xAxis || labelColumn;
      const metricColumn = yAxis || valueColumn;

      if (!categoryColumn || !metricColumn) {
        return res.status(400).json({
          success: false,
          message: "Bar, pie, and donut charts require both category and value columns",
        });
      }

      queryResult = await runGroupedChartQuery({
        tableName,
        columns,
        categoryColumn,
        valueColumn: metricColumn,
        filters,
        limit: limitValue,
        sortDirection: sortDirection || "desc",
        aggregation,
      });
    }

    const warnings = [];
    if (queryResult.data.length === 0) {
      warnings.push("No data returned for the selected columns.");
    } else if (queryResult.data.length === limitValue) {
      warnings.push(
        `Result capped at ${limitValue} rows. Narrow filters or lower the limit for more precise data.`
      );
    }

    return res.json({
      success: true,
      chartType: normalizedChartType,
      data: queryResult.data,
      meta: {
        tableName,
        limit: limitValue,
        rowCount: queryResult.data.length,
        ...queryResult.meta,
      },
      warnings,
    });
  } catch (error) {
    const status =
      error.status || (error.code === "42P01" ? 404 : 500);
    const message =
      error.code === "42P01"
        ? "Table exists in metadata but has not been created yet"
        : error.message || "Failed to build chart dataset";

    console.error("[CHARTS] Query error", error);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;
