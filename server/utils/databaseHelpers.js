const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const NUMERIC_HINTS = [
  "int",
  "number",
  "decimal",
  "double",
  "float",
  "real",
  "numeric",
];
const DATE_HINTS = ["date", "time", "timestamp"];
const BOOLEAN_HINTS = ["bool", "boolean"];

const isValidTableName = (name = "") => IDENTIFIER_PATTERN.test(name);
const isValidColumnName = (name = "") => IDENTIFIER_PATTERN.test(name);

const parseAppId = (rawValue) => {
  const id = Number(rawValue);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

async function assertAppAccess(prisma, appId, userId) {
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

function parseTableColumns(columns) {
  if (!columns) return [];

  if (Array.isArray(columns)) {
    return columns;
  }

  if (typeof columns === "string") {
    try {
      const parsed = JSON.parse(columns);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[DB-HELPERS] Failed to parse column metadata", error);
      return [];
    }
  }

  if (typeof columns === "object") {
    return [columns];
  }

  return [];
}

function buildColumnMeta(column) {
  if (!column) return null;

  const rawName = column.name || column.originalName || column.elementId;
  if (!rawName) {
    return null;
  }

  const normalizedName = rawName.trim();
  if (!normalizedName) {
    return null;
  }

  const type = (column.type || column.dataType || column.columnType || "TEXT").toString();
  const lowerType = type.toLowerCase();

  return {
    name: normalizedName,
    label: column.originalName || column.label || column.displayName || normalizedName,
    type,
    required: Boolean(column.required),
    isNumeric: NUMERIC_HINTS.some((hint) => lowerType.includes(hint)),
    isDate: DATE_HINTS.some((hint) => lowerType.includes(hint)),
    isBoolean: BOOLEAN_HINTS.some((hint) => lowerType.includes(hint)),
    source: column,
  };
}

function normalizeColumns(rawColumns) {
  const parsed = parseTableColumns(rawColumns);
  return parsed
    .map(buildColumnMeta)
    .filter(Boolean);
}

module.exports = {
  assertAppAccess,
  isValidColumnName,
  isValidTableName,
  normalizeColumns,
  parseAppId,
  parseTableColumns,
};
