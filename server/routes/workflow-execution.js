const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const DOMPurify = require("isomorphic-dompurify");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { SafeQueryBuilder, DatabaseUtils } = require("../utils/database");
const { SecurityValidator } = require("../utils/security");
const emailService = require("../utils/email");
const jwt = require("jsonwebtoken");

const router = express.Router();
const prisma = new PrismaClient();
const { enqueueWorkflow } = require("../utils/workflow-queue");

// Initialize utility classes
const dbUtils = new DatabaseUtils(prisma);
const securityValidator = new SecurityValidator();

// SQL injection prevention - sanitize table/column names
const sanitizeIdentifier = (identifier) => {
  if (!identifier || typeof identifier !== "string") {
    throw new Error("Invalid identifier");
  }

  // Remove special characters, keep only alphanumeric and underscore
  const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(sanitized)) {
    return `field_${sanitized}`;
  }

  // Check against SQL reserved words
  const reservedWords = [
    "select",
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "table",
    "database",
    "schema",
    "user",
    "password",
    "admin",
    "system",
    "root",
    "where",
    "from",
    "join",
    "union",
    "order",
    "group",
    "having",
  ];

  if (reservedWords.includes(sanitized)) {
    return `${sanitized}_field`;
  }

  return sanitized;
};

// Generate app-specific table name with prefix
const generateTableName = (appId, baseName) => {
  const sanitizedName = sanitizeIdentifier(baseName);
  return `app_${appId}_${sanitizedName}`;
};

// Map form field types to PostgreSQL types
const mapFieldTypeToSQL = (fieldType, inputType = "text") => {
  // Normalize field type to uppercase for consistent mapping
  const normalizedType = fieldType.toUpperCase();

  const typeMap = {
    // Text inputs
    INPUT: {
      email: "VARCHAR(255)",
      password: "VARCHAR(255)",
      number: "DECIMAL(10,2)",
      tel: "VARCHAR(20)",
      url: "TEXT",
      date: "DATE",
      "datetime-local": "TIMESTAMP",
      time: "TIME",
      text: "TEXT",
    },
    TEXTFIELD: "TEXT",
    TEXT_FIELD: "TEXT",
    TEXTAREA: "TEXT",
    TEXT_AREA: "TEXT",

    // Selection inputs
    SELECT: "VARCHAR(255)",
    DROPDOWN: "VARCHAR(255)",
    RADIO: "VARCHAR(255)",

    // Boolean inputs
    CHECKBOX: "BOOLEAN",
    TOGGLE: "BOOLEAN",

    // Date/Time inputs
    DATE: "DATE",
    TIME: "TIME",
    DATETIME: "TIMESTAMP",

    // File inputs (store file URL/path)
    FILE: "TEXT",
    ADDFILE: "TEXT",
    UPLOAD: "TEXT",
    FILE_UPLOAD: "TEXT",

    // Media elements (store src URL)
    IMAGE: "TEXT",
    VIDEO: "TEXT",
    AUDIO: "TEXT",
    MEDIA: "TEXT",

    // Other inputs
    BUTTON: "TEXT", // Store button text/label
    SLIDER: "DECIMAL(10,2)",
    RANGE: "DECIMAL(10,2)",
    NUMBER: "DECIMAL(10,2)",
  };

  // Handle INPUT type with specific inputType
  if (normalizedType === "INPUT" && typeMap.INPUT[inputType]) {
    return typeMap.INPUT[inputType];
  }

  // Return mapped type or default to TEXT
  return typeMap[normalizedType] || "TEXT";
};

// Check if table already exists
const tableExists = async (tableName) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      );
    `;
    return result[0].exists;
  } catch (error) {
    console.error("Error checking table existence:", error);
    return false;
  }
};

// IsFilled block handler
const executeIsFilled = async (node, context, appId) => {
  try {
    console.log("🔍 [IS-FILLED] Starting validation for app:", appId);

    // Get element IDs to check from node configuration (support both single and multiple)
    const elementIds =
      node.data.selectedElementIds ||
      (node.data.selectedElementId ? [node.data.selectedElementId] : []);

    if (!elementIds || elementIds.length === 0) {
      throw new Error("No form elements selected for validation");
    }

    console.log("🔍 [IS-FILLED] Checking elements:", elementIds);
    console.log("🔍 [IS-FILLED] Node data:", {
      showToastOnFail: node.data.showToastOnFail,
      failureMessage: node.data.failureMessage,
    });

    // Get canvas data for this app
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
    });

    if (!canvas || !canvas.canvasState) {
      throw new Error("Canvas not found for this app");
    }

    // Parse canvas state to get elements
    const canvasState = JSON.parse(canvas.canvasState);
    const allElements = [];

    // Extract elements from all pages
    if (canvasState.pages) {
      canvasState.pages.forEach((page) => {
        if (page.elements) {
          allElements.push(...page.elements);
        }
      });
    }

    console.log("📋 [IS-FILLED] Found canvas elements:", allElements.length);

    // Get form data from context (passed from frontend)
    const formData = context.formData || {};

    const validationResults = [];
    let allFilled = true;
    let anyFilled = false;

    // Check each selected element
    for (const elementId of elementIds) {
      // Find the specific element to validate in canvas state
      const targetElement = allElements.find(
        (element) => element.id === elementId
      );

      if (!targetElement) {
        console.warn(`⚠️ [IS-FILLED] Element with ID ${elementId} not found`);
        validationResults.push({
          elementId,
          isFilled: false,
          error: `Element ${elementId} not found`,
        });
        allFilled = false;
        continue;
      }

      const elementValue =
        formData[elementId] ||
        context[elementId] ||
        context[targetElement.properties?.name] ||
        targetElement.properties?.value ||
        "";

      // Perform validation based on element type
      let isFilled = false;

      switch (targetElement.type) {
        case "INPUT":
        case "textfield":
        case "TEXT_FIELD":
          // For input fields, check if value is not empty after trimming
          isFilled = String(elementValue).trim().length > 0;
          break;

        case "TEXTAREA":
        case "textarea":
        case "TEXT_AREA":
          // For textareas, check if value is not empty after trimming
          isFilled = String(elementValue).trim().length > 0;
          break;

        case "SELECT":
        case "dropdown":
        case "DROPDOWN":
          // For select fields, check if a value is selected (not empty or default)
          isFilled =
            elementValue && elementValue !== "" && elementValue !== "default";
          break;

        case "CHECKBOX":
        case "checkbox":
          // For checkboxes, check if it's checked (true value)
          isFilled = Boolean(elementValue) === true;
          break;

        case "RADIO":
        case "radiobutton":
        case "RADIO_BUTTON":
          // For radio buttons, check if a value is selected
          isFilled = elementValue && elementValue !== "";
          break;

        case "FILE":
        case "file":
          // For file inputs, check if a file is selected
          isFilled =
            elementValue &&
            ((typeof elementValue === "string" && elementValue.length > 0) ||
              (typeof elementValue === "object" && elementValue.name));
          break;

        case "phonefield":
        case "PHONE_FIELD":
        case "datepicker":
        case "DATE_PICKER":
          // For phone and date fields, check if value is not empty
          isFilled = String(elementValue).trim().length > 0;
          break;

        default:
          // For unknown types, treat as text input
          isFilled = String(elementValue).trim().length > 0;
      }

      validationResults.push({
        elementId,
        elementType: targetElement.type,
        isFilled,
        elementValue: elementValue ? "***" : null, // Hide actual value for security
      });

      if (!isFilled) {
        allFilled = false;
      }
      if (isFilled) {
        anyFilled = true;
      }

      console.log("🔍 [IS-FILLED] Element validation:", {
        elementId,
        elementType: targetElement.type,
        isFilled,
      });
    }

    console.log("✅ [IS-FILLED] Validation completed:", {
      totalElements: elementIds.length,
      allFilled,
      anyFilled,
      filledCount: validationResults.filter((r) => r.isFilled).length,
    });

    const filledCount = validationResults.filter((r) => r.isFilled).length;
    const message = `${filledCount}/${elementIds.length} elements are filled`;

    console.log("✅ [IS-FILLED] Validation completed:", {
      totalElements: elementIds.length,
      allFilled,
      anyFilled,
      filledCount,
    });

    // Build response
    const response = {
      success: true,
      isFilled: allFilled, // For backward compatibility, use allFilled as main result
      allFilled, // All elements are filled
      anyFilled, // At least one element is filled
      validationResults, // Detailed results for each element
      elementCount: elementIds.length,
      filledCount,
      message,
      context: {
        ...context,
        isFilledResult: {
          allFilled,
          anyFilled,
          filledCount,
          elementCount: elementIds.length,
          validationResults,
        },
      },
    };

    // If validation failed and showToastOnFail is enabled, add toast to response
    if (!allFilled && node.data.showToastOnFail) {
      const failureMessage =
        node.data.failureMessage ||
        `Please fill all required fields. ${filledCount}/${elementIds.length} fields are filled.`;

      console.log("🔔 [IS-FILLED] Adding failure toast:", failureMessage);

      response.type = "toast";
      response.toast = {
        message: failureMessage,
        title: node.data.failureTitle || "Validation Failed",
        variant: "destructive",
        duration: 5000,
      };
    }

    return response;
  } catch (error) {
    console.error("❌ [IS-FILLED] Validation error:", error.message);
    return {
      success: false,
      isFilled: false,
      allFilled: false,
      anyFilled: false,
      error: error.message,
      context: {
        ...context,
        isFilledError: error.message,
      },
    };
  }
};

// OnClick block handler
const executeOnClick = async (node, context, appId) => {
  try {
    console.log("🖱️ [ON-CLICK] Processing click event for app:", appId);

    const clickConfig = node.data || {};
    const { elementId, clickData } = context;

    console.log("🖱️ [ON-CLICK] Click configuration:", {
      targetElementId: clickConfig.targetElementId,
      elementId: elementId,
      clickData: clickData,
    });

    // Validate click event
    if (!elementId) {
      return {
        success: false,
        error: "No element ID provided in click event",
        context: context,
      };
    }

    // Check if this click is for the configured element (if specified)
    if (
      clickConfig.targetElementId &&
      clickConfig.targetElementId !== elementId
    ) {
      console.log("🖱️ [ON-CLICK] Click not for target element, skipping");
      return {
        success: false,
        error: "Click not for target element",
        context: context,
      };
    }

    console.log("✅ [ON-CLICK] Click event processed successfully");
    return {
      success: true,
      message: "Click event processed",
      context: {
        ...context,
        clickProcessed: true,
        clickElementId: elementId,
        clickTimestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ [ON-CLICK] Error processing click:", error);
    return {
      success: false,
      error: error.message,
      context: context,
    };
  }
};

// OnPageLoad block handler
const executeOnPageLoad = async (node, context, appId) => {
  try {
    console.log("📄 [ON-PAGE-LOAD] Processing page load for app:", appId);

    const pageLoadConfig = node.data || {};
    const { pageId, loadData } = context;

    console.log("📄 [ON-PAGE-LOAD] Page load configuration:", {
      targetPageId: pageLoadConfig.targetPageId,
      pageId: pageId,
      loadData: loadData,
    });

    // Check if this is for the configured page (if specified)
    if (pageLoadConfig.targetPageId && pageLoadConfig.targetPageId !== pageId) {
      console.log("📄 [ON-PAGE-LOAD] Load not for target page, skipping");
      return {
        success: false,
        error: "Load not for target page",
        context: context,
      };
    }

    console.log("✅ [ON-PAGE-LOAD] Page load event processed successfully");
    return {
      success: true,
      message: "Page load event processed",
      context: {
        ...context,
        pageLoadProcessed: true,
        loadedPageId: pageId,
        loadTimestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ [ON-PAGE-LOAD] Error processing page load:", error);
    return {
      success: false,
      error: error.message,
      context: context,
    };
  }
};

// OnSubmit block handler
const executeOnSubmit = async (node, context, appId) => {
  try {
    console.log("📝 [ON-SUBMIT] Processing form submission for app:", appId);

    // Get the form group ID from node configuration
    const formGroupId = node.data.selectedFormGroup;
    if (!formGroupId) {
      console.warn("⚠️ [ON-SUBMIT] No form group selected in OnSubmit block");
      return {
        success: false,
        error: "No form group selected",
        context: context,
      };
    }

    // Get form data from context (passed from frontend)
    const formData = context.formData || {};
    const triggerElement = context.triggerElement;

    console.log("📋 [ON-SUBMIT] Form submission details:", {
      formGroupId,
      formDataKeys: Object.keys(formData),
      triggerElementId: triggerElement?.id,
      contextKeys: Object.keys(context),
    });

    // Validate that we have form data
    if (Object.keys(formData).length === 0) {
      console.warn("⚠️ [ON-SUBMIT] No form data provided");
      return {
        success: false,
        error: "No form data provided",
        context: context,
      };
    }

    // Add form data to context for subsequent workflow blocks
    const updatedContext = {
      ...context,
      formData, // Add formData at root level for dateValid and other blocks
      formSubmission: {
        formGroupId,
        formData,
        triggerElement,
        submittedAt: new Date().toISOString(),
      },
      // Also add individual form fields to context for easy access
      ...formData,
    };

    console.log("✅ [ON-SUBMIT] Form submission processed successfully:", {
      formGroupId,
      fieldsProcessed: Object.keys(formData).length,
      contextUpdated: true,
    });

    return {
      success: true,
      message: "Form submission processed",
      context: updatedContext,
    };
  } catch (error) {
    console.error("❌ [ON-SUBMIT] Form submission processing failed:", error);
    throw new Error(`Form submission failed: ${error.message}`);
  }
};

// DbCreate block handler
const executeDbCreate = async (node, context, appId, userId) => {
  const startTime = Date.now();

  try {
    console.log("🗄️ [DB-CREATE] Starting table creation for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check
    if (!securityValidator.checkRateLimit(userId, "db.create")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Get canvas state for this app to extract form fields
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
    });

    if (!canvas || !canvas.canvasState) {
      throw new Error("Canvas not found for this app");
    }

    // Parse canvas state to get elements
    const canvasState = JSON.parse(canvas.canvasState);
    const allElements = [];

    // Extract elements from all pages
    if (canvasState.pages) {
      canvasState.pages.forEach((page) => {
        if (page.elements) {
          allElements.push(...page.elements);
        }
      });
    }

    // Check if we have manual insertData from workflow builder
    const hasManualInsertData =
      node.data.insertData && Object.keys(node.data.insertData).length > 0;

    console.log("🔍 [DB-CREATE] Data source check:", {
      hasManualInsertData,
      insertDataKeys: hasManualInsertData
        ? Object.keys(node.data.insertData)
        : [],
      hasFormData: !!context.formData,
      formDataKeys: context.formData ? Object.keys(context.formData) : [],
    });

    // Extract all saveable elements from canvas
    // This includes form inputs, media elements, and other interactive elements
    const formElements = allElements.filter((element) => {
      const saveableTypes = [
        // Text inputs (lowercase and uppercase variants)
        "textfield",
        "textarea",
        "input",
        "TEXT_FIELD",
        "TEXT_AREA",
        "INPUT",

        // Selection inputs
        "select",
        "dropdown",
        "radio",
        "SELECT",
        "DROPDOWN",
        "RADIO",

        // Boolean inputs
        "checkbox",
        "toggle",
        "CHECKBOX",
        "TOGGLE",

        // Date/Time inputs
        "date",
        "time",
        "datetime",
        "DATE",
        "TIME",
        "DATETIME",

        // File inputs
        "file",
        "addfile",
        "upload",
        "file_upload",
        "FILE",
        "ADDFILE",
        "UPLOAD",
        "FILE_UPLOAD",

        // Media elements (save src URLs)
        "image",
        "video",
        "audio",
        "media",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        "MEDIA",

        // Other inputs
        "button",
        "BUTTON", // Save button text/label
        "slider",
        "range",
        "number", // Save numeric values
        "SLIDER",
        "RANGE",
        "NUMBER",
      ];

      return saveableTypes.includes(element.type);
    });

    // If we have manual insertData, we don't need form elements
    if (formElements.length === 0 && !hasManualInsertData) {
      throw new Error(
        "No saveable elements found on canvas and no manual insertData provided"
      );
    }

    console.log("📋 [DB-CREATE] Found saveable elements:", formElements.length);

    // Generate secure table name (use node configuration or default)
    const baseName = node.data.tableName || "form_data";
    const tableName = `app_${appId}_${baseName}`;

    // Validate table name for security
    securityValidator.validateTableName(tableName, appId);

    // Check if table already exists
    const exists = await dbUtils.tableExists(tableName);
    let tableCreated = false;
    let columnMap = new Map();

    if (!exists) {
      // Table doesn't exist, create it
      tableCreated = true;

      // Build column definitions for new table
      const columns = ["id SERIAL PRIMARY KEY"];

      // If we have manual insertData, create columns from it
      if (hasManualInsertData) {
        console.log("🔧 [DB-CREATE] Creating table from manual insertData");

        Object.keys(node.data.insertData).forEach((fieldName) => {
          const columnName = sanitizeIdentifier(fieldName);

          // Validate column name for security
          securityValidator.validateColumnName(columnName);

          // Default to TEXT type for manual fields
          const sqlType = "TEXT";

          // Avoid duplicate column names
          let finalColumnName = columnName;
          let counter = 1;
          while (columnMap.has(finalColumnName)) {
            finalColumnName = `${columnName}_${counter}`;
            counter++;
          }

          columnMap.set(finalColumnName, {
            elementId: fieldName,
            type: sqlType,
            required: false,
            originalName: fieldName,
          });

          columns.push(`"${finalColumnName}" ${sqlType}`);
        });
      } else {
        // Create columns from form elements
        console.log("🔧 [DB-CREATE] Creating table from form elements");

        formElements.forEach((element) => {
          const columnName = sanitizeIdentifier(
            element.properties?.label || element.id
          );

          // Validate column name for security
          securityValidator.validateColumnName(columnName);

          const sqlType = mapFieldTypeToSQL(
            element.type,
            element.properties?.inputType
          );

          // Avoid duplicate column names
          let finalColumnName = columnName;
          let counter = 1;
          while (columnMap.has(finalColumnName)) {
            finalColumnName = `${columnName}_${counter}`;
            counter++;
          }

          columnMap.set(finalColumnName, {
            elementId: element.id,
            type: sqlType,
            required: element.properties?.required || false,
            originalName: element.properties?.label || element.id,
          });

          const notNull = element.properties?.required ? " NOT NULL" : "";
          columns.push(`"${finalColumnName}" ${sqlType}${notNull}`);
        });
      }

      // Add metadata columns
      columns.push("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      columns.push("updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      columns.push(`app_id INTEGER NOT NULL DEFAULT ${appId}`);

      // Create the table
      const createTableSQL = `CREATE TABLE "${tableName}" (${columns.join(
        ", "
      )})`;

      console.log("🔨 [DB-CREATE] Creating table with SQL:", createTableSQL);

      await prisma.$executeRawUnsafe(createTableSQL);

      // Create index for app_id for better performance
      await prisma.$executeRawUnsafe(
        `CREATE INDEX idx_${tableName}_app_id ON "${tableName}" (app_id)`
      );

      // Register table in the table registry
      const columnDefinitions = Array.from(columnMap.entries()).map(
        ([name, info]) => ({
          name,
          type: info.type,
          required: info.required,
          elementId: info.elementId,
          originalName: info.originalName,
        })
      );

      await prisma.userTable.create({
        data: {
          appId: parseInt(appId),
          tableName,
          columns: JSON.stringify(columnDefinitions),
        },
      });
    } else {
      console.log("📋 [DB-CREATE] Table already exists, will insert data");
    }

    // INSERT DATA INTO TABLE
    console.log("💾 [DB-CREATE] Inserting data into table:", tableName);

    // Get data from either manual insertData or context formData
    let dataToInsert = {};

    if (hasManualInsertData) {
      console.log(
        "📋 [DB-CREATE] Using manual insertData from workflow configuration"
      );
      dataToInsert = node.data.insertData;
    } else {
      console.log("📋 [DB-CREATE] Using formData from context");
      dataToInsert = context.formData || {};
    }

    console.log("📋 [DB-CREATE] Data to insert:", Object.keys(dataToInsert));

    if (Object.keys(dataToInsert).length === 0) {
      throw new Error("No data provided for database insertion");
    }

    // Get table schema to map form data to columns
    let tableSchema;
    if (tableCreated) {
      // Use the columnMap we just created
      tableSchema = columnMap;
    } else {
      // Get existing table schema from registry
      const existingTable = await prisma.userTable.findFirst({
        where: { tableName, appId: parseInt(appId) },
      });

      if (!existingTable) {
        throw new Error(
          `Table '${tableName}' exists but not found in registry`
        );
      }

      const existingColumns = JSON.parse(existingTable.columns);
      tableSchema = new Map();
      existingColumns.forEach((col) => {
        tableSchema.set(col.name, {
          elementId: col.elementId,
          type: col.type,
          originalName: col.originalName,
        });
      });
    }

    // Build INSERT statement
    const insertColumns = [];
    const insertValues = [];
    const insertParams = [];
    let paramIndex = 1;

    // Map data to table columns
    for (const [columnName, columnInfo] of tableSchema) {
      // Skip auto-generated columns
      if (
        columnName === "id" ||
        columnName === "created_at" ||
        columnName === "updated_at" ||
        columnName === "app_id"
      ) {
        continue;
      }

      // Find data for this column
      let dataValue = null;

      if (hasManualInsertData) {
        // For manual insertData, match by column name or original name
        dataValue =
          dataToInsert[columnName] ||
          dataToInsert[columnInfo.originalName] ||
          null;
      } else {
        // For form data, match by element ID or original name
        dataValue =
          dataToInsert[columnInfo.elementId] ||
          dataToInsert[columnInfo.originalName] ||
          null;
      }

      insertColumns.push(`"${columnName}"`);
      insertValues.push(`$${paramIndex}`);
      insertParams.push(dataValue);
      paramIndex++;
    }

    // Add app_id
    insertColumns.push('"app_id"');
    insertValues.push(`$${paramIndex}`);
    insertParams.push(parseInt(appId));

    const insertSQL = `INSERT INTO "${tableName}" (${insertColumns.join(
      ", "
    )}) VALUES (${insertValues.join(", ")}) RETURNING id`;

    console.log("💾 [DB-CREATE] Insert SQL:", insertSQL);
    console.log("💾 [DB-CREATE] Insert params:", insertParams);

    const insertResult = await prisma.$queryRawUnsafe(
      insertSQL,
      ...insertParams
    );
    const insertedId = insertResult[0]?.id;

    console.log(
      "✅ [DB-CREATE] Data inserted successfully, record ID:",
      insertedId
    );

    // Record performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils.recordQueryPerformance(
      appId,
      tableName,
      tableCreated ? "create" : "insert",
      executionTime,
      1 // One record inserted
    );

    console.log("✅ [DB-CREATE] Operation completed successfully:", tableName);

    return {
      success: true,
      tableName,
      recordId: insertedId,
      tableCreated,
      columnsInserted: insertColumns.length - 1, // Exclude app_id
      message: tableCreated
        ? `Table '${tableName}' created and data inserted (ID: ${insertedId})`
        : `Data inserted into '${tableName}' (ID: ${insertedId})`,
      executionTime,
      context: {
        ...context,
        recordId: insertedId,
        tableName: tableName,
        dbCreateResult: {
          tableName,
          recordId: insertedId,
          tableCreated,
          executionTime,
        },
      },
    };
  } catch (error) {
    console.error("❌ [DB-CREATE] Error:", error.message);

    // Record failed performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils
      .recordQueryPerformance(appId, "unknown", "create", executionTime, 0)
      .catch(() => {}); // Ignore errors in error logging

    throw new Error(`Database table creation failed: ${error.message}`);
  }
};

// DbFind block handler
const executeDbFind = async (node, context, appId, userId) => {
  const startTime = Date.now();

  try {
    console.log("🔍 [DB-FIND] Starting query execution for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check
    if (!securityValidator.checkRateLimit(userId, "db.find")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Extract configuration from node data
    const {
      tableName,
      conditions = [],
      orderBy = [],
      limit = 100,
      offset = 0,
      columns = ["*"],
    } = node.data;

    if (!tableName) {
      throw new Error("Table name is required for DbFind operation");
    }

    // Validate table name for security
    securityValidator.validateTableName(tableName, appId);

    // Check if table exists
    const tableExists = await dbUtils.tableExists(tableName);
    if (!tableExists) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // Get table schema for validation
    const tableSchema = await dbUtils.discoverTableSchema(tableName);
    if (!tableSchema || tableSchema.length === 0) {
      throw new Error(`Unable to discover schema for table '${tableName}'`);
    }

    // Validate conditions
    securityValidator.validateConditions(conditions);

    // Validate pagination
    securityValidator.validatePagination(limit, offset);

    // Build query using SafeQueryBuilder
    const queryBuilder = new SafeQueryBuilder();

    // Add WHERE conditions
    for (const condition of conditions) {
      const { field, operator, value, logic = "AND" } = condition;

      // Substitute context variables in value
      const substitutedValue = substituteContextVariables(value, context);

      queryBuilder.addWhere(field, operator, substitutedValue, logic);
    }

    // Add ORDER BY clauses
    for (const order of orderBy) {
      const { field, direction = "ASC" } = order;
      queryBuilder.addOrderBy(field, direction);
    }

    // Set pagination
    queryBuilder.setLimit(limit);
    queryBuilder.setOffset(offset);

    // Build and execute query
    const { query, params } = queryBuilder.buildSelectQuery(tableName, columns);

    console.log("🔍 [DB-FIND] Executing query:", query);
    console.log("🔍 [DB-FIND] Query params:", params);

    const results = await prisma.$queryRawUnsafe(query, ...params);

    // Record performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils.recordQueryPerformance(
      appId,
      tableName,
      "find",
      executionTime,
      results.length
    );

    console.log(
      `✅ [DB-FIND] Query executed successfully. Found ${results.length} rows in ${executionTime}ms`
    );

    return {
      success: true,
      type: "dbFind",
      data: results,
      count: results.length,
      tableName,
      query: {
        conditions,
        orderBy,
        limit,
        offset,
      },
      executionTime,
      hasMore: results.length === limit, // Indicates if there might be more results
      context: {
        ...context,
        dbFindResults: results,
        dbFindCount: results.length,
      },
    };
  } catch (error) {
    console.error("❌ [DB-FIND] Error:", error.message);

    // Record failed performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils
      .recordQueryPerformance(
        appId,
        node.data.tableName || "unknown",
        "find",
        executionTime,
        0
      )
      .catch(() => {}); // Ignore errors in error logging

    throw new Error(`Database query failed: ${error.message}`);
  }
};

// DbUpdate block handler
const executeDbUpdate = async (node, context, appId, userId) => {
  const startTime = Date.now();

  try {
    console.log("🔄 [DB-UPDATE] Starting update execution for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check
    if (!securityValidator.checkRateLimit(userId, "db.update")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Extract configuration from node data
    const {
      tableName,
      updateData = {},
      whereConditions = [],
      returnUpdatedRecords = true,
    } = node.data;

    if (!tableName) {
      throw new Error("Table name is required for DbUpdate operation");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error("No update data provided");
    }

    if (!whereConditions || whereConditions.length === 0) {
      throw new Error(
        "WHERE conditions are required for UPDATE operations (safety requirement)"
      );
    }

    // Validate table name for security
    securityValidator.validateTableName(tableName, appId);

    // Check if table exists
    const tableExists = await dbUtils.tableExists(tableName);
    if (!tableExists) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // Get table schema for validation
    const tableSchema = await dbUtils.discoverTableSchema(tableName);
    if (!tableSchema || tableSchema.length === 0) {
      throw new Error(`Unable to discover schema for table '${tableName}'`);
    }

    // Validate WHERE conditions
    securityValidator.validateConditions(whereConditions);

    // Process update data with context substitution
    const processedUpdateData = {};
    for (const [column, value] of Object.entries(updateData)) {
      // Substitute context variables in value
      const substitutedValue = substituteContextVariables(value, context);
      processedUpdateData[column] = substitutedValue;
    }

    // Build safe UPDATE query using SafeQueryBuilder
    const queryBuilder = new SafeQueryBuilder();

    // Add WHERE conditions
    for (const condition of whereConditions) {
      const { field, operator, value, logic = "AND" } = condition;

      // Substitute context variables in value
      const substitutedValue = substituteContextVariables(value, context);

      queryBuilder.addWhere(field, operator, substitutedValue, logic);
    }

    // Build the update query
    const { query, params } = queryBuilder.buildUpdateQuery(
      tableName,
      processedUpdateData
    );

    console.log("🔄 [DB-UPDATE] Executing query:", query);
    console.log("🔄 [DB-UPDATE] Query params:", params);

    // Execute the update
    const result = await prisma.$queryRawUnsafe(query, ...params);

    const executionTime = Date.now() - startTime;
    const updatedCount = Array.isArray(result) ? result.length : 0;

    // Record performance metrics
    await dbUtils.recordQueryPerformance(
      appId,
      tableName,
      "update",
      executionTime,
      updatedCount
    );

    console.log(
      `✅ [DB-UPDATE] Update completed successfully. Updated ${updatedCount} rows in ${executionTime}ms`
    );

    return {
      success: true,
      data: returnUpdatedRecords ? result : null,
      updatedCount,
      tableName,
      query: {
        updateData: processedUpdateData,
        whereConditions,
      },
      executionTime,
      message: `Updated ${updatedCount} record(s) in table '${tableName}'`,
      context: {
        ...context,
        dbUpdateResult: {
          tableName,
          updatedCount,
          updatedRecords: result,
          executionTime,
        },
      },
    };
  } catch (error) {
    console.error("❌ [DB-UPDATE] Error:", error.message);

    // Record failed performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils
      .recordQueryPerformance(
        appId,
        node.data.tableName || "unknown",
        "update",
        executionTime,
        0
      )
      .catch(() => {}); // Ignore errors in error logging

    throw new Error(`Database update failed: ${error.message}`);
  }
};

// DbUpsert block handler (Update or Insert)
const executeDbUpsert = async (node, context, appId, userId) => {
  const startTime = Date.now();

  try {
    console.log("🔄 [DB-UPSERT] Starting upsert execution for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check
    if (!securityValidator.checkRateLimit(userId, "db.upsert")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Extract configuration from node data
    const {
      tableName,
      uniqueFields = [],
      updateData = {},
      insertData = {},
      returnRecord = true,
    } = node.data;

    if (!tableName) {
      throw new Error("Table name is required for DbUpsert operation");
    }

    if (!uniqueFields || uniqueFields.length === 0) {
      throw new Error("At least one unique field is required for upsert");
    }

    if (
      Object.keys(updateData).length === 0 &&
      Object.keys(insertData).length === 0
    ) {
      throw new Error("Either updateData or insertData must be provided");
    }

    console.log("🔄 [DB-UPSERT] Configuration:", {
      tableName,
      uniqueFields,
      updateDataKeys: Object.keys(updateData),
      insertDataKeys: Object.keys(insertData),
    });

    // Substitute context variables in both update and insert data
    const processedUpdateData = {};
    for (const [key, value] of Object.entries(updateData)) {
      processedUpdateData[key] = substituteContextVariables(value, context);
    }

    const processedInsertData = {};
    for (const [key, value] of Object.entries(insertData)) {
      processedInsertData[key] = substituteContextVariables(value, context);
    }

    // Build WHERE clause for checking existence using unique fields
    const queryBuilder = new SafeQueryBuilder();
    for (const field of uniqueFields) {
      const value = processedInsertData[field] || processedUpdateData[field];
      if (value !== undefined && value !== null) {
        queryBuilder.addCondition(field, "=", value);
      }
    }

    // Check if record exists
    const { query: selectQuery, params: selectParams } =
      queryBuilder.buildSelectQuery(tableName, ["id"]);
    console.log(
      "🔄 [DB-UPSERT] Checking if record exists with query:",
      selectQuery
    );

    const existingRecords = await prisma.$queryRawUnsafe(
      selectQuery,
      ...selectParams
    );

    let operation, result;

    if (existingRecords && existingRecords.length > 0) {
      // Record exists - UPDATE
      operation = "update";
      console.log("🔄 [DB-UPSERT] Record exists, performing UPDATE");

      const updateNode = {
        data: {
          tableName,
          updateData: processedUpdateData,
          whereConditions: uniqueFields.map((field) => ({
            field,
            operator: "=",
            value: processedInsertData[field] || processedUpdateData[field],
          })),
          returnUpdatedRecords: returnRecord,
        },
      };
      result = await executeDbUpdate(updateNode, context, appId, userId);
    } else {
      // Record doesn't exist - INSERT
      operation = "insert";
      console.log("🔄 [DB-UPSERT] Record does not exist, performing INSERT");

      const createNode = {
        data: {
          tableName,
          formData: processedInsertData,
        },
      };
      result = await executeDbCreate(createNode, context, appId, userId);
    }

    const executionTime = Date.now() - startTime;

    console.log(`✅ [DB-UPSERT] ${operation} completed in ${executionTime}ms`);

    return {
      success: true,
      operation,
      tableName,
      executionTime,
      context: {
        ...context,
        dbUpsertResult: {
          operation,
          tableName,
          record:
            result.context?.recordId ||
            result.context?.dbUpdateResult?.updatedRecords?.[0],
          executionTime,
        },
      },
    };
  } catch (error) {
    console.error("❌ [DB-UPSERT] Error:", error.message);

    // Record failed performance metrics
    const executionTime = Date.now() - startTime;
    await dbUtils
      .recordQueryPerformance(
        appId,
        node.data?.tableName || "unknown",
        "upsert",
        executionTime,
        0
      )
      .catch(() => {}); // Ignore errors in error logging

    throw new Error(`Database upsert failed: ${error.message}`);
  }
};

// EmailSend block handler
const executeEmailSend = async (node, context, appId, userId) => {
  try {
    console.log("📧 [EMAIL-SEND] Processing email send for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check (max 10 emails per minute per user)
    if (!securityValidator.checkRateLimit(userId, "email.send", 10, 60000)) {
      throw new Error("Email rate limit exceeded (max 10 per minute)");
    }

    // Extract configuration from node data
    const {
      emailTo,
      emailSubject,
      emailBody,
      emailBodyType = "html",
      emailFrom,
      emailCc = [],
      emailBcc = [],
      emailTemplate,
      emailTemplateVars = {},
    } = node.data || {};

    // Validate required fields
    if (!emailTo) {
      throw new Error("Recipient email is required");
    }

    if (!emailSubject) {
      throw new Error("Email subject is required");
    }

    if (!emailBody && !emailTemplate) {
      throw new Error("Email body or template is required");
    }

    // Substitute context variables in emailTo, emailSubject, and emailBody
    const processedTo = substituteContextVariables(emailTo, context);
    const processedSubject = substituteContextVariables(emailSubject, context);
    let processedBody = substituteContextVariables(emailBody, context);

    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(processedTo)) {
      throw new Error(`Invalid recipient email address: ${processedTo}`);
    }

    // If template specified, render template (for future use)
    if (emailTemplate) {
      // Template rendering logic can be added here
      console.log("📧 [EMAIL-SEND] Using template:", emailTemplate);
    }

    console.log("📧 [EMAIL-SEND] Sending email to:", processedTo);

    // Send email using existing EmailService
    const result = await emailService.sendNotificationEmail(
      processedTo,
      "workflow",
      processedBody,
      context.user?.name || "User"
    );

    if (!result.success) {
      throw new Error(`Email sending failed: ${result.error}`);
    }

    console.log("✅ [EMAIL-SEND] Email sent successfully:", result.messageId);

    return {
      success: true,
      type: "email",
      emailSent: true,
      context: {
        ...context,
        emailSendResult: {
          success: result.success,
          messageId: result.messageId,
          to: processedTo,
          subject: processedSubject,
          sentAt: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ [EMAIL-SEND] Error:", error.message);
    return {
      success: false,
      type: "email",
      error: error.message,
      context: context,
    };
  }
};

// Switch block handler
const executeSwitch = async (node, context, appId, userId) => {
  try {
    console.log("🔀 [SWITCH] Processing switch condition for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const { inputValue, cases = [], defaultCase } = node.data || {};

    // Validate required fields
    if (inputValue === undefined || inputValue === null) {
      throw new Error("Input value is required for switch");
    }

    if (!Array.isArray(cases) || cases.length === 0) {
      throw new Error("At least one case is required for switch");
    }

    // Substitute context variables in input value
    const processedInput = substituteContextVariables(inputValue, context);

    console.log("🔀 [SWITCH] Input value:", processedInput);
    console.log("🔀 [SWITCH] Cases to evaluate:", cases.length);

    // Find matching case
    let matchedCase = null;
    let matchedCaseLabel = null;

    for (const caseItem of cases) {
      const { caseValue, caseLabel } = caseItem;

      // Substitute context variables in case value
      const processedCaseValue = substituteContextVariables(caseValue, context);

      console.log(
        `🔀 [SWITCH] Comparing "${processedInput}" with case "${processedCaseValue}"`
      );

      // Perform comparison (case-insensitive string comparison by default)
      if (
        String(processedInput).toLowerCase() ===
        String(processedCaseValue).toLowerCase()
      ) {
        matchedCase = caseItem;
        matchedCaseLabel = caseLabel || processedCaseValue;
        console.log(`✅ [SWITCH] Matched case: ${matchedCaseLabel}`);
        break;
      }
    }

    // If no case matched, use default case
    if (!matchedCase && defaultCase) {
      matchedCaseLabel = "default";
      console.log("🔀 [SWITCH] No case matched, using default");
    }

    if (!matchedCase && !defaultCase) {
      console.warn("⚠️ [SWITCH] No matching case and no default case");
      matchedCaseLabel = "default";
    }

    console.log(`✅ [SWITCH] Switch result: ${matchedCaseLabel}`);

    return {
      success: true,
      matchedCase: matchedCaseLabel,
      inputValue: processedInput,
      context: {
        ...context,
        switchResult: {
          matchedCase: matchedCaseLabel,
          inputValue: processedInput,
        },
      },
    };
  } catch (error) {
    console.error("❌ [SWITCH] Error:", error.message);
    return {
      success: false,
      error: error.message,
      matchedCase: "default",
      context: context,
    };
  }
};

// Expr block handler
const executeExpr = async (node, context, appId, userId) => {
  try {
    console.log("📐 [EXPR] Processing expression for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting check (max 100 expressions per minute per user)
    if (!securityValidator.checkRateLimit(userId, "expr", 100, 60000)) {
      throw new Error("Expression rate limit exceeded (max 100 per minute)");
    }

    // Extract configuration
    const { expression, outputVariable = "exprResult" } = node.data || {};

    // Validate required fields
    if (!expression) {
      throw new Error("Expression is required");
    }

    console.log("📐 [EXPR] Evaluating expression:", expression);

    // Create a safe evaluation context with context variables
    const evalContext = {
      ...context,
      // Add Math object for calculations
      Math: Math,
      // Add Date object for date operations
      Date: Date,
      // Add JSON object for parsing
      JSON: JSON,
      // Add String methods
      String: String,
      // Add Number methods
      Number: Number,
      // Add Array methods
      Array: Array,
      // Add Object methods
      Object: Object,
    };

    // Build the function body with context variables
    const contextVars = Object.keys(evalContext)
      .map((key) => `const ${key} = arguments[0].${key};`)
      .join("\n");

    const functionBody = `
      ${contextVars}
      return (${expression});
    `;

    console.log("📐 [EXPR] Function body:", functionBody);

    // Create and execute the function
    let result;
    try {
      const evalFunc = new Function(functionBody);
      result = evalFunc(evalContext);
    } catch (evalError) {
      throw new Error(`Expression evaluation failed: ${evalError.message}`);
    }

    console.log("✅ [EXPR] Expression result:", result);

    return {
      success: true,
      expression: expression,
      result: result,
      context: {
        ...context,
        [outputVariable]: result,
        exprResult: {
          expression: expression,
          result: result,
        },
      },
    };
  } catch (error) {
    console.error("❌ [EXPR] Error:", error.message);
    return {
      success: false,
      error: error.message,
      result: null,
      context: context,
    };
  }
};

// OpenModal block handler
const executeOpenModal = async (node, context, appId, userId) => {
  try {
    console.log("🪟 [OPEN-MODAL] Processing open modal for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const {
      modalId,
      modalTitle,
      modalContent,
      modalSize = "medium",
      showCloseButton = true,
      showBackdrop = true,
      closeOnBackdropClick = true,
      modalData = {},
    } = node.data || {};

    // Validate required fields
    if (!modalId) {
      throw new Error("Modal ID is required");
    }

    // Substitute context variables in modal data
    const processedModalData = {};
    for (const [key, value] of Object.entries(modalData)) {
      processedModalData[key] = substituteContextVariables(value, context);
    }

    const processedTitle = substituteContextVariables(modalTitle, context);
    const processedContent = substituteContextVariables(modalContent, context);

    console.log("🪟 [OPEN-MODAL] Opening modal:", modalId);
    console.log("🪟 [OPEN-MODAL] Modal data:", processedModalData);

    return {
      success: true,
      type: "modal",
      modalOpened: true,
      context: {
        ...context,
        openModalResult: {
          modalId: modalId,
          title: processedTitle,
          content: processedContent,
          size: modalSize,
          showCloseButton: showCloseButton,
          showBackdrop: showBackdrop,
          closeOnBackdropClick: closeOnBackdropClick,
          data: processedModalData,
        },
      },
      // Include modal action for frontend
      action: {
        type: "openModal",
        payload: {
          modalId: modalId,
          title: processedTitle,
          content: processedContent,
          size: modalSize,
          showCloseButton: showCloseButton,
          showBackdrop: showBackdrop,
          closeOnBackdropClick: closeOnBackdropClick,
          data: processedModalData,
        },
      },
    };
  } catch (error) {
    console.error("❌ [OPEN-MODAL] Error:", error.message);
    return {
      success: false,
      type: "modal",
      error: error.message,
      context: context,
    };
  }
};

// NotifyToast block handler
const executeNotifyToast = async (node, context, appId, userId) => {
  try {
    console.log(
      "🔔 [NOTIFY-TOAST] Processing toast notification for app:",
      appId
    );

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration from node data
    const {
      message,
      title,
      variant = "default",
      duration = 5000,
      position = "bottom-right",
    } = node.data || {};

    // Validate required fields
    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new Error("Toast message is required and cannot be empty");
    }

    // Validate variant
    const validVariants = ["default", "destructive", "success"];
    if (!validVariants.includes(variant)) {
      console.warn(
        `⚠️ [NOTIFY-TOAST] Invalid variant '${variant}', using 'default'`
      );
    }

    // Validate duration
    const numericDuration = parseInt(duration);
    if (
      isNaN(numericDuration) ||
      numericDuration < 1000 ||
      numericDuration > 30000
    ) {
      console.warn(
        `⚠️ [NOTIFY-TOAST] Invalid duration '${duration}', using 5000ms`
      );
    }

    // Substitute context variables in message and title
    const processedMessage = substituteContextVariables(message, context);
    const processedTitle = title
      ? substituteContextVariables(title, context)
      : undefined;

    // Validate processed message is not empty after substitution
    if (!processedMessage || processedMessage.trim() === "") {
      throw new Error(
        "Toast message is empty after context variable substitution"
      );
    }

    // Log the toast details
    console.log("🔔 [NOTIFY-TOAST] Toast details:", {
      message: processedMessage,
      title: processedTitle,
      variant: validVariants.includes(variant) ? variant : "default",
      duration:
        !isNaN(numericDuration) &&
        numericDuration >= 1000 &&
        numericDuration <= 30000
          ? numericDuration
          : 5000,
      position,
    });

    // Return toast data for frontend to display
    return {
      success: true,
      type: "toast",
      toast: {
        message: processedMessage,
        title: processedTitle,
        variant: validVariants.includes(variant) ? variant : "default",
        duration:
          !isNaN(numericDuration) &&
          numericDuration >= 1000 &&
          numericDuration <= 30000
            ? numericDuration
            : 5000,
        position,
      },
      context: context,
    };
  } catch (error) {
    console.error("❌ [NOTIFY-TOAST] Error:", error.message);

    // Return error but don't break workflow execution
    return {
      success: false,
      type: "toast",
      error: error.message,
      toast: {
        message: "Toast notification failed",
        title: "Error",
        variant: "destructive",
        duration: 5000,
      },
      context: context,
    };
  }
};

// PageRedirect block handler
const executePageRedirect = async (node, context, appId, userId = 1) => {
  try {
    console.log("🔄 [PAGE-REDIRECT] Processing page redirect for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    const redirectConfig = node.data || {};
    const { targetPageId, url, openInNewTab } = redirectConfig;

    console.log("🔄 [PAGE-REDIRECT] Redirect configuration:", {
      targetPageId,
      url,
      openInNewTab: openInNewTab || false,
    });

    // Validate redirect target
    if (!targetPageId && !url) {
      throw new Error("No target page ID or URL specified for redirect");
    }

    // Prepare redirect data for frontend
    const redirectData = {
      type: targetPageId ? "page" : "url",
      target: targetPageId || url,
      openInNewTab: openInNewTab || false,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ [PAGE-REDIRECT] Redirect prepared:", redirectData);

    return {
      success: true,
      type: "redirect",
      redirect: redirectData,
      context: {
        ...context,
        redirectProcessed: true,
        redirectTarget: redirectData.target,
        redirectType: redirectData.type,
      },
    };
  } catch (error) {
    console.error("❌ [PAGE-REDIRECT] Error processing redirect:", error);
    return {
      success: false,
      type: "redirect",
      error: error.message,
      context: context,
    };
  }
};

// PageGoBack block handler
const executePageGoBack = async (node, context, appId, userId = 1) => {
  try {
    console.log("⬅️ [PAGE-GO-BACK] Processing page go back for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    console.log("⬅️ [PAGE-GO-BACK] Go back action prepared");

    return {
      success: true,
      type: "goBack",
      context: {
        ...context,
        goBackProcessed: true,
      },
    };
  } catch (error) {
    console.error("❌ [PAGE-GO-BACK] Error processing go back:", error);
    return {
      success: false,
      type: "goBack",
      error: error.message,
      context: context,
    };
  }
};

// AuthVerify block handler
const executeAuthVerify = async (node, context, appId, userId) => {
  try {
    console.log(
      "🔐 [AUTH-VERIFY] Processing authentication verification for app:",
      appId
    );

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    const verifyConfig = node.data || {};
    const {
      token: tokenFromConfig,
      requiredRole,
      requiredRoles = [],
      validateExpiration = true,
      checkBlacklist = true,
    } = verifyConfig;

    console.log("🔐 [AUTH-VERIFY] Verification configuration:", {
      requiredRole,
      requiredRoles,
      validateExpiration,
      checkBlacklist,
    });

    const extractToken = (candidate) => {
      if (!candidate || typeof candidate !== "string") return null;
      const trimmed = candidate.trim();
      if (!trimmed) return null;
      if (/^bearer\s+/i.test(trimmed)) {
        return trimmed.replace(/^bearer\s+/i, "").trim();
      }
      return trimmed;
    };

    const tokenCandidates = [
      context.session?.token,
      context.token,
      context.authToken,
      context.accessToken,
      context.headers?.authorization,
      context.request?.headers?.authorization,
      context.loginResponse?.token,
      context.authResponse?.token,
      context.httpResponse?.data?.token,
      tokenFromConfig,
    ];

    let authToken = null;
    for (const candidate of tokenCandidates) {
      authToken = extractToken(candidate);
      if (authToken) break;
    }

    const buildFailure = ({
      reason,
      message,
      code = 401,
      isAuthenticated = false,
      isAuthorized = false,
    }) => {
      const failureContext = {
        ...context,
        authVerifyResult: {
          isAuthenticated,
          isAuthorized,
          failureReason: reason,
          verifiedAt: new Date().toISOString(),
        },
      };

      return {
        success: false,
        isAuthenticated,
        isAuthorized,
        failureReason: reason,
        errorMessage: message,
        errorCode: code,
        context: failureContext,
      };
    };

    if (!authToken) {
      console.warn("⚠️ [AUTH-VERIFY] No authentication token provided");
      return buildFailure({
        reason: "NO_TOKEN",
        message: "No authentication token provided",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(authToken, process.env.JWT_SECRET, {
        ignoreExpiration: validateExpiration === false,
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        console.warn("⚠️ [AUTH-VERIFY] Token has expired");
        return buildFailure({
          reason: "TOKEN_EXPIRED",
          message: "Authentication token has expired",
        });
      }
      if (error.name === "JsonWebTokenError") {
        console.warn("⚠️ [AUTH-VERIFY] Invalid token");
        return buildFailure({
          reason: "INVALID_TOKEN",
          message: "Invalid authentication token",
        });
      }
      throw error;
    }

    if (checkBlacklist !== false) {
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token: authToken },
      });

      if (blacklisted) {
        console.warn("⚠️ [AUTH-VERIFY] Token is blacklisted");
        return buildFailure({
          reason: "TOKEN_REVOKED",
          message: "Token has been revoked. Please login again",
        });
      }
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      console.warn("⚠️ [AUTH-VERIFY] User not found");
      return buildFailure({
        reason: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (!dbUser.verified) {
      console.warn("⚠️ [AUTH-VERIFY] User account not verified");
      return buildFailure({
        reason: "ACCOUNT_NOT_VERIFIED",
        message: "Account not verified",
        code: 403,
        isAuthenticated: true,
      });
    }

    const roleSet = new Set();
    if (Array.isArray(decoded?.roles)) decoded.roles.forEach((r) => r && roleSet.add(r));
    if (decoded?.role) roleSet.add(decoded.role);
    if (Array.isArray(dbUser?.roles)) dbUser.roles.forEach((r) => r && roleSet.add(r));
    if (dbUser?.role) roleSet.add(dbUser.role);
    if (Array.isArray(context.user?.roles))
      context.user.roles.forEach((r) => r && roleSet.add(r));
    if (context.user?.role) roleSet.add(context.user.role);

    const resolvedRoles = Array.from(roleSet);
    const requiredRoleList = [
      ...requiredRoles,
      ...(requiredRole ? [requiredRole] : []),
    ].filter(Boolean);

    let isAuthorized = true;
    if (requiredRoleList.length > 0) {
      isAuthorized = requiredRoleList.some((role) =>
        resolvedRoles.includes(role)
      );
    }

    const resolvedName =
      context.session?.name ||
      context.user?.name ||
      decoded?.name ||
      decoded?.fullName ||
      decoded?.displayName ||
      (dbUser.email ? dbUser.email.split("@")[0] : undefined);

    const sanitizedUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: resolvedName,
      role: resolvedRoles[0] || dbUser.role || decoded?.role || null,
      roles: resolvedRoles.length > 0 ? resolvedRoles : [dbUser.role].filter(Boolean),
      verified: dbUser.verified,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };

    const loginTimestamp =
      context.session?.loginTimestamp ||
      (decoded?.loginTimestamp
        ? new Date(decoded.loginTimestamp).toISOString()
        : decoded?.iat
        ? new Date(decoded.iat * 1000).toISOString()
        : new Date().toISOString());

    const verifiedAt = new Date().toISOString();

    const session = {
      ...(context.session && typeof context.session === "object"
        ? context.session
        : {}),
      userId: sanitizedUser.id,
      email: sanitizedUser.email,
      name: sanitizedUser.name,
      roles: sanitizedUser.roles,
      token: authToken,
      loginTimestamp,
      validatedAt: verifiedAt,
      user: sanitizedUser,
    };

    const authVerifyResult = {
      isAuthenticated: true,
      isAuthorized,
      failureReason: isAuthorized ? null : "INSUFFICIENT_PERMISSIONS",
      verifiedAt,
      requiredRoles: requiredRoleList,
    };

    if (!isAuthorized) {
      console.warn(
        "⚠️ [AUTH-VERIFY] User lacks required role(s):",
        requiredRoleList
      );
    }

    console.log("✅ [AUTH-VERIFY] Verification outcome:", {
      userId: sanitizedUser.id,
      email: sanitizedUser.email,
      roles: sanitizedUser.roles,
      isAuthorized,
    });

    const enrichedContext = {
      ...context,
      token: authToken,
      isAuthenticated: true,
      isAuthorized,
      user: {
        ...(context.user || {}),
        ...sanitizedUser,
      },
      session,
      authVerifyResult,
      auth: {
        ...(context.auth || {}),
        ...authVerifyResult,
      },
    };

    return {
      success: isAuthorized,
      isAuthenticated: true,
      isAuthorized,
      failureReason: authVerifyResult.failureReason,
      user: sanitizedUser,
      session,
      context: enrichedContext,
    };
  } catch (error) {
    console.error(
      "❌ [AUTH-VERIFY] Error during authentication verification:",
      error
    );
    return {
      success: false,
      isAuthenticated: false,
      isAuthorized: false,
      failureReason: "INTERNAL_ERROR",
      errorMessage: error.message,
      errorCode: 500,
      context,
    };
  }
};

// HttpRequest action block handler
const executeHttpRequest = async (node, context, appId, userId) => {
  try {
    console.log("🌐 [HTTP-REQUEST] Processing HTTP request for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    const config = node.data || {};
    const {
      url,
      method = "GET",
      headers = [],
      bodyType = "none",
      body,
      authType = "none",
      authConfig = {},
      timeout = 30000,
      followRedirects = true,
      validateSSL = true,
      responseType = "json",
      saveResponseTo = "httpResponse",
    } = config;

    // Validate required fields
    if (!url || typeof url !== "string" || url.trim() === "") {
      throw new Error("URL is required for HTTP request");
    }

    // Security: Validate URL to prevent SSRF attacks
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      throw new Error("Invalid URL format");
    }

    // Block localhost and internal IPs
    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254", // AWS metadata
      "metadata.google.internal", // GCP metadata
    ];

    const blockedPorts = [22, 23, 25, 3306, 5432, 6379, 27017];

    if (blockedHosts.includes(urlObj.hostname.toLowerCase())) {
      throw new Error("Access to localhost/internal IPs is not allowed");
    }

    // Check for private IP ranges
    const hostname = urlObj.hostname;
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error("Access to private IP ranges is not allowed");
    }

    if (urlObj.port && blockedPorts.includes(parseInt(urlObj.port))) {
      throw new Error(`Access to port ${urlObj.port} is not allowed`);
    }

    // Build request headers
    const requestHeaders = {};

    // Add custom headers from configuration
    if (Array.isArray(headers)) {
      headers.forEach(({ key, value }) => {
        if (key && value) {
          requestHeaders[key] = value;
        }
      });
    }

    // Add authentication headers
    if (authType === "bearer" && authConfig.token) {
      requestHeaders["Authorization"] = `Bearer ${authConfig.token}`;
    } else if (authType === "api-key" && authConfig.apiKey) {
      const headerName = authConfig.apiKeyHeader || "X-API-Key";
      requestHeaders[headerName] = authConfig.apiKey;
    } else if (
      authType === "basic" &&
      authConfig.username &&
      authConfig.password
    ) {
      const credentials = Buffer.from(
        `${authConfig.username}:${authConfig.password}`
      ).toString("base64");
      requestHeaders["Authorization"] = `Basic ${credentials}`;
    }

    // Build request body
    let requestBody = null;
    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      if (bodyType === "json" && body) {
        try {
          requestBody = typeof body === "string" ? JSON.parse(body) : body;
          requestHeaders["Content-Type"] = "application/json";
        } catch (e) {
          throw new Error("Invalid JSON in request body");
        }
      } else if (bodyType === "raw" && body) {
        requestBody = body;
        if (!requestHeaders["Content-Type"]) {
          requestHeaders["Content-Type"] = "text/plain";
        }
      }
    }

    console.log("🌐 [HTTP-REQUEST] Request details:", {
      url,
      method,
      headersCount: Object.keys(requestHeaders).length,
      hasBody: !!requestBody,
      timeout,
    });

    const requestStartTime = new Date();

    // Make HTTP request using axios
    const axios = require("axios");
    const https = require("https");

    const response = await axios({
      url,
      method: method.toUpperCase(),
      headers: requestHeaders,
      data: requestBody,
      timeout,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: () => true, // Don't throw on any status code
      httpsAgent: validateSSL
        ? undefined
        : new https.Agent({
            rejectUnauthorized: false,
          }),
      maxContentLength: 10 * 1024 * 1024, // 10MB max response size
      maxBodyLength: 10 * 1024 * 1024, // 10MB max request size
    });

    const requestEndTime = new Date();
    const duration = requestEndTime - requestStartTime;

    // Determine success based on status code
    const isSuccess = response.status >= 200 && response.status < 300;

    console.log(
      `${isSuccess ? "✅" : "❌"} [HTTP-REQUEST] Response received:`,
      {
        statusCode: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        dataSize: JSON.stringify(response.data).length,
      }
    );

    // Build response object
    const responseData = {
      success: isSuccess,
      statusCode: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      timing: {
        requestSentAt: requestStartTime.toISOString(),
        responseReceivedAt: requestEndTime.toISOString(),
        duration,
      },
    };

    // Add to context
    const updatedContext = {
      ...context,
      [saveResponseTo]: responseData,
    };

    return {
      success: isSuccess,
      isValid: isSuccess, // For conditional branching
      message: `HTTP ${method} request completed with status ${response.status}`,
      context: updatedContext,
    };
  } catch (error) {
    console.error("❌ [HTTP-REQUEST] Error:", error);

    // Determine error type
    let errorType = "UNKNOWN_ERROR";
    let errorMessage = error.message;

    if (error.code === "ECONNABORTED") {
      errorType = "TIMEOUT";
      errorMessage = "Request timed out";
    } else if (error.code === "ENOTFOUND") {
      errorType = "DNS_ERROR";
      errorMessage = "Could not resolve hostname";
    } else if (error.code === "ECONNREFUSED") {
      errorType = "CONNECTION_REFUSED";
      errorMessage = "Connection refused by server";
    } else if (error.code === "ETIMEDOUT") {
      errorType = "TIMEOUT";
      errorMessage = "Connection timed out";
    } else if (error.response) {
      errorType = "HTTP_ERROR";
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    }

    return {
      success: false,
      isValid: false, // For conditional branching
      error: errorType,
      errorMessage,
      context: {
        ...context,
        httpResponse: {
          success: false,
          error: errorType,
          errorMessage,
          timing: {
            requestSentAt: new Date().toISOString(),
            failed: true,
          },
        },
      },
    };
  }
};

// AI Summarize action block handler
const executeAiSummarize = async (node, context, appId, userId) => {
  try {
    console.log(
      "🧠 [AI-SUMMARIZE] Processing AI summarization for app:",
      appId
    );

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const {
      fileVariable,
      apiKey,
      outputVariable = "aiSummary",
    } = node.data || {};

    // Validate required fields
    if (!fileVariable) {
      throw new Error("File upload element is required for AI summarization");
    }

    if (!apiKey) {
      throw new Error("Gemini API key is required for AI summarization");
    }

    console.log("🧠 [AI-SUMMARIZE] Configuration:", {
      fileVariable,
      outputVariable,
    });

    // Get file data from context
    // fileVariable now contains the element ID, so we need to look it up in context
    let fileData = null;

    // Try multiple ways to find the file data:
    // 1. Direct context key (if fileVariable is a variable name)
    fileData = context[fileVariable];

    // 2. If not found, try looking in dropResult (for onDrop files)
    if (!fileData && context.dropResult && context.dropResult.files) {
      // If fileVariable is an element ID, try to find it in dropResult
      fileData = context.dropResult.files[0]; // Get first file from drop
    }

    // 3. If still not found, try looking for files by element ID in context
    if (!fileData) {
      // Look for any file data in context that matches the element ID
      for (const key in context) {
        if (
          context[key] &&
          typeof context[key] === "object" &&
          (context[key].elementId === fileVariable ||
            context[key].id === fileVariable)
        ) {
          fileData = context[key];
          break;
        }
      }
    }

    if (!fileData) {
      throw new Error(
        `File data not found for element "${fileVariable}". Make sure a file is uploaded first.`
      );
    }

    console.log("🧠 [AI-SUMMARIZE] File data retrieved:", {
      filename: fileData.filename || fileData.originalName,
      size: fileData.size,
      mimeType: fileData.mimeType,
    });

    // Validate file path exists
    if (!fileData.path) {
      throw new Error("File path not found in file data");
    }

    // Check if file exists on disk
    const fs = require("fs");
    if (!fs.existsSync(fileData.path)) {
      throw new Error(`File not found at path: ${fileData.path}`);
    }

    // Extract text from file
    const {
      extractTextFromFile,
      isSupportedFileType,
    } = require("../utils/text-extractor");

    if (!isSupportedFileType(fileData.mimeType)) {
      throw new Error(
        `Unsupported file type: ${fileData.mimeType}. Supported types: PDF, DOCX, TXT`
      );
    }

    console.log("🧠 [AI-SUMMARIZE] Extracting text from file...");
    const extractedText = await extractTextFromFile(
      fileData.path,
      fileData.mimeType
    );

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text content found in the uploaded file");
    }

    console.log("🧠 [AI-SUMMARIZE] Text extracted successfully:", {
      textLength: extractedText.length,
    });

    // Summarize text using Gemini
    const { summarizeText } = require("../utils/ai-summarizer");

    console.log("🧠 [AI-SUMMARIZE] Starting summarization with Gemini...");
    const summary = await summarizeText(extractedText, apiKey);

    console.log("✅ [AI-SUMMARIZE] Summarization completed successfully:", {
      summaryLength: summary.length,
      compressionRatio: (
        (1 - summary.length / extractedText.length) *
        100
      ).toFixed(2),
    });

    // Store file metadata in database for tracking
    try {
      await prisma.mediaFile.update({
        where: { id: fileData.id || 0 },
        data: {
          workflowId: context.workflowId || null,
          metadata: {
            ...fileData.metadata,
            summarized: true,
            summarizedAt: new Date().toISOString(),
            summaryLength: summary.length,
          },
        },
      });
    } catch (dbError) {
      console.warn(
        "⚠️ [AI-SUMMARIZE] Could not update file metadata:",
        dbError.message
      );
      // Don't fail the workflow if metadata update fails
    }

    const compressionRatio = (
      (1 - summary.length / extractedText.length) *
      100
    ).toFixed(2);

    return {
      success: true,
      type: "aiSummary",
      summary: {
        text: summary,
        summary: summary,
        originalLength: extractedText.length,
        summaryLength: summary.length,
        compressionRatio: parseFloat(compressionRatio) / 100,
        fileName: fileData.filename || fileData.originalName,
        fileSize: fileData.size,
      },
      [outputVariable]: summary,
      summaryMetadata: {
        originalLength: extractedText.length,
        summaryLength: summary.length,
        compressionRatio: parseFloat(compressionRatio) / 100,
        fileName: fileData.filename || fileData.originalName,
        fileSize: fileData.size,
      },
      context: {
        ...context,
        [outputVariable]: summary,
        aiSummaryMetadata: {
          originalLength: extractedText.length,
          summaryLength: summary.length,
          compressionRatio: parseFloat(compressionRatio) / 100,
          fileName: fileData.filename || fileData.originalName,
          fileSize: fileData.size,
        },
      },
    };
  } catch (error) {
    console.error("❌ [AI-SUMMARIZE] Error:", error.message);

    return {
      success: false,
      type: "aiSummary",
      error: error.message,
      context: context,
    };
  }
};

// File Upload action block handler
const executeFileUpload = async (node, context, appId, userId) => {
  try {
    console.log("📤 [FILE-UPLOAD] Processing file upload action for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    const config = node.data || {};
    const {
      fileUploadElementId,
      fileUploadOutputVariable,
      allowedFileTypes,
      fileUploadMaxSizeMB,
    } = config;

    // Try to resolve file data from several possible context locations
    let fileData = null;

    if (fileUploadElementId) {
      fileData =
        (context.uploadedFiles && context.uploadedFiles[fileUploadElementId]) ||
        context[fileUploadElementId] ||
        (context.formData && context.formData[fileUploadElementId]) ||
        null;
    }

    // Fallback to output variable if provided
    if (!fileData && fileUploadOutputVariable) {
      fileData = context[fileUploadOutputVariable] || null;
    }

    if (!fileData) {
      throw new Error(
        "No file found for file.upload. Ensure a file was uploaded and referenced by the configured element or variable."
      );
    }

    // If the client already uploaded the file, metadata should include path/url/filename
    const fileMeta = {
      id: fileData.id || fileData.mediaId || null,
      filename: fileData.filename || fileData.originalName || fileData.name,
      url: fileData.url || (fileData.filename ? `/api/media/files/${fileData.filename}` : undefined),
      mimeType: fileData.mimeType || fileData.mimetype || fileData.type,
      size: fileData.size || fileData.length || null,
      path: fileData.path || null,
    };

    // Basic validation: file type and size if configured
    if (allowedFileTypes && fileMeta.mimeType) {
      const allowed = String(allowedFileTypes)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length > 0) {
        const matches = allowed.some((a) => fileMeta.mimeType.includes(a));
        if (!matches) {
          throw new Error(
            `Uploaded file type '${fileMeta.mimeType}' is not allowed by block configuration`
          );
        }
      }
    }

    if (fileUploadMaxSizeMB && fileMeta.size) {
      const maxBytes = parseFloat(fileUploadMaxSizeMB) * 1024 * 1024;
      if (fileMeta.size > maxBytes) {
        throw new Error(
          `Uploaded file size ${fileMeta.size} exceeds configured limit of ${fileUploadMaxSizeMB}MB`
        );
      }
    }

    // Prepare result context variable name
    const outVar = fileUploadOutputVariable || fileUploadElementId || "lastUploadedFile";

    const resultContext = {
      [outVar]: fileMeta,
      lastUploadedFile: fileMeta,
    };

    console.log("📤 [FILE-UPLOAD] File processed:", fileMeta.filename || fileMeta.url);

    return {
      success: true,
      type: "fileUpload",
      message: "File resolved for workflow",
      file: fileMeta,
      context: resultContext,
    };
  } catch (error) {
    console.error("❌ [FILE-UPLOAD] Error:", error.message);
    return {
      success: false,
      type: "fileUpload",
      error: error.message,
      context: context,
    };
  }
};

// File Download action block handler
const executeFileDownload = async (node, context, appId, userId) => {
  try {
    console.log("📥 [FILE-DOWNLOAD] Processing file download action for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    const config = node.data || {};
    const {
      downloadSourceType = "url",
      downloadUrl,
      downloadContextKey,
      downloadPath,
      downloadFileName,
      downloadMimeType,
    } = config;

    let resolvedUrl = null;
    let fileName = downloadFileName || "download";
    let mimeType = downloadMimeType || undefined;

    if (downloadSourceType === "url") {
      if (!downloadUrl) {
        throw new Error("No download URL configured");
      }
      resolvedUrl = substituteContextVariables(downloadUrl, context);

      // Basic SSRF safety checks reuse logic from HTTP request
      let urlObj;
      try {
        urlObj = new URL(resolvedUrl);
      } catch (e) {
        throw new Error("Invalid download URL format");
      }

      const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "169.254.169.254",
      ];
      if (blockedHosts.includes(urlObj.hostname.toLowerCase())) {
        throw new Error("Access to localhost/internal hosts is not allowed");
      }

      if (urlObj.port) {
        const blockedPorts = [22, 23, 25, 3306, 5432, 6379, 27017];
        if (blockedPorts.includes(parseInt(urlObj.port))) {
          throw new Error(`Access to port ${urlObj.port} is not allowed`);
        }
      }

      fileName = downloadFileName || path.basename(urlObj.pathname) || fileName;
    } else if (downloadSourceType === "context") {
      if (!downloadContextKey) {
        throw new Error("No context key configured for download source");
      }
      const fileObj = context[downloadContextKey] || (context.uploadedFiles && context.uploadedFiles[downloadContextKey]);
      if (!fileObj) {
        throw new Error(`No file found in context under key '${downloadContextKey}'`);
      }

      if (fileObj.url) {
        resolvedUrl = fileObj.url;
      } else if (fileObj.filename) {
        resolvedUrl = `/api/media/files/${fileObj.filename}`;
      } else if (fileObj.path) {
        // Try to find media record by path
        const mediaRec = await prisma.mediaFile.findFirst({ where: { path: fileObj.path } });
        if (mediaRec && mediaRec.filename) {
          resolvedUrl = `/api/media/files/${mediaRec.filename}`;
        } else {
          throw new Error("File path provided but media record not found");
        }
      } else {
        throw new Error("Context file object does not contain a usable URL or filename");
      }

      fileName = downloadFileName || fileObj.originalName || fileObj.filename || fileName;
      mimeType = mimeType || fileObj.mimeType || fileObj.mimetype;
    } else if (downloadSourceType === "path") {
      if (!downloadPath) {
        throw new Error("No server path configured for download");
      }
      // If a server path is provided, attempt to locate corresponding media record
      const mediaRec = await prisma.mediaFile.findFirst({ where: { path: downloadPath } });
      if (!mediaRec) {
        throw new Error("No media record found for provided path");
      }
      if (!mediaRec.filename) {
        throw new Error("Media record does not include a filename for URL construction");
      }
      resolvedUrl = `/api/media/files/${mediaRec.filename}`;
      fileName = downloadFileName || mediaRec.originalName || mediaRec.filename;
      mimeType = mimeType || mediaRec.mimeType;
    } else {
      throw new Error(`Unknown downloadSourceType: ${downloadSourceType}`);
    }

    console.log("📥 [FILE-DOWNLOAD] Resolved download URL:", resolvedUrl);

    return {
      success: true,
      type: "download",
      download: {
        url: resolvedUrl,
        fileName,
        mimeType,
      },
      context: {
        ...context,
        lastDownload: {
          url: resolvedUrl,
          fileName,
          mimeType,
        },
      },
    };
  } catch (error) {
    console.error("❌ [FILE-DOWNLOAD] Error:", error.message);
    return {
      success: false,
      type: "download",
      error: error.message,
      context: context,
    };
  }
};

// Match block handler
const executeMatch = async (node, context, appId, userId) => {
  try {
    console.log("🔍 [MATCH] Processing match condition for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const {
      leftValue,
      rightValue,
      comparisonType = "text",
      operator = "equals",
      options = {},
    } = node.data || {};

    // Validate required fields
    if (leftValue === undefined || leftValue === null) {
      throw new Error("Left value is required for match comparison");
    }

    if (rightValue === undefined || rightValue === null) {
      throw new Error("Right value is required for match comparison");
    }

    // Substitute context variables
    const processedLeft = substituteContextVariables(
      String(leftValue),
      context
    );
    const processedRight = substituteContextVariables(
      String(rightValue),
      context
    );

    console.log(
      `🔍 [MATCH] Comparing: "${processedLeft}" ${operator} "${processedRight}" (${comparisonType})`
    );

    // Perform comparison based on type
    let matches = false;

    try {
      switch (comparisonType) {
        case "text":
          matches = performTextComparison(
            processedLeft,
            processedRight,
            operator,
            options
          );
          break;
        case "number":
          matches = performNumberComparison(
            processedLeft,
            processedRight,
            operator,
            options
          );
          break;
        case "date":
          matches = performDateComparison(
            processedLeft,
            processedRight,
            operator,
            options
          );
          break;
        case "list":
          matches = performListComparison(
            processedLeft,
            processedRight,
            operator,
            options
          );
          break;
        default:
          console.warn(
            `⚠️ [MATCH] Unknown comparison type '${comparisonType}', using text comparison`
          );
          matches = performTextComparison(
            processedLeft,
            processedRight,
            operator,
            options
          );
      }
    } catch (comparisonError) {
      console.error("❌ [MATCH] Comparison error:", comparisonError.message);
      throw new Error(`Match comparison failed: ${comparisonError.message}`);
    }

    console.log(`🔍 [MATCH] Result: ${matches ? "✅ MATCH" : "❌ NO MATCH"}`);

    return {
      success: true,
      matches: matches,
      leftValue: processedLeft,
      rightValue: processedRight,
      operator: operator,
      comparisonType: comparisonType,
      context: context,
    };
  } catch (error) {
    console.error("❌ [MATCH] Error:", error.message);
    return {
      success: false,
      error: error.message,
      matches: false,
      context: context,
    };
  }
};

// Text comparison helper function
const performTextComparison = (left, right, operator, options = {}) => {
  const { ignoreCase = false, trimSpaces = false } = options;

  // Process values based on options
  let leftVal = String(left);
  let rightVal = String(right);

  if (trimSpaces) {
    leftVal = leftVal.trim();
    rightVal = rightVal.trim();
  }

  if (ignoreCase) {
    leftVal = leftVal.toLowerCase();
    rightVal = rightVal.toLowerCase();
  }

  switch (operator) {
    case "equals":
    case "equals_exactly":
      return leftVal === rightVal;
    case "not_equals":
      return leftVal !== rightVal;
    case "contains":
      return leftVal.includes(rightVal);
    case "not_contains":
      return !leftVal.includes(rightVal);
    case "starts_with":
      return leftVal.startsWith(rightVal);
    case "ends_with":
      return leftVal.endsWith(rightVal);
    case "is_empty":
      return leftVal === "" || leftVal === null || leftVal === undefined;
    case "is_not_empty":
      return leftVal !== "" && leftVal !== null && leftVal !== undefined;
    case "matches_pattern":
      try {
        const regex = new RegExp(rightVal, ignoreCase ? "i" : "");
        return regex.test(leftVal);
      } catch (regexError) {
        throw new Error(`Invalid regex pattern: ${rightVal}`);
      }
    default:
      throw new Error(`Unknown text operator: ${operator}`);
  }
};

// Number comparison helper function
const performNumberComparison = (left, right, operator, options = {}) => {
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);

  if (isNaN(leftNum)) {
    throw new Error(`Left value "${left}" is not a valid number`);
  }

  if (isNaN(rightNum) && !["is_number", "is_not_number"].includes(operator)) {
    throw new Error(`Right value "${right}" is not a valid number`);
  }

  switch (operator) {
    case "equals":
      return leftNum === rightNum;
    case "not_equals":
      return leftNum !== rightNum;
    case "greater_than":
      return leftNum > rightNum;
    case "less_than":
      return leftNum < rightNum;
    case "greater_than_or_equal":
    case "at_least":
      return leftNum >= rightNum;
    case "less_than_or_equal":
    case "at_most":
      return leftNum <= rightNum;
    case "between":
      // For between, expect rightVal to be "min,max" format
      const [min, max] = String(right)
        .split(",")
        .map((v) => parseFloat(v.trim()));
      if (isNaN(min) || isNaN(max)) {
        throw new Error(
          `Between operator requires "min,max" format, got: ${right}`
        );
      }
      return leftNum >= min && leftNum <= max;
    case "is_number":
      return !isNaN(leftNum);
    case "is_not_number":
      return isNaN(leftNum);
    default:
      throw new Error(`Unknown number operator: ${operator}`);
  }
};

// Date comparison helper function
const performDateComparison = (left, right, operator, options = {}) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  if (isNaN(leftDate.getTime())) {
    throw new Error(`Left value "${left}" is not a valid date`);
  }

  // Special operators that don't need right date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (operator) {
    case "equals":
    case "is_exactly":
      if (isNaN(rightDate.getTime())) {
        throw new Error(`Right value "${right}" is not a valid date`);
      }
      return leftDate.getTime() === rightDate.getTime();
    case "not_equals":
      if (isNaN(rightDate.getTime())) {
        throw new Error(`Right value "${right}" is not a valid date`);
      }
      return leftDate.getTime() !== rightDate.getTime();
    case "is_after":
      if (isNaN(rightDate.getTime())) {
        throw new Error(`Right value "${right}" is not a valid date`);
      }
      return leftDate > rightDate;
    case "is_before":
      if (isNaN(rightDate.getTime())) {
        throw new Error(`Right value "${right}" is not a valid date`);
      }
      return leftDate < rightDate;
    case "is_today":
      const leftDateOnly = new Date(
        leftDate.getFullYear(),
        leftDate.getMonth(),
        leftDate.getDate()
      );
      return leftDateOnly.getTime() === today.getTime();
    case "is_this_week":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return leftDate >= startOfWeek && leftDate <= endOfWeek;
    case "is_this_month":
      return (
        leftDate.getFullYear() === now.getFullYear() &&
        leftDate.getMonth() === now.getMonth()
      );
    case "is_within_last_days":
      const days = parseInt(right);
      if (isNaN(days)) {
        throw new Error(
          `Right value "${right}" must be a number for within_last_days operator`
        );
      }
      const daysAgo = new Date(now);
      daysAgo.setDate(now.getDate() - days);
      return leftDate >= daysAgo && leftDate <= now;
    case "is_within_next_days":
      const nextDays = parseInt(right);
      if (isNaN(nextDays)) {
        throw new Error(
          `Right value "${right}" must be a number for within_next_days operator`
        );
      }
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + nextDays);
      return leftDate >= now && leftDate <= futureDate;
    default:
      throw new Error(`Unknown date operator: ${operator}`);
  }
};

// List comparison helper function
const performListComparison = (left, right, operator, options = {}) => {
  const { ignoreCase = false } = options;

  // Parse left value as array if it's a string
  let leftArray;
  try {
    leftArray = typeof left === "string" ? JSON.parse(left) : left;
  } catch (parseError) {
    // If not JSON, treat as comma-separated string
    leftArray = String(left)
      .split(",")
      .map((item) => item.trim());
  }

  if (!Array.isArray(leftArray)) {
    throw new Error(`Left value "${left}" is not a valid array or list`);
  }

  // Parse right value based on operator
  let rightArray;
  if (["includes", "not_includes"].includes(operator)) {
    // Single value comparison
    rightArray = [String(right)];
  } else {
    // Multiple values comparison
    try {
      rightArray = typeof right === "string" ? JSON.parse(right) : right;
    } catch (parseError) {
      // If not JSON, treat as comma-separated string
      rightArray = String(right)
        .split(",")
        .map((item) => item.trim());
    }

    if (!Array.isArray(rightArray)) {
      rightArray = [String(right)];
    }
  }

  // Apply case insensitive comparison if needed
  if (ignoreCase) {
    leftArray = leftArray.map((item) => String(item).toLowerCase());
    rightArray = rightArray.map((item) => String(item).toLowerCase());
  } else {
    leftArray = leftArray.map((item) => String(item));
    rightArray = rightArray.map((item) => String(item));
  }

  switch (operator) {
    case "includes":
      return leftArray.includes(rightArray[0]);
    case "not_includes":
      return !leftArray.includes(rightArray[0]);
    case "includes_any_of":
      return rightArray.some((item) => leftArray.includes(item));
    case "includes_all_of":
      return rightArray.every((item) => leftArray.includes(item));
    case "includes_none_of":
      return !rightArray.some((item) => leftArray.includes(item));
    case "has_length":
      const expectedLength = parseInt(right);
      if (isNaN(expectedLength)) {
        throw new Error(
          `Right value "${right}" must be a number for has_length operator`
        );
      }
      return leftArray.length === expectedLength;
    case "has_length_greater_than":
      const minLength = parseInt(right);
      if (isNaN(minLength)) {
        throw new Error(
          `Right value "${right}" must be a number for has_length_greater_than operator`
        );
      }
      return leftArray.length > minLength;
    case "has_length_less_than":
      const maxLength = parseInt(right);
      if (isNaN(maxLength)) {
        throw new Error(
          `Right value "${right}" must be a number for has_length_less_than operator`
        );
      }
      return leftArray.length < maxLength;
    case "is_empty":
      return leftArray.length === 0;
    case "is_not_empty":
      return leftArray.length > 0;
    default:
      throw new Error(`Unknown list operator: ${operator}`);
  }
};

// Context variable substitution helper
const substituteContextVariables = (value, context) => {
  if (typeof value !== "string") return value;

  return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let result = context;

    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) break;
    }

    return result !== undefined ? result : match;
  });
};

// Verify HMAC signature helper (uses JSON.stringify(payload) as canonical representation)
const verifyHmacSignature = (payload, providedSignature, secret) => {
  try {
    if (!providedSignature || !secret) return false;

    const crypto = require('crypto');
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Allow headers like 'sha256=...' or raw hex
    let expectedPrefix = 'sha256=';
    let provided = providedSignature;
    if (provided.startsWith('sha256=')) provided = provided.slice(7);

    const hmac = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    const a = Buffer.from(hmac, 'hex');
    let b;
    try {
      b = Buffer.from(provided, 'hex');
    } catch (e) {
      // Provided signature not hex - fail
      return false;
    }

    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
};

// Role checking block handler
const executeRoleIs = async (node, context, appId, userId) => {
  try {
    console.log("👤 [ROLE-IS] Processing role check for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const { requiredRole, checkMultiple = false, roles = [] } = node.data || {};

    // Get user from context or database
    let userRole = null;
    let userRoles = [];

    // First, check if user role is in context (from onLogin or auth.verify)
    if (context.user?.role) {
      userRole = context.user.role;
      console.log(`👤 [ROLE-IS] User role from context: ${userRole}`);
    }

    if (Array.isArray(context.user?.roles) && context.user.roles.length > 0) {
      userRoles = context.user.roles;
      if (!userRole) {
        userRole = context.user.roles[0];
      }
      console.log(`👤 [ROLE-IS] User roles from context: ${userRoles.join(", ")}`);
    }

    if (!userRole && Array.isArray(context.session?.roles)) {
      userRoles = context.session.roles;
      userRole = context.session.roles[0];
      console.log(`👤 [ROLE-IS] User roles from session: ${userRoles.join(", ")}`);
    }

    if (!userRole && userId) {
      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user) {
        userRole = user.role;
        userRoles = [user.role];
        console.log(`👤 [ROLE-IS] User role from database: ${userRole}`);
      }
    }

    if (!userRole) {
      console.log("👤 [ROLE-IS] No user role found");
      return {
        success: true,
        isValid: false,
        message: "User role not found",
        context: context,
      };
    }

    const effectiveUserRoles = userRoles.length > 0 ? userRoles : [userRole];

    // Check role based on configuration
    let isValid = false;

    if (checkMultiple && roles && roles.length > 0) {
      // Check if user has any of the specified roles
      isValid = roles.some((role) => effectiveUserRoles.includes(role));
      console.log(
        `👤 [ROLE-IS] Checking if user role "${userRole}" is in [${roles.join(
          ", "
        )}]: ${isValid}`
      );
    } else if (requiredRole) {
      // Check if user has the required role
      isValid = effectiveUserRoles.includes(requiredRole);
      console.log(
        `👤 [ROLE-IS] Checking if user role "${userRole}" equals "${requiredRole}": ${isValid}`
      );
    } else {
      throw new Error("No role configuration provided");
    }

    return {
      success: true,
      isValid: isValid,
      message: isValid
        ? `User has required role: ${userRole}`
        : `User role "${userRole}" does not match required role(s)`,
      userRole: userRole,
      context: {
        ...context,
        roleCheckResult: {
          userRole: userRole,
          userRoles: effectiveUserRoles,
          isValid: isValid,
          requiredRole: requiredRole,
          roles: roles,
        },
      },
    };
  } catch (error) {
    console.error("❌ [ROLE-IS] Error:", error.message);
    return {
      success: false,
      isValid: false,
      error: error.message,
      context: context,
    };
  }
};

// Date utility functions
const parseDate = (dateValue, format) => {
  if (!dateValue) return null;

  // Handle different input types
  if (dateValue instanceof Date) {
    return dateValue;
  }

  const dateStr = String(dateValue).trim();
  if (!dateStr) return null;

  // Auto-detect format if not specified
  if (!format || format === "auto-detect") {
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const date = new Date(dateStr + "T00:00:00.000Z");
      if (!isNaN(date.getTime())) return date;
    }

    // Try MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split("/");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }

    // Try DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }

    // Try DD-MM-YYYY format
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }

    // Try native Date parsing as fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    return null;
  }

  // Parse according to specified format
  switch (format) {
    case "YYYY-MM-DD":
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr + "T00:00:00.000Z");
      }
      break;

    case "MM/DD/YYYY":
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split("/");
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      break;

    case "DD/MM/YYYY":
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split("/");
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      break;

    case "DD-MM-YYYY":
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split("-");
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      break;

    default:
      // Try native parsing for custom formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
  }

  return null;
};

const formatDate = (date, format) => {
  if (!date || isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (format) {
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "DD-MM-YYYY":
      return `${day}-${month}-${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
};

const isLeapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const calculateAge = (birthDate, currentDate) => {
  const birth = new Date(birthDate);
  const current = new Date(currentDate);

  let age = current.getFullYear() - birth.getFullYear();
  const monthDiff = current.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && current.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
};

// Date validation helper function
const validateDateValue = (dateValue, rules, format) => {
  const errors = [];
  let isValid = true;
  let parsedDate = null;
  let formattedDate = null;

  // Check if value is provided when required
  if (rules.required && (!dateValue || dateValue.trim() === "")) {
    errors.push("Date is required");
    return { isValid: false, errors, parsedDate, formattedDate };
  }

  // If not required and empty, consider it valid
  if (!rules.required && (!dateValue || dateValue.trim() === "")) {
    return { isValid: true, errors: [], parsedDate: null, formattedDate: null };
  }

  // Parse the date value
  try {
    parsedDate = parseDate(dateValue, format);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      errors.push(
        `Invalid date format. Expected: ${
          format || "YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY"
        }`
      );
      isValid = false;
      return { isValid, errors, parsedDate: null, formattedDate };
    }
    formattedDate = formatDate(parsedDate, format || "YYYY-MM-DD");
  } catch (error) {
    errors.push(`Date parsing error: ${error.message}`);
    isValid = false;
    return { isValid, errors, parsedDate: null, formattedDate };
  }

  // Validate date range - minimum date
  if (rules.minDate) {
    const minDate = parseDate(rules.minDate, format);
    if (minDate && parsedDate < minDate) {
      errors.push(
        `Date must be after ${formatDate(minDate, format || "YYYY-MM-DD")}`
      );
      isValid = false;
    }
  }

  // Validate date range - maximum date
  if (rules.maxDate) {
    const maxDate = parseDate(rules.maxDate, format);
    if (maxDate && parsedDate > maxDate) {
      errors.push(
        `Date must be before ${formatDate(maxDate, format || "YYYY-MM-DD")}`
      );
      isValid = false;
    }
  }

  // Validate business days only
  if (rules.businessDaysOnly) {
    const dayOfWeek = parsedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday = 0, Saturday = 6
      errors.push("Date must be a business day (Monday-Friday)");
      isValid = false;
    }
  }

  // Validate future dates only
  if (rules.futureOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);
    if (parsedDate <= today) {
      errors.push("Date must be in the future");
      isValid = false;
    }
  }

  // Validate past dates only
  if (rules.pastOnly) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    parsedDate.setHours(0, 0, 0, 0);
    if (parsedDate >= today) {
      errors.push("Date must be in the past");
      isValid = false;
    }
  }

  // Validate excluded dates
  if (rules.excludedDates && rules.excludedDates.length > 0) {
    const dateString = formatDate(parsedDate, "YYYY-MM-DD");
    if (rules.excludedDates.includes(dateString)) {
      errors.push("This date is not available");
      isValid = false;
    }
  }

  // Validate allowed days of week
  if (rules.allowedDaysOfWeek && rules.allowedDaysOfWeek.length > 0) {
    const dayOfWeek = parsedDate.getDay();
    if (!rules.allowedDaysOfWeek.includes(dayOfWeek)) {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const allowedDayNames = rules.allowedDaysOfWeek.map(
        (day) => dayNames[day]
      );
      errors.push(`Date must be on: ${allowedDayNames.join(", ")}`);
      isValid = false;
    }
  }

  // Validate leap year dates
  if (
    rules.noLeapYear &&
    isLeapYear(parsedDate.getFullYear()) &&
    parsedDate.getMonth() === 1 &&
    parsedDate.getDate() === 29
  ) {
    errors.push("February 29th is not allowed");
    isValid = false;
  }

  // Validate age restrictions (for birth dates)
  if (rules.minAge || rules.maxAge) {
    const today = new Date();
    const age = calculateAge(parsedDate, today);

    if (rules.minAge && age < rules.minAge) {
      errors.push(`Age must be at least ${rules.minAge} years`);
      isValid = false;
    }

    if (rules.maxAge && age > rules.maxAge) {
      errors.push(`Age must be no more than ${rules.maxAge} years`);
      isValid = false;
    }
  }

  return { isValid, errors, parsedDate, formattedDate };
};

// DateValid block handler
const executeDateValid = async (node, context, appId) => {
  try {
    console.log("📅 [DATE-VALID] Starting date validation for app:", appId);

    const dateConfig = node.data || {};
    const { selectedElementIds, dateFormat, validationRules } = dateConfig;

    if (!selectedElementIds || selectedElementIds.length === 0) {
      console.warn("⚠️ [DATE-VALID] No date elements selected");
      return {
        success: false,
        error: "No date elements selected for validation",
        isValid: false,
        context: context,
      };
    }

    // Get form data from context (passed from frontend)
    const formData = context.formData || {};
    const validationResults = [];
    let allValid = true;
    let anyValid = false;

    console.log("📋 [DATE-VALID] Validation details:", {
      selectedElementIds,
      dateFormat: dateFormat || "auto-detect",
      validationRules: validationRules || {},
      formDataKeys: Object.keys(formData),
    });

    // Validate each selected date element
    for (const elementId of selectedElementIds) {
      const dateValue = formData[elementId];
      console.log(
        `📅 [DATE-VALID] Validating element ${elementId}:`,
        dateValue
      );

      const validation = validateDateValue(
        dateValue,
        validationRules || {},
        dateFormat
      );

      validationResults.push({
        elementId,
        value: dateValue,
        isValid: validation.isValid,
        errors: validation.errors,
        parsedDate: validation.parsedDate,
        formattedDate: validation.formattedDate,
      });

      if (!validation.isValid) {
        allValid = false;
      } else {
        anyValid = true;
      }
    }

    console.log("✅ [DATE-VALID] Validation complete:", {
      allValid,
      anyValid,
      validCount: validationResults.filter((r) => r.isValid).length,
      totalCount: validationResults.length,
    });

    return {
      success: true,
      isValid: allValid,
      allValid,
      anyValid,
      validationResults,
      elementCount: selectedElementIds.length,
      validCount: validationResults.filter((r) => r.isValid).length,
      message: `${validationResults.filter((r) => r.isValid).length}/${
        selectedElementIds.length
      } dates are valid`,
      context: {
        ...context,
        dateValidation: {
          results: validationResults,
          allValid,
          anyValid,
          validatedAt: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ [DATE-VALID] Error:", error);
    return {
      success: false,
      error: error.message,
      isValid: false,
      context: context,
    };
  }
};

// OnDrop block handler
const executeOnDrop = async (node, context, appId, userId = 1) => {
  try {
    console.log("📁 [ON-DROP] Processing file drop for app:", appId);

    const dropConfig = node.data || {};
    const { files, position, elementId } = context.dropData || {};

    if (!files || files.length === 0) {
      return {
        success: false,
        error: "No files provided in drop event",
        context: context,
      };
    }

    console.log("📁 [ON-DROP] Drop configuration:", {
      acceptedTypes: dropConfig.acceptedTypes,
      maxFileSize: dropConfig.maxFileSize,
      allowMultiple: dropConfig.allowMultiple,
      targetElementId: dropConfig.targetElementId,
    });

    console.log("📁 [ON-DROP] Drop data:", {
      filesCount: files.length,
      elementId,
      position,
    });

    // Validate file types and sizes
    const validationResults = [];
    const processedFiles = [];

    for (const file of files) {
      const validation = validateDroppedFile(file, dropConfig);
      validationResults.push(validation);

      if (validation.valid) {
        try {
          // Process valid file (upload, store metadata)
          const processedFile = await processDroppedFile(
            file,
            appId,
            elementId,
            position,
            userId
          );
          processedFiles.push(processedFile);
          console.log(
            "✅ [ON-DROP] File processed successfully:",
            processedFile.name
          );
        } catch (error) {
          console.error("❌ [ON-DROP] File processing error:", error);
          validationResults[validationResults.length - 1].valid = false;
          validationResults[validationResults.length - 1].errors.push(
            `Processing failed: ${error.message}`
          );
        }
      } else {
        console.warn("⚠️ [ON-DROP] File validation failed:", validation.errors);
      }
    }

    const successCount = processedFiles.length;
    const totalCount = files.length;

    // Auto-update element properties if files were successfully uploaded
    // This makes dropped images automatically visible on shape elements
    if (successCount > 0 && elementId && processedFiles.length > 0) {
      try {
        const firstFile = processedFiles[0];

        // Only update if it's an image file
        if (firstFile.type && firstFile.type.startsWith("image/")) {
          console.log(
            `🖼️ [ON-DROP] Auto-updating element ${elementId} with image: ${firstFile.url}`
          );

          // Update element properties to display the dropped image
          const element = await prisma.canvasElement.findUnique({
            where: { elementId: elementId },
          });

          if (element) {
            await prisma.canvasElement.update({
              where: { elementId: elementId },
              data: {
                properties: {
                  ...element.properties,
                  backgroundImage: firstFile.url,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                },
              },
            });

            console.log(
              `✅ [ON-DROP] Element ${elementId} updated with background image`
            );
          }
        }
      } catch (updateError) {
        console.error(
          "⚠️ [ON-DROP] Failed to auto-update element:",
          updateError
        );
        // Don't fail the whole operation if element update fails
      }
    }

    return {
      success: successCount > 0,
      isValid: successCount > 0, // For conditional branching (yes/no connectors)
      message: `Processed ${successCount}/${totalCount} files successfully`,
      context: {
        ...context,
        dropResult: {
          files: processedFiles,
          validationResults,
          position,
          elementId,
          processedAt: new Date().toISOString(),
          successCount,
          totalCount,
        },
      },
    };
  } catch (error) {
    console.error("❌ [ON-DROP] Error:", error);
    return {
      success: false,
      isValid: false, // For conditional branching (yes/no connectors)
      error: error.message,
      context: context,
    };
  }
};

// OnSchedule trigger handler
const executeOnSchedule = async (node, context, appId, userId) => {
  try {
    console.log("⏰ [ON-SCHEDULE] Processing schedule trigger for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const {
      scheduleType = "interval",
      scheduleValue,
      scheduleUnit = "minutes",
      cronExpression,
      enabled = true,
    } = node.data || {};

    // Validate required fields
    if (!enabled) {
      console.log("⏰ [ON-SCHEDULE] Schedule is disabled");
      return {
        success: true,
        scheduled: false,
        message: "Schedule is disabled",
        context: context,
      };
    }

    if (scheduleType === "interval" && !scheduleValue) {
      throw new Error("Schedule value is required for interval type");
    }

    if (scheduleType === "cron" && !cronExpression) {
      throw new Error("Cron expression is required for cron type");
    }

    console.log("⏰ [ON-SCHEDULE] Schedule configuration:", {
      scheduleType,
      scheduleValue,
      scheduleUnit,
      cronExpression,
    });

    // Calculate next execution time
    let nextExecutionTime = null;

    if (scheduleType === "interval") {
      const intervalMs = calculateIntervalMs(scheduleValue, scheduleUnit);
      nextExecutionTime = new Date(Date.now() + intervalMs);
    } else if (scheduleType === "cron") {
      // For cron, we would need a cron parser library
      // For now, just log that it's scheduled
      console.log("⏰ [ON-SCHEDULE] Cron schedule:", cronExpression);
      nextExecutionTime = new Date(Date.now() + 60000); // Default to 1 minute
    }

    console.log(
      "✅ [ON-SCHEDULE] Schedule registered, next execution:",
      nextExecutionTime
    );

    return {
      success: true,
      scheduled: true,
      scheduleType: scheduleType,
      nextExecutionTime: nextExecutionTime?.toISOString(),
      context: {
        ...context,
        scheduleResult: {
          scheduled: true,
          scheduleType: scheduleType,
          nextExecutionTime: nextExecutionTime?.toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ [ON-SCHEDULE] Error:", error.message);
    return {
      success: false,
      scheduled: false,
      error: error.message,
      context: context,
    };
  }
};

// Helper function to calculate interval in milliseconds
const calculateIntervalMs = (value, unit) => {
  const intervals = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  return (intervals[unit] || intervals.minutes) * value;
};

// OnRecordCreate trigger handler
const executeOnRecordCreate = async (node, context, appId, userId) => {
  try {
    console.log(
      "📝 [ON-RECORD-CREATE] Processing record create trigger for app:",
      appId
    );

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const { tableName, filterConditions = [] } = node.data || {};

    // Validate required fields
    if (!tableName) {
      throw new Error("Table name is required for onRecordCreate trigger");
    }

    console.log("📝 [ON-RECORD-CREATE] Trigger configuration:", {
      tableName,
      filterConditions,
    });

    // The actual trigger logic would be implemented in the database
    // For now, we return a trigger registration response
    return {
      success: true,
      triggered: true,
      triggerType: "onRecordCreate",
      tableName: tableName,
      context: {
        ...context,
        recordCreateResult: {
          triggered: true,
          tableName: tableName,
          timestamp: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ [ON-RECORD-CREATE] Error:", error.message);
    return {
      success: false,
      triggered: false,
      error: error.message,
      context: context,
    };
  }
};

// OnRecordUpdate trigger handler
const executeOnRecordUpdate = async (node, context, appId, userId) => {
  try {
    console.log(
      "✏️ [ON-RECORD-UPDATE] Processing record update trigger for app:",
      appId
    );

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Extract configuration
    const {
      tableName,
      filterConditions = [],
      watchColumns = [],
    } = node.data || {};

    // Validate required fields
    if (!tableName) {
      throw new Error("Table name is required for onRecordUpdate trigger");
    }

    console.log("✏️ [ON-RECORD-UPDATE] Trigger configuration:", {
      tableName,
      filterConditions,
      watchColumns,
    });

    // The actual trigger logic would be implemented in the database
    // For now, we return a trigger registration response
    return {
      success: true,
      triggered: true,
      triggerType: "onRecordUpdate",
      tableName: tableName,
      context: {
        ...context,
        recordUpdateResult: {
          triggered: true,
          tableName: tableName,
          watchColumns: watchColumns,
          timestamp: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ [ON-RECORD-UPDATE] Error:", error.message);
    return {
      success: false,
      triggered: false,
      error: error.message,
      context: context,
    };
  }
};

// OnLogin trigger block handler
const executeOnLogin = async (node, context, appId) => {
  try {
    console.log("🔐 [ON-LOGIN] Processing login event for app:", appId);

    const loginConfig = node.data || {};

    console.log("🔐 [ON-LOGIN] Login configuration:", {
      captureUserData: loginConfig.captureUserData,
      captureMetadata: loginConfig.captureMetadata,
      storeToken: loginConfig.storeToken,
    });

    // Abort if upstream context explicitly marked the login as failed
    const loginFailureFlag = [
      context.loginSuccess,
      context.loginSucceeded,
      context.authSuccess,
    ].some((flag) => flag === false);

    const loginFailureStatus = [
      context.loginStatus,
      context.status,
      context.authStatus,
    ].some((status) =>
      typeof status === "string"
        ? ["failed", "error", "unauthorized"].includes(
            status.toLowerCase()
          )
        : false
    );

    if (loginFailureFlag || loginFailureStatus) {
      console.warn("⚠️ [ON-LOGIN] Login marked as unsuccessful in context");
      return {
        success: false,
        triggered: false,
        error: "Login was not successful",
        context,
      };
    }
    // Resolve user details from multiple potential sources
    const userCandidates = [
      context.user,
      context.session?.user,
      context.authUser,
      context.loginUser,
      context.loginResponse?.user,
      context.authResponse?.user,
      context.httpResponse?.data?.user,
    ];

    const rawUser = userCandidates.find((candidate) =>
      candidate && (candidate.id || candidate.userId || candidate.email)
    );

    if (!rawUser) {
      console.warn("⚠️ [ON-LOGIN] No user data provided in login event");
      return {
        success: false,
        triggered: false,
        error: "No user data provided in login event",
        context,
      };
    }

    const userId = rawUser.id ?? rawUser.userId;
    const userEmail = rawUser.email ?? rawUser.userEmail ?? rawUser.username;

    if (!userId || !userEmail) {
      console.warn(
        "⚠️ [ON-LOGIN] User data missing required identifier or email"
      );
      return {
        success: false,
        triggered: false,
        error: "Incomplete user details for login event",
        context,
      };
    }

    // Resolve token from context or metadata
    const tokenCandidates = [
      context.token,
      context.session?.token,
      context.authToken,
      context.accessToken,
      context.loginResponse?.token,
      context.authResponse?.token,
      context.httpResponse?.data?.token,
      context.headers?.authorization,
      context.request?.headers?.authorization,
    ];

    let resolvedToken = tokenCandidates.find(
      (candidate) => typeof candidate === "string" && candidate.trim() !== ""
    );

    if (resolvedToken && /bearer\s+/i.test(resolvedToken)) {
      resolvedToken = resolvedToken.replace(/bearer\s+/i, "").trim();
    }

    if (!resolvedToken) {
      console.warn("⚠️ [ON-LOGIN] No authentication token provided");
      return {
        success: false,
        triggered: false,
        error: "No authentication token provided",
        context,
      };
    }

    const loginMetadata =
      context.loginMetadata ||
      context.authMetadata ||
      context.metadata?.login ||
      null;

    const nowIso = new Date().toISOString();

    const resolvedName =
      rawUser.name ||
      rawUser.fullName ||
      [rawUser.firstName, rawUser.lastName].filter(Boolean).join(" ") ||
      rawUser.displayName ||
      rawUser.username ||
      (userEmail ? userEmail.split("@")[0] : undefined);

    const resolvedRoles = Array.isArray(rawUser.roles)
      ? rawUser.roles.filter(Boolean)
      : rawUser.role
      ? [rawUser.role]
      : [];

    const session = {
      ...(context.session && typeof context.session === "object"
        ? context.session
        : {}),
      userId,
      email: userEmail,
      name: resolvedName,
      roles: resolvedRoles,
      token: resolvedToken,
      loginTimestamp:
        context.session?.loginTimestamp ||
        loginMetadata?.timestamp ||
        nowIso,
      metadata:
        loginConfig.captureMetadata !== false && loginMetadata
          ? {
              ...(context.session?.metadata || {}),
              ...loginMetadata,
            }
          : context.session?.metadata,
    };

    const enrichedUser = {
      id: userId,
      email: userEmail,
      name: resolvedName,
      role: resolvedRoles[0] || rawUser.role || null,
      roles: resolvedRoles,
      verified: rawUser.verified ?? rawUser.isVerified ?? true,
      createdAt: rawUser.createdAt,
      updatedAt: rawUser.updatedAt,
    };

    session.user = {
      ...(session.user || {}),
      ...enrichedUser,
    };

    const enrichedContext = {
      ...context,
      loginProcessed: true,
      loginTimestamp: session.loginTimestamp,
      isAuthenticated: true,
      session,
      auth: {
        ...(context.auth || {}),
        isAuthenticated: true,
        verifiedAt: nowIso,
        failureReason: null,
      },
    };

    if (loginConfig.captureUserData !== false) {
      enrichedContext.user = {
        ...(context.user || {}),
        ...enrichedUser,
      };
    } else {
      enrichedContext.user = context.user;
    }

    if (loginConfig.storeToken !== false) {
      enrichedContext.token = resolvedToken;
    }

    if (loginConfig.captureMetadata !== false && loginMetadata) {
      enrichedContext.loginMetadata = {
        timestamp: loginMetadata.timestamp || session.loginTimestamp,
        ip: loginMetadata.ip,
        device: loginMetadata.device,
        location: loginMetadata.location,
      };
    }

    console.log("🔐 [ON-LOGIN] Login event details:", {
      userId,
      userEmail,
      roles: resolvedRoles,
      hasToken: !!resolvedToken,
      hasMetadata: !!loginMetadata,
    });

    console.log("✅ [ON-LOGIN] Login event processed successfully");
    return {
      success: true,
      triggered: true,
      message: "Login event processed",
      session,
      context: enrichedContext,
    };
  } catch (error) {
    console.error("❌ [ON-LOGIN] Error processing login:", error);
    return {
      success: false,
      triggered: false,
      error: error.message,
      context,
    };
  }
};


// OnWebhook trigger handler
const executeOnWebhook = async (node, context, appId, userId = 1) => {
  try {
    console.log("📬 [ON-WEBHOOK] Processing webhook trigger for app:", appId);

    // Validate app access (don't strictly require userId for public webhooks, but keep check for owner-scoped triggers)
    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) {
      // If access denied because no user context, still allow if node.data.allowPublic === true
      if (!node.data || node.data.allowPublic !== true) {
        throw new Error("Access denied to this app for webhook trigger");
      }
    }

    const cfg = node.data || {};

    // Expect payload to be available in context under common keys
    const payload =
      context.webhookPayload || context.payload || context.body || context.requestBody || context.event || null;

    const headers = context.headers || context.requestHeaders || context.httpHeaders || {};

    console.log("📬 [ON-WEBHOOK] Payload present:", !!payload);

    // Optional secret/header validation configured on the block
    if (cfg.secretHeader && cfg.secretValue) {
      const provided = headers[cfg.secretHeader.toLowerCase()] || headers[cfg.secretHeader];
      const expected = substituteContextVariables(cfg.secretValue, context);
      if (!provided || provided !== expected) {
        console.warn("❌ [ON-WEBHOOK] Secret header validation failed for header:", cfg.secretHeader);
        return {
          success: false,
          triggered: false,
          error: "Invalid webhook secret",
          context: { ...context, webhookRejected: true },
        };
      }
    }

    // Optional filter: allow matching by event type or path
    let matched = true;
    if (cfg.matchPath && payload) {
      // Extract nested value from payload using dot-path
      const parts = cfg.matchPath.split('.');
      let v = payload;
      for (const p of parts) {
        v = v?.[p];
        if (v === undefined) break;
      }
      if (cfg.matchValue !== undefined && String(v) !== String(substituteContextVariables(cfg.matchValue, context))) {
        matched = false;
      }
    }

    if (!payload) {
      console.warn('⚠️ [ON-WEBHOOK] No payload found in context for webhook trigger');
      return {
        success: false,
        triggered: false,
        error: 'No webhook payload provided',
        context,
      };
    }

    if (!matched) {
      console.log('ℹ️ [ON-WEBHOOK] Payload did not match configured filter, skipping trigger');
      return {
        success: true,
        triggered: false,
        matched: false,
        context: { ...context, webhookMatched: false },
      };
    }

    // Optionally persist webhook payload to an app-scoped table if configured
    if (cfg.saveToTable) {
      try {
        const tableName = generateTableName(appId, cfg.saveToTable || 'webhooks');
        const exists = await dbUtils.tableExists(tableName);
        if (!exists) {
          await prisma.$executeRawUnsafe(
            `CREATE TABLE "${tableName}" (id SERIAL PRIMARY KEY, data JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`
          );
        }

        await prisma.$queryRawUnsafe(`INSERT INTO "${tableName}" (data) VALUES ($1)`, JSON.stringify(payload));
        console.log(`✅ [ON-WEBHOOK] Saved webhook payload to ${tableName}`);
      } catch (e) {
        console.warn('⚠️ [ON-WEBHOOK] Failed to save webhook payload:', e.message);
      }
    }

    // Add webhook data to context for downstream blocks
    const updatedContext = {
      ...context,
      webhookResult: {
        receivedAt: new Date().toISOString(),
        payload,
        headers,
        matched: true,
      },
    };

    console.log('✅ [ON-WEBHOOK] Webhook trigger processed');

    return {
      success: true,
      triggered: true,
      matched: true,
      context: updatedContext,
      message: 'Webhook processed',
    };
  } catch (error) {
    console.error('❌ [ON-WEBHOOK] Error processing webhook trigger:', error);
    return {
      success: false,
      triggered: false,
      error: error.message,
      context,
    };
  }
};

// Run a workflow given nodes/edges and an initial context
const runWorkflow = async (nodes, edges, initialContext = {}, appId, userId = 1) => {
  try {
    const results = [];
    let currentContext = initialContext || {};

    // Build edge map
    const edgeMap = {};
    if (edges && Array.isArray(edges)) {
      edges.forEach((edge) => {
        const connectorLabel = edge.label || edge.sourceHandle || "next";
        const key = `${edge.source}:${connectorLabel}`;
        edgeMap[key] = edge.target;
      });
    }

    // Build node map
    const nodeMap = {};
    nodes.forEach((node) => {
      nodeMap[node.id] = node;
    });

    // Find starting trigger node
    let currentNodeId = null;
    for (const node of nodes) {
      if (node.data && node.data.category === "Triggers") {
        // Prefer explicit onWebhook trigger when webhook context present
        if (currentContext.webhookPayload && node.data.label === "onWebhook") {
          currentNodeId = node.id;
          break;
        }
        if (!currentNodeId) currentNodeId = node.id;
      }
    }

    if (!currentNodeId) {
      return { success: false, message: "No trigger node found in workflow", results: [] };
    }

    const executedNodeIds = new Set();
    let maxIterations = 200;
    let iteration = 0;

    while (currentNodeId && iteration < maxIterations) {
      iteration++;
      const node = nodeMap[currentNodeId];

      if (!node) break;
      if (executedNodeIds.has(currentNodeId)) break;
      executedNodeIds.add(currentNodeId);

      try {
        let result = null;

        // Actions
        if (node.data.category === "Actions") {
          switch (node.data.label) {
            case "db.create":
              result = await executeDbCreate(node, currentContext, appId, userId);
              break;
            case "db.find":
              result = await executeDbFind(node, currentContext, appId, userId);
              break;
            case "db.update":
              result = await executeDbUpdate(node, currentContext, appId, userId);
              break;
            case "db.upsert":
              result = await executeDbUpsert(node, currentContext, appId, userId);
              break;
            case "email.send":
              result = await executeEmailSend(node, currentContext, appId, userId);
              break;
            case "http.request":
              result = await executeHttpRequest(node, currentContext, appId, userId);
              break;
            case "ai.summarize":
              result = await executeAiSummarize(node, currentContext, appId, userId);
              break;
            default:
              result = { success: true, message: `${node.data.label} executed (placeholder)` };
          }
        } else if (node.data.category === "Conditions") {
          switch (node.data.label) {
            case "isFilled":
              result = await executeIsFilled(node, currentContext, appId);
              break;
            case "dateValid":
              result = await executeDateValid(node, currentContext, appId);
              break;
            case "match":
              result = await executeMatch(node, currentContext, appId, userId);
              break;
            case "roleIs":
              result = await executeRoleIs(node, currentContext, appId, userId);
              break;
            case "switch":
              result = await executeSwitch(node, currentContext, appId, userId);
              break;
            case "expr":
              result = await executeExpr(node, currentContext, appId, userId);
              break;
            default:
              result = { success: true, isFilled: true, message: `${node.data.label} processed (placeholder)` };
          }
        } else if (node.data.category === "Triggers") {
          switch (node.data.label) {
            case "onClick":
              result = await executeOnClick(node, currentContext, appId);
              break;
            case "onPageLoad":
              result = await executeOnPageLoad(node, currentContext, appId);
              break;
            case "onSubmit":
              result = await executeOnSubmit(node, currentContext, appId);
              break;
            case "onDrop":
              result = await executeOnDrop(node, currentContext, appId, userId);
              break;
            case "onLogin":
              result = await executeOnLogin(node, currentContext, appId);
              break;
            case "onSchedule":
              result = await executeOnSchedule(node, currentContext, appId, userId);
              break;
            case "onRecordCreate":
              result = await executeOnRecordCreate(node, currentContext, appId, userId);
              break;
            case "onRecordUpdate":
              result = await executeOnRecordUpdate(node, currentContext, appId, userId);
              break;
            case "onWebhook":
              result = await executeOnWebhook(node, currentContext, appId, userId);
              break;
            default:
              result = { success: true, message: `${node.data.label} triggered (placeholder)` };
          }
        } else {
          result = { success: true, message: `${node.data.label} processed` };
        }

        results.push({ nodeId: node.id, nodeLabel: node.data.label, result });

        if (result && typeof result === "object") {
          currentContext = { ...currentContext, ...result.context, ...result };
        }

        // Determine next node
        let nextNodeId = null;
        if (node.data.category === "Conditions") {
          if (node.data.label === "switch") {
            const matchedCase = result?.matchedCase || "default";
            const edgeKey = `${node.id}:${matchedCase}`;
            nextNodeId = edgeMap[edgeKey];
          } else if (node.data.label === "expr") {
            const conditionResult = result?.result || false;
            const connectorLabel = conditionResult ? "yes" : "no";
            const edgeKey = `${node.id}:${connectorLabel}`;
            nextNodeId = edgeMap[edgeKey];
          } else {
            const conditionResult = result?.isFilled || result?.isValid || result?.match || false;
            const connectorLabel = conditionResult ? "yes" : "no";
            const edgeKey = `${node.id}:${connectorLabel}`;
            nextNodeId = edgeMap[edgeKey];
          }
        } else {
          const edgeKey = `${node.id}:next`;
          nextNodeId = edgeMap[edgeKey];
        }

        currentNodeId = nextNodeId;
      } catch (err) {
        results.push({ nodeId: currentNodeId, nodeLabel: nodeMap[currentNodeId]?.data?.label, error: err.message });
        break;
      }
    }

    return { success: true, results, context: currentContext };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// File validation helper
const validateDroppedFile = (file, config) => {
  const errors = [];

  // Check file type
  if (config.acceptedTypes && config.acceptedTypes.length > 0) {
    const isValidType = config.acceptedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      errors.push(
        `Invalid file type: ${
          file.type
        }. Accepted types: ${config.acceptedTypes.join(", ")}`
      );
    }
  }

  // Check file size
  if (config.maxFileSize && file.size > config.maxFileSize) {
    const maxSizeMB = (config.maxFileSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    errors.push(`File too large: ${fileSizeMB}MB (max: ${maxSizeMB}MB)`);
  }

  // Check if multiple files are allowed
  if (!config.allowMultiple && config.fileCount > 1) {
    errors.push("Multiple files not allowed");
  }

  // Security checks
  // Check filename for security (prevent path traversal)
  if (
    file.name.includes("..") ||
    file.name.includes("/") ||
    file.name.includes("\\")
  ) {
    errors.push("Invalid filename: contains path traversal characters");
  }

  // Check filename length
  if (file.name.length > 255) {
    errors.push("Filename too long (max 255 characters)");
  }

  // Check for empty files
  if (file.size <= 0) {
    errors.push("File is empty");
  }

  // Check for potentially dangerous file extensions
  const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".pif",
    ".com",
    ".vbs",
    ".js",
    ".jar",
  ];
  const fileExtension = path.extname(file.name).toLowerCase();
  if (dangerousExtensions.includes(fileExtension)) {
    errors.push(
      `File extension ${fileExtension} is not allowed for security reasons`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      data: file.data,
    },
  };
};

// File processing helper
const processDroppedFile = async (
  file,
  appId,
  elementId,
  position,
  userId = 1
) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.name);
    const filename = `ondrop-${uniqueSuffix}${extension}`;
    const filePath = path.join(uploadsDir, filename);

    // Write file to disk (for base64 data)
    if (file.data) {
      // Handle base64 data
      const base64Data = file.data.replace(/^data:.*,/, "");
      fs.writeFileSync(filePath, base64Data, "base64");
    } else if (file.buffer) {
      // Handle buffer data
      fs.writeFileSync(filePath, file.buffer);
    } else {
      throw new Error("No file data provided");
    }

    // Generate file URL (using media route)
    const fileUrl = `/api/media/files/${filename}`;

    // Store file metadata in database
    const fileRecord = await prisma.mediaFile.create({
      data: {
        filename: filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: filePath,
        url: fileUrl,
        userId: userId,
        appId: parseInt(appId),
        elementId: elementId,
        dropPosition: position ? JSON.stringify(position) : null,
        validationResult: JSON.stringify({ valid: true }),
        metadata: JSON.stringify({
          uploadMethod: "onDrop",
          originalName: file.name,
          processedAt: new Date().toISOString(),
        }),
      },
    });

    return {
      id: fileRecord.id,
      name: file.name,
      size: file.size,
      type: file.type,
      url: fileRecord.url,
      path: fileRecord.path,
      filename: fileRecord.filename,
    };
  } catch (error) {
    console.error("❌ [ON-DROP] File processing error:", error);
    throw error;
  }
};

/**
 * @route   POST /api/workflow/execute
 * @desc    Execute workflow with functional blocks
 * @access  Private
 */
router.post("/execute", authenticateToken, async (req, res) => {
  try {
    const { appId, workflowId, nodes, edges, context } = req.body;
    const userId = req.user.id;

    console.log("🚀 [WF-EXEC] Starting workflow execution:", {
      appId,
      workflowId,
      nodesCount: nodes?.length,
      edgesCount: edges?.length,
      nodeLabels: nodes?.map((n) => n.data.label),
      edgeConnections: edges?.map(
        (e) =>
          `${e.source} --[${e.label || e.sourceHandle || "next"}]--> ${
            e.target
          }`
      ),
    });

    if (!appId || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        message: "appId and nodes array are required",
      });
    }

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

    const results = [];
    let currentContext = context || {};

    // Build a map of edges for quick lookup
    const edgeMap = {};
    if (edges && Array.isArray(edges)) {
      edges.forEach((edge) => {
        // Support both label and sourceHandle for connector types
        const connectorLabel = edge.label || edge.sourceHandle || "next";
        const key = `${edge.source}:${connectorLabel}`;
        edgeMap[key] = edge.target;

        console.log(`[WF-EXEC] Edge map entry: ${key} -> ${edge.target}`);
      });
    }

    console.log("[WF-EXEC] Edge map built:", edgeMap);

    // Create a map of nodes by ID for quick lookup
    const nodeMap = {};
    nodes.forEach((node) => {
      nodeMap[node.id] = node;
    });

    // Find the starting node (usually a trigger)
    let currentNodeId = null;
    for (const node of nodes) {
      if (node.data.category === "Triggers") {
        currentNodeId = node.id;
        break;
      }
    }

    if (!currentNodeId) {
      return res.status(400).json({
        success: false,
        message: "No trigger node found in workflow",
      });
    }

    // Execute nodes following the edge connections
    let executedNodeIds = new Set();
    let maxIterations = 100; // Prevent infinite loops
    let iteration = 0;

    while (currentNodeId && iteration < maxIterations) {
      iteration++;
      const node = nodeMap[currentNodeId];

      if (!node) {
        console.error(`❌ [WF-EXEC] Node not found: ${currentNodeId}`);
        console.error(`❌ [WF-EXEC] Available nodes:`, Object.keys(nodeMap));
        console.error(
          `❌ [WF-EXEC] This usually means an edge is pointing to a non-existent node`
        );
        break;
      }

      if (executedNodeIds.has(currentNodeId)) {
        console.log(
          `⚠️ [WF-EXEC] Circular reference detected at node: ${currentNodeId}`
        );
        break;
      }

      executedNodeIds.add(currentNodeId);

      console.log(
        `🔄 [WF-EXEC] Processing node ${iteration}: ${node.data.label} (${node.id})`
      );

      try {
        let result = null;

        // Handle different block types
        if (node.data.category === "Actions") {
          switch (node.data.label) {
            case "db.create":
              result = await executeDbCreate(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "db.find":
              result = await executeDbFind(node, currentContext, appId, userId);
              break;

            case "db.update":
              result = await executeDbUpdate(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "db.upsert":
              result = await executeDbUpsert(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "email.send":
              result = await executeEmailSend(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "ui.openModal":
              result = await executeOpenModal(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "notify.toast":
              result = await executeNotifyToast(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "page.redirect":
              result = await executePageRedirect(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "page.goBack":
              result = await executePageGoBack(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "auth.verify":
              result = await executeAuthVerify(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "http.request":
              result = await executeHttpRequest(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "ai.summarize":
              result = await executeAiSummarize(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "file.upload":
              result = await executeFileUpload(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "file.download":
              result = await executeFileDownload(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            default:
              console.log(
                `⚠️ [WF-EXEC] Unhandled action block: ${node.data.label}`
              );
              result = {
                success: true,
                message: `${node.data.label} executed (placeholder)`,
              };
          }
        } else if (node.data.category === "Conditions") {
          switch (node.data.label) {
            case "isFilled":
              result = await executeIsFilled(node, currentContext, appId);
              break;

            case "dateValid":
              result = await executeDateValid(node, currentContext, appId);
              break;

            case "match":
              result = await executeMatch(node, currentContext, appId, userId);
              break;

            case "roleIs":
              result = await executeRoleIs(node, currentContext, appId, userId);
              break;

            case "switch":
              result = await executeSwitch(node, currentContext, appId, userId);
              break;

            case "expr":
              result = await executeExpr(node, currentContext, appId, userId);
              break;

            default:
              console.log(
                `⚠️ [WF-EXEC] Unhandled condition block: ${node.data.label}`
              );
              result = {
                success: true,
                isFilled: true, // Default to true for unknown conditions
                message: `${node.data.label} processed (placeholder)`,
              };
          }
        } else if (node.data.category === "Triggers") {
          switch (node.data.label) {
            case "onClick":
              result = await executeOnClick(node, currentContext, appId);
              break;

            case "onPageLoad":
              result = await executeOnPageLoad(node, currentContext, appId);
              break;

            case "onSubmit":
              result = await executeOnSubmit(node, currentContext, appId);
              break;

            case "onDrop":
              result = await executeOnDrop(node, currentContext, appId, userId);
              break;

            case "onLogin":
              result = await executeOnLogin(node, currentContext, appId);
              break;

            case "onWebhook":
              result = await executeOnWebhook(node, currentContext, appId, userId);
              break;

            case "onSchedule":
              result = await executeOnSchedule(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "onRecordCreate":
              result = await executeOnRecordCreate(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            case "onRecordUpdate":
              result = await executeOnRecordUpdate(
                node,
                currentContext,
                appId,
                userId
              );
              break;

            default:
              console.log(
                `⚠️ [WF-EXEC] Unhandled trigger block: ${node.data.label}`
              );
              result = {
                success: true,
                message: `${node.data.label} triggered (placeholder)`,
              };
          }
        } else {
          // For other block types, just log and continue
          result = { success: true, message: `${node.data.label} processed` };
        }

        results.push({
          nodeId: node.id,
          nodeLabel: node.data.label,
          result,
        });

        // Update context with result data
        if (result && typeof result === "object") {
          // If result has a context property, merge it separately
          if (result.context) {
            currentContext = { ...currentContext, ...result.context };
          } else {
            currentContext = { ...currentContext, ...result };
          }
        }

        // Determine next node based on condition result or edge label
        let nextNodeId = null;

        if (node.data.category === "Conditions") {
          // For switch nodes, use the matched case as connector label
          if (node.data.label === "switch") {
            const matchedCase = result?.matchedCase || "default";
            const edgeKey = `${node.id}:${matchedCase}`;
            nextNodeId = edgeMap[edgeKey];

            console.log(
              `🔀 [WF-EXEC] Switch matched case: "${matchedCase}", following connector`
            );
            console.log(`🔀 [WF-EXEC] Looking for edge key: ${edgeKey}`);
            console.log(`🔀 [WF-EXEC] Next node ID: ${nextNodeId}`);
            console.log(
              `🔀 [WF-EXEC] Available edge keys:`,
              Object.keys(edgeMap).filter((k) => k.startsWith(node.id))
            );
          } else if (node.data.label === "expr") {
            // For expr nodes, use the result as boolean for yes/no routing
            const conditionResult = result?.result || false;
            const connectorLabel = conditionResult ? "yes" : "no";
            const edgeKey = `${node.id}:${connectorLabel}`;
            nextNodeId = edgeMap[edgeKey];

            console.log(
              `🔀 [WF-EXEC] Expr result: ${conditionResult}, following "${connectorLabel}" connector`
            );
            console.log(`🔀 [WF-EXEC] Looking for edge key: ${edgeKey}`);
            console.log(`🔀 [WF-EXEC] Next node ID: ${nextNodeId}`);
          } else {
            // For other condition nodes, check the result and follow appropriate connector
            const conditionResult =
              result?.isFilled || result?.isValid || result?.match || false;
            const connectorLabel = conditionResult ? "yes" : "no";
            const edgeKey = `${node.id}:${connectorLabel}`;
            nextNodeId = edgeMap[edgeKey];

            console.log(
              `🔀 [WF-EXEC] Condition result: ${conditionResult}, following "${connectorLabel}" connector`
            );
            console.log(`🔀 [WF-EXEC] Looking for edge key: ${edgeKey}`);
            console.log(`🔀 [WF-EXEC] Next node ID: ${nextNodeId}`);
            console.log(
              `🔀 [WF-EXEC] Available edge keys:`,
              Object.keys(edgeMap).filter((k) => k.startsWith(node.id))
            );
          }
        } else {
          // For other nodes, follow the "next" connector
          const edgeKey = `${node.id}:next`;
          nextNodeId = edgeMap[edgeKey];
          console.log(
            `🔀 [WF-EXEC] Following "next" connector for ${node.data.label}`
          );
          console.log(
            `🔀 [WF-EXEC] Edge key: ${edgeKey}, Next node ID: ${nextNodeId}`
          );

          if (!nextNodeId) {
            console.log(
              `⚠️ [WF-EXEC] No "next" connector found for node ${node.id}`
            );
            console.log(
              `⚠️ [WF-EXEC] Available edges from this node:`,
              Object.keys(edgeMap).filter((k) => k.startsWith(node.id))
            );
          }
        }

        currentNodeId = nextNodeId;
      } catch (error) {
        console.error(
          `❌ [WF-EXEC] Error in node ${node.data.label}:`,
          error.message
        );

        results.push({
          nodeId: node.id,
          nodeLabel: node.data.label,
          error: error.message,
        });

        // Stop execution on error
        break;
      }
    }

    if (iteration >= maxIterations) {
      console.warn("⚠️ [WF-EXEC] Max iterations reached, stopping workflow");
    }

    console.log("✅ [WF-EXEC] Workflow execution completed");

    res.json({
      success: true,
      message: "Workflow executed successfully",
      results,
      context: currentContext,
    });
  } catch (error) {
    console.error("❌ [WF-EXEC] Workflow execution failed:", error);
    res.status(500).json({
      success: false,
      message: "Workflow execution failed",
      error: error.message,
    });
  }
});





/**
 * @route   POST /api/webhook/algorithm
 * @desc    Public webhook endpoint for Algorithm to push applicant + quote data
 * @access  Public (secured by shared secret header)
 */
router.post("/webhook/algorithm", async (req, res) => {
  try {
    // Expect a shared secret in header 'x-algo-secret' or Authorization: Bearer <secret>
    const headerSecret = req.header("x-algo-secret") || req.header("authorization");

    if (!process.env.ALGORITHM_WEBHOOK_SECRET) {
      console.warn("⚠️ ALGORTHM webhook secret is not configured (ALGORITHM_WEBHOOK_SECRET)");
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }

    let provided = headerSecret || "";
    if (provided.startsWith("Bearer ")) provided = provided.slice(7).trim();

    // If the simple header secret is provided, verify it first
    if (!provided || provided !== process.env.ALGORITHM_WEBHOOK_SECRET) {
      console.warn("❌ [WEBHOOK] Invalid or missing webhook secret");
      return res.status(403).json({ success: false, message: "Invalid webhook secret" });
    }

    // Additionally support HMAC signature verification when signature header present
    const sigHeader = req.header('x-hub-signature-256') || req.header('x-hub-signature') || req.header('x-signature') || req.header('x-signature-256');
    if (sigHeader) {
      const secretForHmac = process.env.ALGORITHM_WEBHOOK_SECRET;
      const ok = verifyHmacSignature(req.body, sigHeader, secretForHmac);
      if (!ok) {
        console.warn('❌ [WEBHOOK] HMAC signature verification failed');
        return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "Empty payload" });
    }

    // Determine target appId: prefer payload.appId, then query param, then env LOS_APP_ID
    const appId = payload.appId || req.query.appId || process.env.LOS_APP_ID;
    if (!appId) {
      return res.status(400).json({ success: false, message: "appId is required either in payload or query param" });
    }

    // Use a standard table base name for storing applications inside each app namespace
    const baseTableName = "applications";
    const tableName = generateTableName(appId, baseTableName);

    // Ensure table exists. If missing, create a simple JSONB-backed table to store payloads.
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) {
      console.log(`🛠️ [WEBHOOK] Creating table ${tableName} to store incoming applications`);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${tableName}" (
          id SERIAL PRIMARY KEY,
          data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
      );
    }

    // We'll try to upsert by applicant email if available, otherwise insert
    const applicantEmail =
      payload.applicant?.email || payload.applicantEmail || payload.email || null;

    if (applicantEmail) {
      // Check several possible JSON paths for applicant email to support different payload shapes
      const selectQuery = `SELECT id FROM "${tableName}" WHERE (data->'applicant'->>'email' = $1) OR (data->>'applicantEmail' = $1) OR (data->>'email' = $1) LIMIT 1`;
      const existing = await prisma.$queryRawUnsafe(selectQuery, applicantEmail);

      if (existing && existing.length > 0) {
        // Update existing record
        const updateQuery = `UPDATE "${tableName}" SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
        const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(payload), existing[0].id);
        console.log(`✅ [WEBHOOK] Updated record id=${existing[0].id} in ${tableName}`);

        // Trigger workflows after update (async)
        try {
          const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
          for (const wf of workflows) {
            let nodes = wf.nodes;
            let edges = wf.edges;
            if (typeof nodes === 'string') {
              try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
            }
            if (typeof edges === 'string') {
              try { edges = JSON.parse(edges); } catch (e) { edges = []; }
            }

            const initialContext = {
              webhookPayload: payload,
              payload,
              body: payload,
              headers: req.headers,
              requestBody: payload,
              workflowId: wf.id,
              updatedRecordId: updated[0].id,
            };

            // enqueue job for processing by the workflow queue
            enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
          }
        } catch (e) {
          console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after update:', e.message || e);
        }

        return res.json({ success: true, operation: "update", record: updated[0] });
      } else {
        // Insert new
        const insertQuery = `INSERT INTO "${tableName}" (data) VALUES ($1) RETURNING *`;
        const inserted = await prisma.$queryRawUnsafe(insertQuery, JSON.stringify(payload));
        console.log(`✅ [WEBHOOK] Inserted new record id=${inserted[0].id} in ${tableName}`);

        // Trigger workflows after insert (async)
        try {
          const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
          for (const wf of workflows) {
            let nodes = wf.nodes;
            let edges = wf.edges;
            if (typeof nodes === 'string') {
              try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
            }
            if (typeof edges === 'string') {
              try { edges = JSON.parse(edges); } catch (e) { edges = []; }
            }

            const initialContext = {
              webhookPayload: payload,
              payload,
              body: payload,
              headers: req.headers,
              requestBody: payload,
              workflowId: wf.id,
              insertedRecordId: inserted[0].id,
            };

            // enqueue job for processing by the workflow queue
            enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
          }
        } catch (e) {
          console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after insert:', e.message || e);
        }

        return res.json({ success: true, operation: "insert", record: inserted[0] });
      }
    } else {
      // No unique key available; perform blind insert
      const insertQuery = `INSERT INTO "${tableName}" (data) VALUES ($1) RETURNING *`;
      const inserted = await prisma.$queryRawUnsafe(insertQuery, JSON.stringify(payload));
      console.log(`✅ [WEBHOOK] Inserted new record id=${inserted[0].id} in ${tableName} (no unique key)`);

      // After storing, optionally trigger workflows configured for this app
      try {
        const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
        for (const wf of workflows) {
          let nodes = wf.nodes;
          let edges = wf.edges;
          if (typeof nodes === 'string') {
            try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
          }
          if (typeof edges === 'string') {
            try { edges = JSON.parse(edges); } catch (e) { edges = []; }
          }

          const initialContext = {
            webhookPayload: payload,
            payload,
            body: payload,
            headers: req.headers,
            requestBody: payload,
            workflowId: wf.id,
          };

          // enqueue job for processing by the workflow queue
          enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
        }
      } catch (e) {
        console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after insert:', e.message || e);
      }

      return res.json({ success: true, operation: "insert", record: inserted[0] });
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error processing algorithm webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/workflow/fetch-quote
 * @desc  Fetch latest quote from external Algorithm API for a specific record and update DB
 * @access Private (banker)
 */
router.post("/fetch-quote", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, url, authType, authConfig } = req.body;
    const userId = req.user.id;

    if (!appId || !recordId || !url) {
      return res.status(400).json({ success: false, message: "appId, recordId and url are required" });
    }

    // Verify user has access to this app
    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: "Access denied to this app" });

    const tableName = generateTableName(appId, "applications");
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: "Applications table not found for this app" });

    // Fetch record
    const selectQuery = `SELECT id, data FROM "${tableName}" WHERE id = $1 LIMIT 1`;
    const rows = await prisma.$queryRawUnsafe(selectQuery, recordId);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Record not found" });

    const record = rows[0];

    // Prepare HTTP request using executeHttpRequest helper
    const node = {
      data: {
        url,
        method: "POST",
        headers: [],
        bodyType: "json",
        body: JSON.stringify({ applicant: record.data?.applicant || record.data?.applicant || {} }),
        authType: authType || "bearer",
        authConfig: authConfig || {},
        timeout: 30000,
        saveResponseTo: "httpResponse",
      },
    };

    const httpResult = await executeHttpRequest(node, { token: req.header("authorization") }, appId, userId);

    if (!httpResult || !httpResult.context || !httpResult.context.httpResponse) {
      return res.status(500).json({ success: false, message: "Failed to fetch quote" });
    }

    const responseData = httpResult.context.httpResponse.data;

    // Merge quote into record.data.quote (replace existing quote)
    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{quote}', $1::jsonb, true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(responseData), record.id);

    // Audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: FETCH_QUOTE app:${appId} record:${recordId} user:${userId} status:success\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify app owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Latest quote fetched for record ${recordId}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [FETCH-QUOTE] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/update-status
 * @desc  Update application status (Completed / Rejected) and record audit & notify
 * @access Private (banker)
 */
router.post("/update-status", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, status } = req.body;
    const userId = req.user.id;
    if (!appId || !recordId || !status) return res.status(400).json({ success: false, message: 'appId, recordId and status required' });

    const allowed = ['Completed', 'Rejected', 'Pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', to_jsonb($1::text), true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, status, recordId);

    // Write audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: UPDATE_STATUS app:${appId} record:${recordId} user:${userId} status:${status}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Application ${recordId} marked ${status}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [UPDATE-STATUS] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/send-daily-summary
 * @desc  Send daily summary email to app owner (records in last 24h)
 * @access Private (banker or scheduled system user)
 */
router.post('/send-daily-summary', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.body;
    const userId = req.user.id;
    if (!appId) return res.status(400).json({ success: false, message: 'appId required' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    // Fetch records from last 24 hours
    const selectQuery = `SELECT id, data, created_at FROM "${tableName}" WHERE created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC`;
    const recent = await prisma.$queryRawUnsafe(selectQuery);

    const count = recent ? recent.length : 0;

    // Build summary
    let message = `Daily summary for app ${appId}: ${count} new application(s) in last 24 hours.`;
    if (count > 0) {
      const rows = recent.slice(0, 10).map(r => {
        const applicantName = (r.data && (r.data.applicant?.name || r.data.applicantName || r.data.name)) || 'Unknown';
        const email = (r.data && (r.data.applicant?.email || r.data.applicantEmail || r.data.email)) || 'Unknown';
        return `#${r.id} - ${applicantName} <${email}>`;
      });
      message += '\n\nRecent applications:\n' + rows.join('\n');
    }

    // Find app owner email
    const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
    if (!app || !app.ownerId) return res.status(404).json({ success: false, message: 'App owner not found' });

    const owner = await prisma.user.findUnique({ where: { id: app.ownerId }, select: { email: true, id: true, role: true } });
    if (!owner || !owner.email) return res.status(404).json({ success: false, message: 'Owner email not found' });

    // Send email (emailService handles console fallback in dev)
    const emailResult = await emailService.sendNotificationEmail(owner.email, 'system', message, owner.email.split('@')[0]);

    // Log and notify
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: DAILY_SUMMARY app:${appId} user:${userId} emailsent:${emailResult.success}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    if (global.emitNotification) {
      global.emitNotification({ userId: app.ownerId, type: 'system', message: `Daily summary: ${count} new application(s)`, id: Date.now(), createdAt: new Date() });
    }

    return res.json({ success: true, emailed: emailResult.success, details: emailResult });
  } catch (error) {
    console.error('❌ [DAILY-SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/workflow/fetch-quote
 * @desc  Fetch latest quote from external Algorithm API for a specific record and update DB
 * @access Private (banker)
 */
router.post("/workflow/fetch-quote", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, url, authType, authConfig } = req.body;
    const userId = req.user.id;

    if (!appId || !recordId || !url) {
      return res.status(400).json({ success: false, message: "appId, recordId and url are required" });
    }

    // Verify user has access to this app
    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: "Access denied to this app" });

    const tableName = generateTableName(appId, "applications");
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: "Applications table not found for this app" });

    // Fetch record
    const selectQuery = `SELECT id, data FROM "${tableName}" WHERE id = $1 LIMIT 1`;
    const rows = await prisma.$queryRawUnsafe(selectQuery, recordId);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Record not found" });

    const record = rows[0];

    // Build HTTP request node and execute using existing HTTP handler
    const node = {
      data: {
        url,
        method: "POST",
        headers: [],
        bodyType: "json",
        body: JSON.stringify({ applicant: record.data?.applicant || record.data?.applicant || {} }),
        authType: authType || "bearer",
        authConfig: authConfig || {},
        timeout: 30000,
        saveResponseTo: "httpResponse",
      },
    };

    const httpResult = await executeHttpRequest(node, { token: req.header("authorization") }, appId, userId);

    if (!httpResult || !httpResult.context || !httpResult.context.httpResponse) {
      return res.status(500).json({ success: false, message: "Failed to fetch quote" });
    }

    const responseData = httpResult.context.httpResponse.data;

    // Merge quote into record.data.quote (replace existing quote)
    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{quote}', $1::jsonb, true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(responseData), record.id);

    // Audit log (file)
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: FETCH_QUOTE app:${appId} record:${recordId} user:${userId} status:success\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify app owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Latest quote fetched for record ${recordId}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [FETCH-QUOTE] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/update-status
 * @desc  Update application status (Completed / Rejected) and record audit & notify
 * @access Private (banker)
 */
router.post("/workflow/update-status", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, status } = req.body;
    const userId = req.user.id;
    if (!appId || !recordId || !status) return res.status(400).json({ success: false, message: 'appId, recordId and status required' });

    const allowed = ['Completed', 'Rejected', 'Pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', to_jsonb($1::text), true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, status, recordId);

    // Write audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: UPDATE_STATUS app:${appId} record:${recordId} user:${userId} status:${status}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Application ${recordId} marked ${status}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [UPDATE-STATUS] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/send-daily-summary
 * @desc  Send daily summary email to app owner (records in last 24h)
 * @access Private (banker or scheduled system user)
 */
router.post('/workflow/send-daily-summary', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.body;
    const userId = req.user.id;
    if (!appId) return res.status(400).json({ success: false, message: 'appId required' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    // Fetch records from last 24 hours
    const selectQuery = `SELECT id, data, created_at FROM "${tableName}" WHERE created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC`;
    const recent = await prisma.$queryRawUnsafe(selectQuery);

    const count = recent ? recent.length : 0;

    // Build summary
    let message = `Daily summary for app ${appId}: ${count} new application(s) in last 24 hours.`;
    if (count > 0) {
      const rows = recent.slice(0, 10).map(r => {
        const applicantName = (r.data && (r.data.applicant?.name || r.data.applicantName || r.data.name)) || 'Unknown';
        const email = (r.data && (r.data.applicant?.email || r.data.applicantEmail || r.data.email)) || 'Unknown';
        return `#${r.id} - ${applicantName} <${email}>`;
      });
      message += '\n\nRecent applications:\n' + rows.join('\n');
    }

    // Find app owner email
    const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
    if (!app || !app.ownerId) return res.status(404).json({ success: false, message: 'App owner not found' });

    const owner = await prisma.user.findUnique({ where: { id: app.ownerId }, select: { email: true, id: true, role: true } });
    if (!owner || !owner.email) return res.status(404).json({ success: false, message: 'Owner email not found' });

    // Send email (emailService handles console fallback in dev)
    const emailResult = await emailService.sendNotificationEmail(owner.email, 'system', message, owner.email.split('@')[0]);

    // Log and notify
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: DAILY_SUMMARY app:${appId} user:${userId} emailsent:${emailResult.success}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    if (global.emitNotification) {
      global.emitNotification({ userId: app.ownerId, type: 'system', message: `Daily summary: ${count} new application(s)`, id: Date.now(), createdAt: new Date() });
    }

    return res.json({ success: true, emailed: emailResult.success, details: emailResult });
  } catch (error) {
    console.error('❌ [DAILY-SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});





/**
 * @route   POST /api/webhook/algorithm
 * @desc    Public webhook endpoint for Algorithm to push applicant + quote data
 * @access  Public (secured by shared secret header)
 */
router.post("/webhook/algorithm", async (req, res) => {
  try {
    // Expect a shared secret in header 'x-algo-secret' or Authorization: Bearer <secret>
    const headerSecret = req.header("x-algo-secret") || req.header("authorization");

    if (!process.env.ALGORITHM_WEBHOOK_SECRET) {
      console.warn("⚠️ ALGORTHM webhook secret is not configured (ALGORITHM_WEBHOOK_SECRET)");
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }

    let provided = headerSecret || "";
    if (provided.startsWith("Bearer ")) provided = provided.slice(7).trim();

    // If the simple header secret is provided, verify it first
    if (!provided || provided !== process.env.ALGORITHM_WEBHOOK_SECRET) {
      console.warn("❌ [WEBHOOK] Invalid or missing webhook secret");
      return res.status(403).json({ success: false, message: "Invalid webhook secret" });
    }

    // Additionally support HMAC signature verification when signature header present
    const sigHeader = req.header('x-hub-signature-256') || req.header('x-hub-signature') || req.header('x-signature') || req.header('x-signature-256');
    if (sigHeader) {
      const secretForHmac = process.env.ALGORITHM_WEBHOOK_SECRET;
      const ok = verifyHmacSignature(req.body, sigHeader, secretForHmac);
      if (!ok) {
        console.warn('❌ [WEBHOOK] HMAC signature verification failed');
        return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "Empty payload" });
    }

    // Determine target appId: prefer payload.appId, then query param, then env LOS_APP_ID
    const appId = payload.appId || req.query.appId || process.env.LOS_APP_ID;
    if (!appId) {
      return res.status(400).json({ success: false, message: "appId is required either in payload or query param" });
    }

    // Use a standard table base name for storing applications inside each app namespace
    const baseTableName = "applications";
    const tableName = generateTableName(appId, baseTableName);

    // Ensure table exists. If missing, create a simple JSONB-backed table to store payloads.
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) {
      console.log(`🛠️ [WEBHOOK] Creating table ${tableName} to store incoming applications`);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${tableName}" (
          id SERIAL PRIMARY KEY,
          data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
      );
    }

    // We'll try to upsert by applicant email if available, otherwise insert
    const applicantEmail =
      payload.applicant?.email || payload.applicantEmail || payload.email || null;

    if (applicantEmail) {
      // Check several possible JSON paths for applicant email to support different payload shapes
      const selectQuery = `SELECT id FROM "${tableName}" WHERE (data->'applicant'->>'email' = $1) OR (data->>'applicantEmail' = $1) OR (data->>'email' = $1) LIMIT 1`;
      const existing = await prisma.$queryRawUnsafe(selectQuery, applicantEmail);

      if (existing && existing.length > 0) {
        // Update existing record
        const updateQuery = `UPDATE "${tableName}" SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
        const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(payload), existing[0].id);
        console.log(`✅ [WEBHOOK] Updated record id=${existing[0].id} in ${tableName}`);

        // Trigger workflows after update (async)
        try {
          const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
          for (const wf of workflows) {
            let nodes = wf.nodes;
            let edges = wf.edges;
            if (typeof nodes === 'string') {
              try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
            }
            if (typeof edges === 'string') {
              try { edges = JSON.parse(edges); } catch (e) { edges = []; }
            }

            const initialContext = {
              webhookPayload: payload,
              payload,
              body: payload,
              headers: req.headers,
              requestBody: payload,
              workflowId: wf.id,
              updatedRecordId: updated[0].id,
            };

            // enqueue job for processing by the workflow queue
            enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
          }
        } catch (e) {
          console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after update:', e.message || e);
        }

        return res.json({ success: true, operation: "update", record: updated[0] });
      } else {
        // Insert new
        const insertQuery = `INSERT INTO "${tableName}" (data) VALUES ($1) RETURNING *`;
        const inserted = await prisma.$queryRawUnsafe(insertQuery, JSON.stringify(payload));
        console.log(`✅ [WEBHOOK] Inserted new record id=${inserted[0].id} in ${tableName}`);

        // Trigger workflows after insert (async)
        try {
          const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
          for (const wf of workflows) {
            let nodes = wf.nodes;
            let edges = wf.edges;
            if (typeof nodes === 'string') {
              try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
            }
            if (typeof edges === 'string') {
              try { edges = JSON.parse(edges); } catch (e) { edges = []; }
            }

            const initialContext = {
              webhookPayload: payload,
              payload,
              body: payload,
              headers: req.headers,
              requestBody: payload,
              workflowId: wf.id,
              insertedRecordId: inserted[0].id,
            };

            // enqueue job for processing by the workflow queue
            enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
          }
        } catch (e) {
          console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after insert:', e.message || e);
        }

        return res.json({ success: true, operation: "insert", record: inserted[0] });
      }
    } else {
      // No unique key available; perform blind insert
      const insertQuery = `INSERT INTO "${tableName}" (data) VALUES ($1) RETURNING *`;
      const inserted = await prisma.$queryRawUnsafe(insertQuery, JSON.stringify(payload));
      console.log(`✅ [WEBHOOK] Inserted new record id=${inserted[0].id} in ${tableName} (no unique key)`);

      // After storing, optionally trigger workflows configured for this app
      try {
        const workflows = await prisma.workflow.findMany({ where: { appId: parseInt(appId) } });
        for (const wf of workflows) {
          let nodes = wf.nodes;
          let edges = wf.edges;
          if (typeof nodes === 'string') {
            try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
          }
          if (typeof edges === 'string') {
            try { edges = JSON.parse(edges); } catch (e) { edges = []; }
          }

          const initialContext = {
            webhookPayload: payload,
            payload,
            body: payload,
            headers: req.headers,
            requestBody: payload,
            workflowId: wf.id,
          };

          // enqueue job for processing by the workflow queue
          enqueueWorkflow(nodes || [], edges || [], initialContext, appId);
        }
      } catch (e) {
        console.warn('⚠️ [WEBHOOK] Failed to trigger workflows after insert:', e.message || e);
      }

      return res.json({ success: true, operation: "insert", record: inserted[0] });
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error processing algorithm webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/workflow/fetch-quote
 * @desc  Fetch latest quote from external Algorithm API for a specific record and update DB
 * @access Private (banker)
 */
router.post("/fetch-quote", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, url, authType, authConfig } = req.body;
    const userId = req.user.id;

    if (!appId || !recordId || !url) {
      return res.status(400).json({ success: false, message: "appId, recordId and url are required" });
    }

    // Verify user has access to this app
    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: "Access denied to this app" });

    const tableName = generateTableName(appId, "applications");
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: "Applications table not found for this app" });

    // Fetch record
    const selectQuery = `SELECT id, data FROM "${tableName}" WHERE id = $1 LIMIT 1`;
    const rows = await prisma.$queryRawUnsafe(selectQuery, recordId);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Record not found" });

    const record = rows[0];

    // Prepare HTTP request using executeHttpRequest helper
    const node = {
      data: {
        url,
        method: "POST",
        headers: [],
        bodyType: "json",
        body: JSON.stringify({ applicant: record.data?.applicant || record.data?.applicant || {} }),
        authType: authType || "bearer",
        authConfig: authConfig || {},
        timeout: 30000,
        saveResponseTo: "httpResponse",
      },
    };

    const httpResult = await executeHttpRequest(node, { token: req.header("authorization") }, appId, userId);

    if (!httpResult || !httpResult.context || !httpResult.context.httpResponse) {
      return res.status(500).json({ success: false, message: "Failed to fetch quote" });
    }

    const responseData = httpResult.context.httpResponse.data;

    // Merge quote into record.data.quote (replace existing quote)
    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{quote}', $1::jsonb, true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(responseData), record.id);

    // Audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: FETCH_QUOTE app:${appId} record:${recordId} user:${userId} status:success\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify app owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Latest quote fetched for record ${recordId}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [FETCH-QUOTE] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/update-status
 * @desc  Update application status (Completed / Rejected) and record audit & notify
 * @access Private (banker)
 */
router.post("/update-status", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, status } = req.body;
    const userId = req.user.id;
    if (!appId || !recordId || !status) return res.status(400).json({ success: false, message: 'appId, recordId and status required' });

    const allowed = ['Completed', 'Rejected', 'Pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', to_jsonb($1::text), true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, status, recordId);

    // Write audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: UPDATE_STATUS app:${appId} record:${recordId} user:${userId} status:${status}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Application ${recordId} marked ${status}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [UPDATE-STATUS] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/send-daily-summary
 * @desc  Send daily summary email to app owner (records in last 24h)
 * @access Private (banker or scheduled system user)
 */
router.post('/send-daily-summary', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.body;
    const userId = req.user.id;
    if (!appId) return res.status(400).json({ success: false, message: 'appId required' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    // Fetch records from last 24 hours
    const selectQuery = `SELECT id, data, created_at FROM "${tableName}" WHERE created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC`;
    const recent = await prisma.$queryRawUnsafe(selectQuery);

    const count = recent ? recent.length : 0;

    // Build summary
    let message = `Daily summary for app ${appId}: ${count} new application(s) in last 24 hours.`;
    if (count > 0) {
      const rows = recent.slice(0, 10).map(r => {
        const applicantName = (r.data && (r.data.applicant?.name || r.data.applicantName || r.data.name)) || 'Unknown';
        const email = (r.data && (r.data.applicant?.email || r.data.applicantEmail || r.data.email)) || 'Unknown';
        return `#${r.id} - ${applicantName} <${email}>`;
      });
      message += '\n\nRecent applications:\n' + rows.join('\n');
    }

    // Find app owner email
    const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
    if (!app || !app.ownerId) return res.status(404).json({ success: false, message: 'App owner not found' });

    const owner = await prisma.user.findUnique({ where: { id: app.ownerId }, select: { email: true, id: true, role: true } });
    if (!owner || !owner.email) return res.status(404).json({ success: false, message: 'Owner email not found' });

    // Send email (emailService handles console fallback in dev)
    const emailResult = await emailService.sendNotificationEmail(owner.email, 'system', message, owner.email.split('@')[0]);

    // Log and notify
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: DAILY_SUMMARY app:${appId} user:${userId} emailsent:${emailResult.success}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    if (global.emitNotification) {
      global.emitNotification({ userId: app.ownerId, type: 'system', message: `Daily summary: ${count} new application(s)`, id: Date.now(), createdAt: new Date() });
    }

    return res.json({ success: true, emailed: emailResult.success, details: emailResult });
  } catch (error) {
    console.error('❌ [DAILY-SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/workflow/fetch-quote
 * @desc  Fetch latest quote from external Algorithm API for a specific record and update DB
 * @access Private (banker)
 */
router.post("/workflow/fetch-quote", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, url, authType, authConfig } = req.body;
    const userId = req.user.id;

    if (!appId || !recordId || !url) {
      return res.status(400).json({ success: false, message: "appId, recordId and url are required" });
    }

    // Verify user has access to this app
    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: "Access denied to this app" });

    const tableName = generateTableName(appId, "applications");
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: "Applications table not found for this app" });

    // Fetch record
    const selectQuery = `SELECT id, data FROM "${tableName}" WHERE id = $1 LIMIT 1`;
    const rows = await prisma.$queryRawUnsafe(selectQuery, recordId);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Record not found" });

    const record = rows[0];

    // Build HTTP request node and execute using existing HTTP handler
    const node = {
      data: {
        url,
        method: "POST",
        headers: [],
        bodyType: "json",
        body: JSON.stringify({ applicant: record.data?.applicant || record.data?.applicant || {} }),
        authType: authType || "bearer",
        authConfig: authConfig || {},
        timeout: 30000,
        saveResponseTo: "httpResponse",
      },
    };

    const httpResult = await executeHttpRequest(node, { token: req.header("authorization") }, appId, userId);

    if (!httpResult || !httpResult.context || !httpResult.context.httpResponse) {
      return res.status(500).json({ success: false, message: "Failed to fetch quote" });
    }

    const responseData = httpResult.context.httpResponse.data;

    // Merge quote into record.data.quote (replace existing quote)
    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{quote}', $1::jsonb, true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, JSON.stringify(responseData), record.id);

    // Audit log (file)
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: FETCH_QUOTE app:${appId} record:${recordId} user:${userId} status:success\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify app owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Latest quote fetched for record ${recordId}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [FETCH-QUOTE] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/update-status
 * @desc  Update application status (Completed / Rejected) and record audit & notify
 * @access Private (banker)
 */
router.post("/workflow/update-status", authenticateToken, async (req, res) => {
  try {
    const { appId, recordId, status } = req.body;
    const userId = req.user.id;
    if (!appId || !recordId || !status) return res.status(400).json({ success: false, message: 'appId, recordId and status required' });

    const allowed = ['Completed', 'Rejected', 'Pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    const updateQuery = `UPDATE "${tableName}" SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', to_jsonb($1::text), true), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const updated = await prisma.$queryRawUnsafe(updateQuery, status, recordId);

    // Write audit log
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: UPDATE_STATUS app:${appId} record:${recordId} user:${userId} status:${status}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    // Notify owner
    try {
      const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
      if (app && app.ownerId) {
        const message = `Application ${recordId} marked ${status}`;
        await prisma.notification.create({ data: { userId: app.ownerId, type: 'system', message } });
        if (global.emitNotification) {
          global.emitNotification({ userId: app.ownerId, type: 'system', message, id: Date.now(), createdAt: new Date() });
        }
      }
    } catch (e) {
      console.warn('⚠️ Notification failed', e.message);
    }

    return res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('❌ [UPDATE-STATUS] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @route POST /api/workflow/send-daily-summary
 * @desc  Send daily summary email to app owner (records in last 24h)
 * @access Private (banker or scheduled system user)
 */
router.post('/workflow/send-daily-summary', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.body;
    const userId = req.user.id;
    if (!appId) return res.status(400).json({ success: false, message: 'appId required' });

    const hasAccess = await securityValidator.validateAppAccess(appId, userId, prisma);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const tableName = generateTableName(appId, 'applications');
    const exists = await dbUtils.tableExists(tableName);
    if (!exists) return res.status(404).json({ success: false, message: 'Applications table not found' });

    // Fetch records from last 24 hours
    const selectQuery = `SELECT id, data, created_at FROM "${tableName}" WHERE created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC`;
    const recent = await prisma.$queryRawUnsafe(selectQuery);

    const count = recent ? recent.length : 0;

    // Build summary
    let message = `Daily summary for app ${appId}: ${count} new application(s) in last 24 hours.`;
    if (count > 0) {
      const rows = recent.slice(0, 10).map(r => {
        const applicantName = (r.data && (r.data.applicant?.name || r.data.applicantName || r.data.name)) || 'Unknown';
        const email = (r.data && (r.data.applicant?.email || r.data.applicantEmail || r.data.email)) || 'Unknown';
        return `#${r.id} - ${applicantName} <${email}>`;
      });
      message += '\n\nRecent applications:\n' + rows.join('\n');
    }

    // Find app owner email
    const app = await prisma.app.findUnique({ where: { id: parseInt(appId) }, select: { ownerId: true } });
    if (!app || !app.ownerId) return res.status(404).json({ success: false, message: 'App owner not found' });

    const owner = await prisma.user.findUnique({ where: { id: app.ownerId }, select: { email: true, id: true, role: true } });
    if (!owner || !owner.email) return res.status(404).json({ success: false, message: 'Owner email not found' });

    // Send email (emailService handles console fallback in dev)
    const emailResult = await emailService.sendNotificationEmail(owner.email, 'system', message, owner.email.split('@')[0]);

    // Log and notify
    try {
      const fs = require('fs');
      const logDir = 'server/logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = `${new Date().toISOString()}: DAILY_SUMMARY app:${appId} user:${userId} emailsent:${emailResult.success}\n`;
      fs.appendFileSync(`${logDir}/audit.log`, logEntry);
    } catch (e) {
      console.warn('⚠️ Audit log write failed', e.message);
    }

    if (global.emitNotification) {
      global.emitNotification({ userId: app.ownerId, type: 'system', message: `Daily summary: ${count} new application(s)`, id: Date.now(), createdAt: new Date() });
    }

    return res.json({ success: true, emailed: emailResult.success, details: emailResult });
  } catch (error) {
    console.error('❌ [DAILY-SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
// Export runWorkflow for background worker to invoke
try {
  module.exports.runWorkflow = runWorkflow;
} catch (e) {
  // If runWorkflow is not defined (shouldn't happen), skip export
}
