import React, { useState, useEffect } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
import { useCanvasWorkflow } from "../../lib/canvas-workflow-context";
import {
  Settings,
  MousePointerClick,
  FileText,
  Clock,
  Database,
  UserPlus,
  LogIn,
  Upload,
  Calendar,
  Send,
  CheckCircle,
  Search,
  Edit,
  GitMerge,
  Mail,
  GitBranch,
  Code,
  ExternalLink,
  Bell,
  Shield,
  Globe,
  Shuffle,
  UserCheck,
  ArrowRight,
  AlertCircle,
  Check,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  useTableSuggestions,
  useColumnSuggestions,
  usePageSuggestions,
  useVariableSuggestions,
} from "../hooks/use-workflow-suggestions";

// ============================================================================
// DB.FIND SIMPLE MODE - TRANSLATION LAYER
// ============================================================================

// Simple mode template types
type DbFindTemplate = "all" | "findById" | "search" | "latest" | "custom";

// Simple mode UI state interface
interface DbFindSimpleState {
  mode: "simple" | "advanced";
  template: DbFindTemplate;
  tableName: string;

  // For 'findById' template
  idField?: string;
  idValue?: string;

  // For 'search' template
  searchField?: string;
  searchOperator?: string;
  searchValue?: string;
  resultLimit?: "all" | "first10" | "first50" | "custom";
  customLimit?: number;
  customOffset?: number;

  // For 'latest' template
  sortField?: string;
  sortDirection?: "newest" | "oldest";
  latestLimit?: number;
}

// ========== DB.UPDATE SIMPLE MODE TYPES ==========

// Simple mode UI state interface for db.update
interface DbUpdateSimpleState {
  mode: "simple" | "advanced";
  tableName: string;

  // Fields to update
  updateFields: Array<{
    id: string;
    field: string;
    value: string;
  }>;

  // Where conditions
  whereConditions: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
    logic: "AND" | "OR";
  }>;
}

// Operator mapping: Plain language → SQL
const OPERATOR_MAP: Record<string, string> = {
  equals: "=",
  "not equals": "!=",
  "greater than": ">",
  "less than": "<",
  "greater than or equal to": ">=",
  "less than or equal to": "<=",
  contains: "LIKE",
  "does not contain": "NOT LIKE",
  "is one of": "IN",
  "is not one of": "NOT IN",
  "is empty": "IS NULL",
  "is not empty": "IS NOT NULL",
};

// Reverse mapping: SQL → Plain language
const OPERATOR_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(OPERATOR_MAP).map(([k, v]) => [v, k])
);

// Convert simple mode state to backend format
function convertSimpleModeToBackend(simple: DbFindSimpleState): any {
  const config: any = {
    tableName: simple.tableName,
    conditions: [],
    orderBy: [],
    limit: 100,
    offset: 0,
    columns: ["*"],
  };

  switch (simple.template) {
    case "all":
      // Get all records - just defaults without sorting
      // Don't assume created_at/createdAt exists in all tables
      config.orderBy = [];
      config.limit = 100;
      break;

    case "findById":
      // Find one record by ID
      if (simple.idField && simple.idValue) {
        config.conditions = [
          {
            field: simple.idField,
            operator: "=",
            value: simple.idValue,
            logic: "AND",
          },
        ];
      }
      config.limit = 1;
      break;

    case "search":
      // Search with filters
      if (
        simple.searchField &&
        simple.searchOperator &&
        simple.searchValue !== undefined
      ) {
        const sqlOperator = OPERATOR_MAP[simple.searchOperator] || "=";
        config.conditions = [
          {
            field: simple.searchField,
            operator: sqlOperator,
            value: simple.searchValue,
            logic: "AND",
          },
        ];
      }

      // Apply result limit
      if (simple.resultLimit === "first10") {
        config.limit = 10;
      } else if (simple.resultLimit === "first50") {
        config.limit = 50;
      } else if (simple.resultLimit === "all") {
        config.limit = 1000; // Max limit
      } else if (simple.resultLimit === "custom") {
        config.limit = simple.customLimit || 100;
        config.offset = simple.customOffset || 0;
      }

      // Don't assume created_at/createdAt exists in all tables
      config.orderBy = [];
      break;

    case "latest":
      // Get latest records with sorting
      if (simple.sortField) {
        const direction = simple.sortDirection === "newest" ? "DESC" : "ASC";
        config.orderBy = [{ field: simple.sortField, direction }];
      }
      config.limit = simple.latestLimit || 10;
      break;

    case "custom":
      // Custom mode - should not reach here, handled by advanced mode
      break;
  }

  return config;
}

// Detect if backend config matches a simple template
function detectTemplateFromBackend(data: any): DbFindTemplate {
  const hasConditions =
    data.conditions &&
    Array.isArray(data.conditions) &&
    data.conditions.length > 0;
  const hasOrderBy =
    data.orderBy && Array.isArray(data.orderBy) && data.orderBy.length > 0;

  // Check for 'findById' pattern: single condition with = operator, limit 1
  if (hasConditions && data.conditions.length === 1 && data.limit === 1) {
    const condition = data.conditions[0];
    if (condition.operator === "=") {
      return "findById";
    }
  }

  // Check for 'search' pattern: single condition with any operator
  if (
    (hasConditions && data.conditions.length === 1 && !data.limit) ||
    data.limit > 1
  ) {
    return "search";
  }

  // Check for 'latest' pattern: no conditions, has orderBy
  if (!hasConditions && hasOrderBy) {
    return "latest";
  }

  // Check for 'all' pattern: no conditions, default limit
  if (!hasConditions && (!data.limit || data.limit >= 100)) {
    return "all";
  }

  // Complex query - use custom/advanced mode
  return "custom";
}

// Convert backend format to simple mode state
function convertBackendToSimpleMode(data: any): DbFindSimpleState {
  const template = detectTemplateFromBackend(data);

  const simple: DbFindSimpleState = {
    mode: template === "custom" ? "advanced" : "simple",
    template,
    tableName: data.tableName || "",
  };

  switch (template) {
    case "findById":
      if (data.conditions && data.conditions[0]) {
        simple.idField = data.conditions[0].field;
        simple.idValue = data.conditions[0].value;
      }
      break;

    case "search":
      if (data.conditions && data.conditions[0]) {
        simple.searchField = data.conditions[0].field;
        simple.searchOperator =
          OPERATOR_REVERSE_MAP[data.conditions[0].operator] || "equals";
        simple.searchValue = data.conditions[0].value;
      }

      // Detect result limit
      if (data.limit === 10) {
        simple.resultLimit = "first10";
      } else if (data.limit === 50) {
        simple.resultLimit = "first50";
      } else if (data.limit >= 1000) {
        simple.resultLimit = "all";
      } else {
        simple.resultLimit = "custom";
        simple.customLimit = data.limit;
        simple.customOffset = data.offset || 0;
      }
      break;

    case "latest":
      if (data.orderBy && data.orderBy[0]) {
        simple.sortField = data.orderBy[0].field;
        simple.sortDirection =
          data.orderBy[0].direction === "DESC" ? "newest" : "oldest";
      }
      simple.latestLimit = data.limit || 10;
      break;

    case "all":
      // No additional config needed
      break;
  }

  return simple;
}

// ========== DB.UPDATE CONVERSION FUNCTIONS ==========

// Convert simple mode state to backend format for db.update
function convertDbUpdateSimpleToBackend(simple: DbUpdateSimpleState): any {
  // Convert updateFields array to updateData object
  const updateData: Record<string, string> = {};
  simple.updateFields.forEach((field) => {
    if (field.field && field.value !== undefined) {
      updateData[field.field] = field.value;
    }
  });

  // Convert whereConditions array to backend format
  const whereConditions = simple.whereConditions.map((condition) => ({
    field: condition.field,
    operator: OPERATOR_MAP[condition.operator] || condition.operator,
    value: condition.value,
    logic: condition.logic || "AND",
  }));

  return {
    tableName: simple.tableName,
    updateData,
    whereConditions,
  };
}

// Convert backend format to simple mode state for db.update
function convertDbUpdateBackendToSimple(data: any): DbUpdateSimpleState {
  const simple: DbUpdateSimpleState = {
    mode: "simple",
    tableName: data.tableName || "",
    updateFields: [],
    whereConditions: [],
  };

  // Convert updateData object to updateFields array
  if (data.updateData) {
    let updateDataObj = data.updateData;

    // Parse if it's a string
    if (typeof updateDataObj === "string") {
      try {
        updateDataObj = JSON.parse(updateDataObj);
      } catch {
        // If parsing fails, switch to advanced mode
        simple.mode = "advanced";
        return simple;
      }
    }

    // Convert object to array of fields
    if (typeof updateDataObj === "object" && updateDataObj !== null) {
      simple.updateFields = Object.entries(updateDataObj).map(
        ([field, value], index) => ({
          id: `field-${index}-${Date.now()}`,
          field,
          value: String(value),
        })
      );
    }
  }

  // Convert whereConditions to array format
  if (data.whereConditions) {
    let conditionsArray = data.whereConditions;

    // Parse if it's a string
    if (typeof conditionsArray === "string") {
      try {
        const parsed = JSON.parse(conditionsArray);
        conditionsArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // If parsing fails, switch to advanced mode
        simple.mode = "advanced";
        return simple;
      }
    }

    // Ensure it's an array
    if (!Array.isArray(conditionsArray)) {
      conditionsArray = [conditionsArray];
    }

    // Convert to simple format
    simple.whereConditions = conditionsArray.map(
      (condition: any, index: number) => ({
        id: `condition-${index}-${Date.now()}`,
        field: condition.field || "",
        operator:
          OPERATOR_REVERSE_MAP[condition.operator] ||
          condition.operator ||
          "equals",
        value: String(condition.value || ""),
        logic: condition.logic || "AND",
      })
    );
  }

  return simple;
}

// ============================================================================
// END OF TRANSLATION LAYER
// ============================================================================

// Get icon component for each block type
const getBlockIcon = (label: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    // Triggers
    onClick: MousePointerClick,
    onPageLoad: FileText,
    onSchedule: Clock,
    onRecordCreate: Database,
    onRecordUpdate: Edit,
    onLogin: LogIn,
    onDrop: Upload,
    onSubmit: Send,

    // Conditions
    dateValid: Calendar,
    isFilled: CheckCircle,
    match: Shuffle,
    roleIs: UserCheck,
    "auth.verify": Shield,

    // Actions
    "db.create": Database,
    "db.find": Search,
    "db.update": Edit,
    "db.upsert": GitMerge,
    "email.send": Mail,
    switch: GitBranch,
    expr: Code,
    "ui.openModal": ExternalLink,
    "notify.toast": Bell,
    "http.request": Globe,
    "page.redirect": ArrowRight,
    "ai.summarize": Sparkles,
  };

  return iconMap[label] || Settings;
};

// Check if a block is configured (has required fields filled)
const isBlockConfigured = (data: WorkflowNodeData): boolean => {
  switch (data.label) {
    case "onClick":
    case "onPageLoad":
    case "page.redirect":
      return !!data.targetPageId;

    case "onSchedule":
      return !!data.cronExpression;

    case "onRecordCreate":
    case "onRecordUpdate":
      return !!data.tableName;

    case "onDrop":
      return !!data.targetElementId;

    case "dateValid":
      return !!(data.selectedElementIds && data.selectedElementIds.length > 0);

    case "onSubmit":
    case "isFilled":
      return !!data.selectedFormGroup;

    case "db.create":
      return !!(data.tableName && data.insertData);

    case "db.find":
      return !!(data.tableName && data.conditions);

    case "db.update":
      return !!(data.tableName && data.updateData && data.whereConditions);

    case "db.upsert":
      return !!(
        data.tableName &&
        data.insertData &&
        data.updateData &&
        data.uniqueFields
      );

    case "email.send":
      return !!(data.emailTo && data.emailSubject);

    case "switch":
      return !!(
        data.switchInputValue &&
        data.switchCases &&
        data.switchCases.length > 0
      );

    case "expr":
      return !!data.exprExpression;

    case "ui.openModal":
      return !!data.modalId;

    case "notify.toast":
      return !!data.message;

    case "auth.verify":
      return true; // No required config

    case "http.request":
      return !!(data.url && data.method);

    case "match":
      return !!(data.leftValue && data.rightValue);

    case "roleIs":
      return !!data.requiredRole;

    case "onLogin":
      return true; // No required config

    case "ai.summarize":
      return !!(data.fileVariable && data.apiKey);

    default:
      return false;
  }
};

// Category color mapping
const getCategoryColors = (category: string) => {
  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; icon: string }
  > = {
    Triggers: {
      bg: "bg-blue-500/20",
      border: "border-blue-500/30",
      text: "text-blue-400",
      icon: "bg-blue-500",
    },
    Conditions: {
      bg: "bg-green-500/20",
      border: "border-green-500/30",
      text: "text-green-400",
      icon: "bg-green-500",
    },
    Actions: {
      bg: "bg-purple-500/20",
      border: "border-purple-500/30",
      text: "text-purple-400",
      icon: "bg-purple-500",
    },
    "AI Blocks": {
      bg: "bg-pink-500/20",
      border: "border-pink-500/30",
      text: "text-pink-400",
      icon: "bg-pink-500",
    },
    "Security & Governance": {
      bg: "bg-red-500/20",
      border: "border-red-500/30",
      text: "text-red-400",
      icon: "bg-red-500",
    },
    "Utility & Data": {
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
      icon: "bg-yellow-500",
    },
  };

  return (
    colorMap[category] || {
      bg: "bg-gray-500/20",
      border: "border-gray-500/30",
      text: "text-gray-400",
      icon: "bg-gray-500",
    }
  );
};

// Define the WorkflowNodeData interface
export interface WorkflowNodeData {
  label: string;
  description?: string;
  category: string;
  icon: string;
  hasWarning?: boolean;
  isLocked?: boolean;
  selectedFormGroup?: string;
  selectedElementId?: string;
  selectedElementIds?: string[];
  targetPageId?: string;
  targetElementId?: string;
  url?: string;
  openInNewTab?: boolean;
  acceptedTypes?: string[];
  maxFileSize?: number;
  allowMultiple?: boolean;
  dateFormat?: string;
  validationRules?: {
    required?: boolean;
    futureOnly?: boolean;
    pastOnly?: boolean;
    businessDaysOnly?: boolean;
    noLeapYear?: boolean;
    minDate?: string;
    maxDate?: string;
  };
  tableName?: string;
  triggerType?: string;
  // DbFind configuration properties
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
    logic?: string;
  }>;
  orderBy?: Array<{
    field: string;
    direction: string;
  }>;
  limit?: number;
  offset?: number;
  columns?: string[];
  dataMapping?: Record<string, any>;
  // DbUpdate configuration properties
  updateData?: Record<string, any>;
  whereConditions?: Array<{
    field: string;
    operator: string;
    value: any;
    logic?: string;
  }>;
  returnUpdatedRecords?: boolean;
  // DbUpsert configuration properties
  uniqueFields?: string[];
  insertData?: Record<string, any>;
  returnRecord?: boolean;
  // EmailSend configuration properties
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailBodyType?: "html" | "text";
  emailFrom?: string;
  emailCc?: string[];
  emailBcc?: string[];
  emailTemplate?: string;
  emailTemplateVars?: Record<string, any>;
  // Switch configuration properties
  switchInputValue?: string;
  switchCases?: Array<{ caseValue: string; caseLabel?: string }>;
  switchDefaultCase?: boolean;
  // Expr configuration properties
  exprExpression?: string;
  exprOutputVariable?: string;
  // OpenModal configuration properties
  modalId?: string;
  modalTitle?: string;
  modalContent?: string;
  modalSize?: "small" | "medium" | "large" | "fullscreen";
  showCloseButton?: boolean;
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  modalData?: Record<string, any>;
  // OnSchedule trigger properties
  scheduleType?: "interval" | "cron";
  scheduleValue?: number;
  scheduleUnit?: "seconds" | "minutes" | "hours" | "days" | "weeks";
  cronExpression?: string;
  enabled?: boolean;
  // OnRecordCreate trigger properties
  filterConditions?: Array<{
    column: string;
    operator: string;
    value: string;
  }>;
  // OnRecordUpdate trigger properties
  watchColumns?: string[];
  // NotifyToast configuration properties
  message?: string;
  title?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  position?: string;

  // Match configuration properties
  leftValue?: string;
  rightValue?: string;
  comparisonType?: "text" | "number" | "date" | "list";
  operator?: string;
  options?: {
    ignoreCase?: boolean;
    trimSpaces?: boolean;
    allowPartialMatches?: boolean;
  };

  // auth.verify configuration properties
  tokenSource?: "context" | "header" | "config";
  requireVerified?: boolean;
  requiredRole?: string;
  validateExpiration?: boolean;
  checkBlacklist?: boolean;

  // onLogin configuration properties
  captureUserData?: boolean;
  storeToken?: boolean;
  captureMetadata?: boolean;

  // http.request configuration properties
  method?: string;
  headers?: Array<{ key: string; value: string }>;
  bodyType?: "none" | "json" | "raw";
  body?: string;
  authType?: "none" | "bearer" | "api-key" | "basic";
  authConfig?: {
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
  responseType?: string;
  saveResponseTo?: string;

  // ai.summarize configuration properties
  fileVariable?: string;
  apiKey?: string;
  outputVariable?: string;

  // roleIs configuration properties
  checkMultiple?: boolean;
  roles?: string[];
}

const WorkflowNode: React.FC<NodeProps<WorkflowNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const { setNodes } = useReactFlow();
  const { formGroups: formGroupsFromContext } = useCanvasWorkflow();
  const [formGroups, setFormGroups] = useState<
    Array<{ id: string; name: string; elementIds: string[] }>
  >([]);
  const [formElements, setFormElements] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);
  const [appId, setAppId] = useState<string | null>(null);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // State for all canvas elements (for onDrop and dateValid dropdowns)
  const [allCanvasElements, setAllCanvasElements] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      pageId: string;
      pageName: string;
    }>
  >([]);

  // State for db.find simple mode
  const [dbFindSimpleState, setDbFindSimpleState] = useState<DbFindSimpleState>(
    () => {
      // Initialize from existing data if available
      if (data.label === "db.find" && data.tableName) {
        return convertBackendToSimpleMode(data);
      }
      // Default state for new db.find blocks
      return {
        mode: "simple",
        template: "all",
        tableName: "",
      };
    }
  );

  // State for db.update simple mode
  const [dbUpdateSimpleState, setDbUpdateSimpleState] =
    useState<DbUpdateSimpleState>(() => {
      // Initialize from existing data if available
      if (
        data.label === "db.update" &&
        (data.updateData || data.whereConditions)
      ) {
        return convertDbUpdateBackendToSimple(data);
      }
      // Default state for new db.update blocks
      return {
        mode: "simple",
        tableName: "",
        updateFields: [],
        whereConditions: [],
      };
    });

  // Helper function to update node data
  const updateNodeData = (key: string, value: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, [key]: value },
            }
          : node
      )
    );
  };

  // Filter elements suitable for drop zones (containers, shapes, etc.)
  const getDropZoneElements = () => {
    return allCanvasElements.filter((element) => {
      const type = element.type.toUpperCase();
      // Include containers, shapes, and large interactive elements
      return (
        [
          "SHAPE",
          "RECTANGLE",
          "CIRCLE",
          "TRIANGLE",
          "CONTAINER",
          "DIV",
          "SECTION",
          "PANEL",
          "CARD",
          "IMAGE",
          "BUTTON",
        ].includes(type) ||
        type.includes("CONTAINER") ||
        type.includes("ZONE") ||
        type.includes("SHAPE")
      );
    });
  };

  // Filter FILE_UPLOAD elements for ai.summarize block
  const getFileUploadElements = () => {
    return allCanvasElements.filter((element) => {
      const type = element.type.toUpperCase();
      return (
        ["FILE_UPLOAD", "FILE", "UPLOAD", "ADDFILE", "FILE_INPUT"].includes(
          type
        ) ||
        type.includes("FILE") ||
        type.includes("UPLOAD")
      );
    });
  };

  // Filter elements suitable for date validation (date inputs)
  const getDateElements = () => {
    return allCanvasElements.filter((element) => {
      const type = element.type.toUpperCase();
      // Include date-related input types
      return (
        [
          "DATE_PICKER",
          "DATE_FIELD",
          "DATETIME_FIELD",
          "DATE",
          "CALENDAR",
        ].includes(type) || type.includes("DATE")
      );
    });
  };

  // Fetch form groups and elements for the current app
  useEffect(() => {
    const fetchFormData = async () => {
      try {
        // Get appId from URL or context
        const urlParams = new URLSearchParams(window.location.search);
        const currentAppId = urlParams.get("appId");

        if (!currentAppId) return;

        setAppId(currentAppId);

        // Fetch canvas data to get form groups and elements
        const token = localStorage.getItem("authToken");
        console.log("🔑 [WF-NODE] Using auth token:", token ? "YES" : "NO");

        const response = await fetch(`/api/canvas/${currentAppId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const canvasData = await response.json();
          console.log("📋 [WF-NODE] Canvas data received:", canvasData);

          // Extract form groups from canvas state - FIXED: Parse if string
          let canvasState = canvasData.data?.canvasState;
          console.log("📋 [WF-NODE] Canvas state type:", typeof canvasState);

          // Parse if it's a string
          if (typeof canvasState === "string") {
            try {
              canvasState = JSON.parse(canvasState);
              console.log("📋 [WF-NODE] Parsed canvas state from string");
            } catch (e) {
              console.error("❌ [WF-NODE] Failed to parse canvas state:", e);
              canvasState = null;
            }
          }

          console.log("📋 [WF-NODE] Canvas state:", canvasState);
          console.log(
            "📋 [WF-NODE] Canvas state pages:",
            canvasState?.pages?.length || 0
          );

          if (canvasState?.pages) {
            const allGroups: Array<{
              id: string;
              name: string;
              elementIds: string[];
            }> = [];
            const allElements: Array<{
              id: string;
              name: string;
              type: string;
            }> = [];

            // Array to store ALL canvas elements for onDrop and dateValid
            const allCanvasElems: Array<{
              id: string;
              name: string;
              type: string;
              pageId: string;
              pageName: string;
            }> = [];

            canvasState.pages.forEach((page: any, pageIndex: number) => {
              console.log(`📋 [WF-NODE] Processing page ${pageIndex}:`, page);

              // Get form groups (type: "form")
              if (page.groups) {
                console.log(
                  `📋 [WF-NODE] Page ${pageIndex} groups:`,
                  page.groups
                );
                const pageFormGroups = page.groups
                  .filter((group: any) => group.type === "form")
                  .map((group: any) => ({
                    id: group.id,
                    name: group.name,
                    elementIds: group.elementIds || [],
                  }));
                console.log(
                  `📝 [WF-NODE] Page ${pageIndex} form groups:`,
                  pageFormGroups
                );
                allGroups.push(...pageFormGroups);
              } else {
                console.log(`📋 [WF-NODE] Page ${pageIndex} has no groups`);
              }

              // Get form elements
              if (page.elements) {
                console.log(
                  `📋 [WF-NODE] Page ${pageIndex} elements:`,
                  page.elements.length
                );
                const pageFormElements = page.elements
                  .filter((element: any) =>
                    [
                      // Uppercase variants
                      "TEXT_FIELD",
                      "TEXT_AREA",
                      "DROPDOWN",
                      "CHECKBOX",
                      "RADIO_BUTTON",
                      "TOGGLE",
                      "DATE_FIELD",
                      "DATE_PICKER",
                      "EMAIL_FIELD",
                      "PHONE_FIELD",
                      "PASSWORD_FIELD",
                      "NUMBER_FIELD",
                      "FILE_UPLOAD",
                      "UPLOAD",
                      "ADDFILE",
                      // Lowercase variants
                      "textfield",
                      "textarea",
                      "checkbox",
                      "radiobutton",
                      "dropdown",
                      "toggle",
                      "phone",
                      "password",
                      "calendar",
                      "upload",
                      "addfile",
                    ].includes(element.type)
                  )
                  .map((element: any) => ({
                    id: element.id,
                    name:
                      element.properties?.label ||
                      element.properties?.placeholder ||
                      element.properties?.name ||
                      element.id,
                    type: element.type,
                  }));
                console.log(
                  `🔧 [WF-NODE] Page ${pageIndex} form elements:`,
                  pageFormElements
                );
                allElements.push(...pageFormElements);

                // Get ALL canvas elements for onDrop and dateValid dropdowns
                const pageAllElements = page.elements.map((element: any) => ({
                  id: element.id,
                  name:
                    element.properties?.label ||
                    element.properties?.placeholder ||
                    element.properties?.name ||
                    element.properties?.text ||
                    element.id,
                  type: element.type,
                  pageId: page.id,
                  pageName: page.name || `Page ${page.id}`,
                }));
                allCanvasElems.push(...pageAllElements);
              } else {
                console.log(`📋 [WF-NODE] Page ${pageIndex} has no elements`);
              }
            });

            // Extract pages for page.redirect dropdown
            const allPages = canvasState.pages.map((page: any) => ({
              id: page.id,
              name: page.name || `Page ${page.id}`,
            }));

            console.log("📝 [WF-NODE] Final form groups:", allGroups);
            console.log("🔧 [WF-NODE] Final form elements:", allElements);
            console.log("📄 [WF-NODE] Final pages:", allPages);
            console.log(
              "🎨 [WF-NODE] Final all canvas elements:",
              allCanvasElems.length
            );
            console.log(
              "🎯 [WF-NODE] SUMMARY - Form groups found:",
              allGroups.length
            );
            allGroups.forEach((group, index) => {
              console.log(
                `  📝 Form Group ${index + 1}:`,
                group.name,
                `(${group.elementIds.length} elements)`
              );
            });

            setFormGroups(allGroups);
            setFormElements(allElements);
            setPages(allPages);
            setAllCanvasElements(allCanvasElems);
          } else {
            console.warn("📋 [WF-NODE] No canvas state or pages found");
          }
        } else {
          console.error(
            "❌ [WF-NODE] Failed to fetch canvas data:",
            response.status
          );
          if (response.status === 401) {
            console.log(
              "🔒 [WF-NODE] Authentication failed, redirecting to login"
            );
            window.location.href = "/";
            return;
          } else if (response.status === 403) {
            console.error(
              "🔒 [WF-NODE] Access denied - insufficient permissions"
            );
          } else if (response.status === 404) {
            console.error("📄 [WF-NODE] Canvas data not found");
          } else if (response.status >= 500) {
            console.error("🔥 [WF-NODE] Server error - please try again later");
          } else {
            console.error(`🔥 [WF-NODE] Unexpected error: ${response.status}`);
          }
        }
      } catch (error) {
        console.error("🌐 [WF-NODE] Network error fetching form data:", error);
      }
    };

    fetchFormData();
  }, []);

  // Listen for form group updates from canvas
  useEffect(() => {
    const handleFormGroupsUpdated = (event: any) => {
      console.log(
        "🔄 [WF-NODE] Form groups updated event received:",
        event.detail
      );
      const updatedFormGroups = event.detail || [];
      setFormGroups(updatedFormGroups);
      console.log(
        "📝 [WF-NODE] Updated form groups state:",
        updatedFormGroups.length
      );
    };

    // Add event listener
    window.addEventListener("formGroupsUpdated", handleFormGroupsUpdated);
    console.log("👂 [WF-NODE] Listening for form group updates");

    // Initial load of form groups from context if available
    if (formGroupsFromContext && formGroupsFromContext.length > 0) {
      console.log(
        "🔄 [WF-NODE] Loading initial form groups from context:",
        formGroupsFromContext.length
      );
      setFormGroups(formGroupsFromContext);
    }

    // Cleanup
    return () => {
      window.removeEventListener("formGroupsUpdated", handleFormGroupsUpdated);
      console.log("🧹 [WF-NODE] Removed form group update listener");
    };
  }, [formGroupsFromContext]);

  // Manual refresh function for debugging
  const refreshFormGroups = async () => {
    console.log("🔄 [WF-NODE] Manual refresh triggered");
    const urlParams = new URLSearchParams(window.location.search);
    const currentAppId = urlParams.get("appId");

    if (!currentAppId) return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/canvas/${currentAppId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const canvasData = await response.json();
        let canvasState = canvasData.data?.canvasState;

        // FIXED: Parse if it's a string
        if (typeof canvasState === "string") {
          try {
            canvasState = JSON.parse(canvasState);
          } catch (e) {
            console.error(
              "❌ [WF-NODE] Failed to parse canvas state in refresh:",
              e
            );
            canvasState = null;
          }
        }

        if (canvasState?.pages) {
          const allGroups: Array<{
            id: string;
            name: string;
            elementIds: string[];
          }> = [];

          canvasState.pages.forEach((page: any) => {
            if (page.groups) {
              const pageFormGroups = page.groups
                .filter((group: any) => group.type === "form")
                .map((group: any) => ({
                  id: group.id,
                  name: group.name,
                  elementIds: group.elementIds || [],
                }));
              allGroups.push(...pageFormGroups);
            }
          });

          setFormGroups(allGroups);
          console.log(
            "🔄 [WF-NODE] Manual refresh complete:",
            allGroups.length,
            "form groups"
          );
        }
      }
    } catch (error) {
      console.error("❌ [WF-NODE] Manual refresh failed:", error);
    }
  };

  // Get category colors
  const colors = getCategoryColors(data.category);

  // Helper function to render configuration content in the modal
  const renderConfigurationContent = () => {
    // This will contain all the configuration forms based on block type
    // We'll render the appropriate configuration based on data.label
    return <div className="space-y-4">{renderBlockConfiguration()}</div>;
  };

  // Get suggestions hooks
  const { pages: pageSuggestions } = usePageSuggestions();
  const { tables: tableSuggestions } = useTableSuggestions();

  // Helper function to render block-specific configuration
  const renderBlockConfiguration = () => {
    switch (data.label) {
      case "onClick":
      case "onPageLoad":
      case "page.redirect":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Page:</label>
              <select
                value={data.targetPageId || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, targetPageId: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {pageSuggestions.length === 0
                    ? "No pages found..."
                    : "Select target page..."}
                </option>
                {pageSuggestions.map((page) => (
                  <option key={page.value} value={page.value}>
                    {page.label}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground">
                Pages available: {pageSuggestions.length}
              </div>
            </div>

            {data.label === "page.redirect" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="openInNewTab"
                  checked={data.openInNewTab || false}
                  onChange={(e) => {
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                openInNewTab: e.target.checked,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="openInNewTab" className="text-sm">
                  Open in new tab
                </label>
              </div>
            )}

            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Available Context Variables:
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>• {`{{context.pageId}}`} - Current page ID</div>
                <div>• {`{{context.pageName}}`} - Current page name</div>
                <div>
                  • {`{{context.loadData.timestamp}}`} - Page load timestamp
                </div>
                <div>
                  • {`{{context.loadData.elementCount}}`} - Number of elements
                  on page
                </div>
              </div>
            </div>
          </div>
        );

      case "onSchedule":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule Type:</label>
              <select
                value={data.scheduleType || "interval"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, scheduleType: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="interval">Interval</option>
                <option value="cron">Cron Expression</option>
              </select>
            </div>

            {(data.scheduleType || "interval") === "interval" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Interval Value:</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={data.scheduleValue || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  scheduleValue: parseInt(value) || 0,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit:</label>
                  <select
                    value={data.scheduleUnit || "minutes"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, scheduleUnit: value },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </>
            )}

            {data.scheduleType === "cron" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cron Expression:</label>
                <input
                  type="text"
                  placeholder="0 0 * * * (daily at midnight)"
                  value={data.cronExpression || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, cronExpression: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={data.enabled !== false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, enabled: e.target.checked },
                          }
                        : node
                    )
                  );
                }}
                className="w-4 h-4"
              />
              <label htmlFor="enabled" className="text-sm">
                Enabled
              </label>
            </div>
          </div>
        );

      case "notify.toast":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Message:</label>
              <textarea
                placeholder="Enter notification message..."
                value={data.message || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, message: value },
                          }
                        : node
                    )
                  );
                }}
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title (Optional):</label>
              <input
                type="text"
                placeholder="Notification title..."
                value={data.title || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, title: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Variant:</label>
              <select
                value={data.variant || "default"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, variant: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">Default</option>
                <option value="success">Success</option>
                <option value="destructive">Error</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Duration (milliseconds):
              </label>
              <input
                type="number"
                placeholder="3000"
                value={data.duration || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              duration: parseInt(value) || 3000,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "onRecordCreate":
      case "onRecordUpdate":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Table Name:</label>
              {tableSuggestions.length > 0 ? (
                <select
                  value={data.tableName || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, tableName: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select table...</option>
                  {tableSuggestions.map((table) => (
                    <option key={table.value} value={table.value}>
                      {table.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter table name..."
                  value={data.tableName || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, tableName: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <div className="text-xs text-muted-foreground">
                Table to monitor for{" "}
                {data.label === "onRecordCreate" ? "new" : "updated"} records
              </div>
            </div>

            {data.label === "onRecordUpdate" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Watch Columns (Optional):
                </label>
                <input
                  type="text"
                  placeholder="column1, column2, column3"
                  value={(data.watchColumns || []).join(", ")}
                  onChange={(e) => {
                    const value = e.target.value;
                    const columns = value
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean);
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, watchColumns: columns },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-muted-foreground">
                  Comma-separated list of columns to watch for changes
                </div>
              </div>
            )}
          </div>
        );

      case "db.create":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Table Name:</label>
              {tableSuggestions.length > 0 ? (
                <select
                  value={data.tableName || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, tableName: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select or type table name...</option>
                  {tableSuggestions.map((table) => (
                    <option key={table.value} value={table.value}>
                      {table.label}
                    </option>
                  ))}
                  <option value="__custom__">➕ Create new table...</option>
                </select>
              ) : null}
              {(tableSuggestions.length === 0 ||
                data.tableName === "__custom__") && (
                <input
                  type="text"
                  placeholder="Enter new table name..."
                  value={
                    data.tableName === "__custom__" ? "" : data.tableName || ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, tableName: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <div className="text-xs text-muted-foreground">
                {tableSuggestions.length > 0
                  ? "Select an existing table or choose 'Create new table' to enter a custom name"
                  : "Enter a table name to create a new table"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Insert Data:</label>
              <div className="text-xs text-muted-foreground mb-2">
                Add field-value pairs to insert into the table
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(data.insertData ? Object.entries(data.insertData) : []).map(
                  ([column, value], index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="column name"
                        value={column || ""}
                        onChange={(e) => {
                          const newData = { ...(data.insertData || {}) };
                          const oldColumn = column;
                          const newColumn = e.target.value;

                          // Remove old key and add new key with same value
                          delete newData[oldColumn];
                          newData[newColumn] = value;

                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id
                                ? {
                                    ...node,
                                    data: { ...node.data, insertData: newData },
                                  }
                                : node
                            )
                          );
                        }}
                        className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="value"
                        value={(value as string) || ""}
                        onChange={(e) => {
                          const newData = { ...(data.insertData || {}) };
                          newData[column] = e.target.value;
                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id
                                ? {
                                    ...node,
                                    data: { ...node.data, insertData: newData },
                                  }
                                : node
                            )
                          );
                        }}
                        className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => {
                          const newData = { ...(data.insertData || {}) };
                          delete newData[column];
                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id
                                ? {
                                    ...node,
                                    data: { ...node.data, insertData: newData },
                                  }
                                : node
                            )
                          );
                        }}
                        className="px-2 py-2 text-sm border rounded-md hover:bg-red-500/10 hover:border-red-500 transition-colors"
                        title="Remove field"
                      >
                        ✕
                      </button>
                    </div>
                  )
                )}
              </div>
              <button
                onClick={() => {
                  const newData = { ...(data.insertData || {}) };
                  const newKey = `field_${Object.keys(newData).length + 1}`;
                  newData[newKey] = "";
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, insertData: newData },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border border-dashed rounded-md hover:bg-muted transition-colors"
              >
                + Add Field
              </button>
              {(!data.insertData ||
                Object.keys(data.insertData).length === 0) && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-2">
                  ⚠️ Add at least one field to insert data into the table
                </div>
              )}
            </div>
          </div>
        );

      case "email.send":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">To:</label>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={data.emailTo || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, emailTo: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subject:</label>
              <input
                type="text"
                placeholder="Email subject..."
                value={data.emailSubject || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, emailSubject: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Body:</label>
              <textarea
                placeholder="Email body..."
                value={data.emailBody || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, emailBody: value },
                          }
                        : node
                    )
                  );
                }}
                rows={5}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Body Type:</label>
              <select
                value={data.emailBodyType || "text"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, emailBodyType: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Plain Text</option>
                <option value="html">HTML</option>
              </select>
            </div>
          </div>
        );

      case "http.request":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL:</label>
              <input
                type="url"
                placeholder="https://api.example.com/endpoint"
                value={data.url || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, url: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Method:</label>
              <select
                value={data.method || "GET"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, method: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            {(data.method === "POST" ||
              data.method === "PUT" ||
              data.method === "PATCH") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Request Body:</label>
                <textarea
                  placeholder='{"key": "value"}'
                  value={data.body || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, body: value },
                            }
                          : node
                      )
                    );
                  }}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            )}
          </div>
        );

      case "ui.openModal":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modal ID:</label>
              <input
                type="text"
                placeholder="my-modal"
                value={data.modalId || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, modalId: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Modal Title:</label>
              <input
                type="text"
                placeholder="Modal Title"
                value={data.modalTitle || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, modalTitle: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Modal Size:</label>
              <select
                value={data.modalSize || "medium"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, modalSize: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="fullscreen">Fullscreen</option>
              </select>
            </div>
          </div>
        );

      case "db.find":
        // Helper function to update simple state and sync to backend
        const updateDbFindSimpleState = (
          updates: Partial<DbFindSimpleState>
        ) => {
          const newState = { ...dbFindSimpleState, ...updates };
          setDbFindSimpleState(newState);

          // Convert to backend format and update node data
          const backendConfig = convertSimpleModeToBackend(newState);
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id
                ? {
                    ...node,
                    data: { ...node.data, ...backendConfig },
                  }
                : node
            )
          );
        };

        return (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium">Configuration Mode:</div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateDbFindSimpleState({ mode: "simple" })}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dbFindSimpleState.mode === "simple"
                      ? "bg-blue-500 text-white"
                      : "bg-background border hover:bg-muted"
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => updateDbFindSimpleState({ mode: "advanced" })}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dbFindSimpleState.mode === "advanced"
                      ? "bg-blue-500 text-white"
                      : "bg-background border hover:bg-muted"
                  }`}
                >
                  Advanced
                </button>
              </div>
            </div>

            {/* Simple Mode UI */}
            {dbFindSimpleState.mode === "simple" && (
              <div className="space-y-4">
                {/* Table Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">📊 From table:</label>
                  {tableSuggestions.length > 0 ? (
                    <select
                      value={dbFindSimpleState.tableName || ""}
                      onChange={(e) => {
                        updateDbFindSimpleState({ tableName: e.target.value });
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table...</option>
                      {tableSuggestions.map((table) => (
                        <option key={table.value} value={table.value}>
                          {table.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter table name..."
                      value={dbFindSimpleState.tableName || ""}
                      onChange={(e) => {
                        updateDbFindSimpleState({ tableName: e.target.value });
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Template Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    🎯 What data do you want to get?
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() =>
                        updateDbFindSimpleState({ template: "all" })
                      }
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        dbFindSimpleState.template === "all"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-300 hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        📋 Get all records
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Returns all records from the table (up to 100)
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        updateDbFindSimpleState({ template: "findById" })
                      }
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        dbFindSimpleState.template === "findById"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-300 hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        🔍 Find one record by ID
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Find a specific record using its ID or unique field
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        updateDbFindSimpleState({ template: "search" })
                      }
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        dbFindSimpleState.template === "search"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-300 hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        🔎 Search by field value
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Find records that match specific criteria
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        updateDbFindSimpleState({ template: "latest" })
                      }
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        dbFindSimpleState.template === "latest"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-300 hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        📅 Get latest records
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Get the most recent records sorted by date
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        updateDbFindSimpleState({
                          mode: "advanced",
                          template: "custom",
                        })
                      }
                      className="p-3 text-left rounded-lg border-2 border-dashed border-border hover:border-blue-300 hover:bg-muted transition-all"
                    >
                      <div className="font-medium text-sm">
                        ⚙️ Custom query (Advanced)
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Full control with advanced options
                      </div>
                    </button>
                  </div>
                </div>

                {/* Template-specific configuration */}
                {dbFindSimpleState.template === "findById" && (
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      🔍 Find record where:
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Field:</label>
                      <input
                        type="text"
                        placeholder="id"
                        value={dbFindSimpleState.idField || ""}
                        onChange={(e) =>
                          updateDbFindSimpleState({ idField: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Equals:</label>
                      <input
                        type="text"
                        placeholder="{{formData.recordId}}"
                        value={dbFindSimpleState.idValue || ""}
                        onChange={(e) =>
                          updateDbFindSimpleState({ idValue: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background font-mono"
                      />
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        💡 Tip: Use {`{{formData.fieldName}}`} to insert dynamic
                        values
                      </div>
                    </div>
                  </div>
                )}

                {/* Search template configuration */}
                {dbFindSimpleState.template === "search" && (
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-900 dark:text-green-100">
                      🔎 Find records where:
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm">Field:</label>
                        <input
                          type="text"
                          placeholder="status"
                          value={dbFindSimpleState.searchField || ""}
                          onChange={(e) =>
                            updateDbFindSimpleState({
                              searchField: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm">Condition:</label>
                        <select
                          value={dbFindSimpleState.searchOperator || "equals"}
                          onChange={(e) =>
                            updateDbFindSimpleState({
                              searchOperator: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="equals">equals</option>
                          <option value="not equals">not equals</option>
                          <option value="greater than">greater than</option>
                          <option value="less than">less than</option>
                          <option value="greater than or equal to">
                            greater than or equal to
                          </option>
                          <option value="less than or equal to">
                            less than or equal to
                          </option>
                          <option value="contains">contains</option>
                          <option value="does not contain">
                            does not contain
                          </option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Value:</label>
                      <input
                        type="text"
                        placeholder="active"
                        value={dbFindSimpleState.searchValue || ""}
                        onChange={(e) =>
                          updateDbFindSimpleState({
                            searchValue: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background font-mono"
                      />
                      <div className="text-xs text-green-700 dark:text-green-300">
                        💡 Tip: Use {`{{formData.fieldName}}`} to insert dynamic
                        values
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">How many results?</label>
                      <select
                        value={dbFindSimpleState.resultLimit || "first10"}
                        onChange={(e) =>
                          updateDbFindSimpleState({
                            resultLimit: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      >
                        <option value="first10">First 10 results</option>
                        <option value="first50">First 50 results</option>
                        <option value="all">All results (up to 1000)</option>
                        <option value="custom">Custom...</option>
                      </select>
                    </div>
                    {dbFindSimpleState.resultLimit === "custom" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-sm">Limit:</label>
                          <input
                            type="number"
                            placeholder="100"
                            value={dbFindSimpleState.customLimit || ""}
                            onChange={(e) =>
                              updateDbFindSimpleState({
                                customLimit: parseInt(e.target.value) || 100,
                              })
                            }
                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm">Skip (Offset):</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={dbFindSimpleState.customOffset || ""}
                            onChange={(e) =>
                              updateDbFindSimpleState({
                                customOffset: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Latest template configuration */}
                {dbFindSimpleState.template === "latest" && (
                  <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      📅 Get latest records:
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Sort by field:</label>
                      <input
                        type="text"
                        placeholder="createdAt"
                        value={dbFindSimpleState.sortField || ""}
                        onChange={(e) =>
                          updateDbFindSimpleState({ sortField: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Order:</label>
                      <select
                        value={dbFindSimpleState.sortDirection || "newest"}
                        onChange={(e) =>
                          updateDbFindSimpleState({
                            sortDirection: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      >
                        <option value="newest">Newest first (DESC)</option>
                        <option value="oldest">Oldest first (ASC)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">How many records?</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={dbFindSimpleState.latestLimit || ""}
                        onChange={(e) =>
                          updateDbFindSimpleState({
                            latestLimit: parseInt(e.target.value) || 10,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Mode UI - Original implementation */}
            {dbFindSimpleState.mode === "advanced" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Table Name:</label>
                  {tableSuggestions.length > 0 ? (
                    <select
                      value={data.tableName || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, tableName: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table...</option>
                      {tableSuggestions.map((table) => (
                        <option key={table.value} value={table.value}>
                          {table.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter table name..."
                      value={data.tableName || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, tableName: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Conditions (Optional):
                  </label>
                  <textarea
                    placeholder='[{"field": "status", "operator": "=", "value": "active"}]'
                    value={
                      typeof data.conditions === "string"
                        ? data.conditions
                        : JSON.stringify(data.conditions || [], null, 2)
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, conditions: value },
                              }
                            : node
                        )
                      );
                    }}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <div className="text-xs text-muted-foreground">
                    Array of condition objects with field, operator, value,
                    logic
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Limit:</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={data.limit || ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || undefined;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, limit: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Offset:</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={data.offset || ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || undefined;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, offset: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "db.update":
        // Helper function to update simple state and sync to backend
        const updateDbUpdateSimpleState = (
          updates: Partial<DbUpdateSimpleState>
        ) => {
          const newState = { ...dbUpdateSimpleState, ...updates };
          setDbUpdateSimpleState(newState);

          // Convert to backend format and update node data
          const backendConfig = convertDbUpdateSimpleToBackend(newState);
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id
                ? {
                    ...node,
                    data: { ...node.data, ...backendConfig },
                  }
                : node
            )
          );
        };

        return (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium">Configuration Mode:</div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateDbUpdateSimpleState({ mode: "simple" })}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dbUpdateSimpleState.mode === "simple"
                      ? "bg-blue-500 text-white"
                      : "bg-background border hover:bg-muted"
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() =>
                    updateDbUpdateSimpleState({ mode: "advanced" })
                  }
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dbUpdateSimpleState.mode === "advanced"
                      ? "bg-blue-500 text-white"
                      : "bg-background border hover:bg-muted"
                  }`}
                >
                  Advanced
                </button>
              </div>
            </div>

            {/* Simple Mode UI */}
            {dbUpdateSimpleState.mode === "simple" && (
              <div className="space-y-4">
                {/* Quick Start Hint */}
                {dbUpdateSimpleState.updateFields.length === 0 &&
                  dbUpdateSimpleState.whereConditions.length === 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 text-lg">
                          💡
                        </span>
                        <div className="flex-1 text-xs text-blue-800 dark:text-blue-200">
                          <p className="font-medium mb-1">Quick Start:</p>
                          <ol className="list-decimal list-inside space-y-0.5 ml-1">
                            <li>Select the table you want to update</li>
                            <li>
                              Add fields you want to change (e.g., status, name)
                            </li>
                            <li>
                              Add conditions to target specific records (e.g.,
                              id = 123)
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Table Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    📊 Update table:
                  </label>
                  {tableSuggestions.length > 0 ? (
                    <select
                      value={dbUpdateSimpleState.tableName || ""}
                      onChange={(e) =>
                        updateDbUpdateSimpleState({ tableName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table...</option>
                      {tableSuggestions.map((table) => (
                        <option key={table.value} value={table.value}>
                          {table.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter table name..."
                      value={dbUpdateSimpleState.tableName || ""}
                      onChange={(e) =>
                        updateDbUpdateSimpleState({ tableName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Update Fields Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    ✏️ Fields to update:
                  </label>

                  {dbUpdateSimpleState.updateFields.length === 0 && (
                    <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                      <p className="text-sm">No fields added yet</p>
                      <p className="text-xs mt-1">
                        Click "+ Add Field" below to start
                      </p>
                    </div>
                  )}

                  {dbUpdateSimpleState.updateFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Field {index + 1}
                        </span>
                        <button
                          onClick={() => {
                            const newFields =
                              dbUpdateSimpleState.updateFields.filter(
                                (f) => f.id !== field.id
                              );
                            updateDbUpdateSimpleState({
                              updateFields: newFields,
                            });
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs">Field name:</label>
                          <input
                            type="text"
                            placeholder={
                              index === 0 ? "e.g., status" : "e.g., updated_at"
                            }
                            value={field.field}
                            onChange={(e) => {
                              const newFields =
                                dbUpdateSimpleState.updateFields.map((f) =>
                                  f.id === field.id
                                    ? { ...f, field: e.target.value }
                                    : f
                                );
                              updateDbUpdateSimpleState({
                                updateFields: newFields,
                              });
                            }}
                            className="w-full px-2 py-1 text-sm border rounded-md bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs">New value:</label>
                          <input
                            type="text"
                            placeholder={
                              index === 0
                                ? "active or {{formData.status}}"
                                : "{{now}} or 2024-01-01"
                            }
                            value={field.value}
                            onChange={(e) => {
                              const newFields =
                                dbUpdateSimpleState.updateFields.map((f) =>
                                  f.id === field.id
                                    ? { ...f, value: e.target.value }
                                    : f
                                );
                              updateDbUpdateSimpleState({
                                updateFields: newFields,
                              });
                            }}
                            className="w-full px-2 py-1 text-sm border rounded-md bg-background font-mono"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        💡 Use {`{{variableName}}`} for dynamic values (e.g.,{" "}
                        {`{{formData.userName}}`}, {`{{dbFindResult[0].id}}`})
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newField = {
                        id: `field-${Date.now()}`,
                        field: "",
                        value: "",
                      };
                      updateDbUpdateSimpleState({
                        updateFields: [
                          ...dbUpdateSimpleState.updateFields,
                          newField,
                        ],
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-dashed rounded-md hover:bg-muted transition-colors"
                  >
                    + Add Field
                  </button>
                </div>

                {/* Where Conditions Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    🎯 Update records where:
                  </label>

                  {dbUpdateSimpleState.whereConditions.length === 0 && (
                    <div className="p-4 border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 text-lg">
                          ⚠️
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            No conditions added
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Without conditions, ALL records in the table will be
                            updated! Add at least one condition to target
                            specific records.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {dbUpdateSimpleState.whereConditions.map(
                    (condition, index) => (
                      <div
                        key={condition.id}
                        className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-green-900 dark:text-green-100">
                            Condition {index + 1}
                          </span>
                          <button
                            onClick={() => {
                              const newConditions =
                                dbUpdateSimpleState.whereConditions.filter(
                                  (c) => c.id !== condition.id
                                );
                              updateDbUpdateSimpleState({
                                whereConditions: newConditions,
                              });
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs">Field:</label>
                            <input
                              type="text"
                              placeholder={
                                index === 0 ? "e.g., id" : "e.g., status"
                              }
                              value={condition.field}
                              onChange={(e) => {
                                const newConditions =
                                  dbUpdateSimpleState.whereConditions.map((c) =>
                                    c.id === condition.id
                                      ? { ...c, field: e.target.value }
                                      : c
                                  );
                                updateDbUpdateSimpleState({
                                  whereConditions: newConditions,
                                });
                              }}
                              className="w-full px-2 py-1 text-sm border rounded-md bg-background"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs">Condition:</label>
                            <select
                              value={condition.operator}
                              onChange={(e) => {
                                const newConditions =
                                  dbUpdateSimpleState.whereConditions.map((c) =>
                                    c.id === condition.id
                                      ? { ...c, operator: e.target.value }
                                      : c
                                  );
                                updateDbUpdateSimpleState({
                                  whereConditions: newConditions,
                                });
                              }}
                              className="w-full px-2 py-1 text-sm border rounded-md bg-background"
                            >
                              <option value="equals">equals</option>
                              <option value="not equals">not equals</option>
                              <option value="greater than">greater than</option>
                              <option value="less than">less than</option>
                              <option value="greater than or equal to">
                                ≥
                              </option>
                              <option value="less than or equal to">≤</option>
                              <option value="contains">contains</option>
                              <option value="does not contain">
                                not contains
                              </option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs">Value:</label>
                            <input
                              type="text"
                              placeholder={
                                index === 0
                                  ? "123 or {{dbFindResult[0].id}}"
                                  : "active or {{formData.status}}"
                              }
                              value={condition.value}
                              onChange={(e) => {
                                const newConditions =
                                  dbUpdateSimpleState.whereConditions.map((c) =>
                                    c.id === condition.id
                                      ? { ...c, value: e.target.value }
                                      : c
                                  );
                                updateDbUpdateSimpleState({
                                  whereConditions: newConditions,
                                });
                              }}
                              className="w-full px-2 py-1 text-sm border rounded-md bg-background font-mono"
                            />
                          </div>
                        </div>
                        {index <
                          dbUpdateSimpleState.whereConditions.length - 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Then:
                            </span>
                            <select
                              value={condition.logic}
                              onChange={(e) => {
                                const newConditions =
                                  dbUpdateSimpleState.whereConditions.map((c) =>
                                    c.id === condition.id
                                      ? {
                                          ...c,
                                          logic: e.target.value as "AND" | "OR",
                                        }
                                      : c
                                  );
                                updateDbUpdateSimpleState({
                                  whereConditions: newConditions,
                                });
                              }}
                              className="px-2 py-1 text-xs border rounded-md bg-background"
                            >
                              <option value="AND">AND (all must match)</option>
                              <option value="OR">OR (any can match)</option>
                            </select>
                          </div>
                        )}
                        <div className="text-xs text-green-700 dark:text-green-300">
                          💡 Tip: Use {`{{variableName}}`} for dynamic values
                        </div>
                      </div>
                    )
                  )}

                  <button
                    onClick={() => {
                      const newCondition = {
                        id: `condition-${Date.now()}`,
                        field: "",
                        operator: "equals",
                        value: "",
                        logic: "AND" as "AND" | "OR",
                      };
                      updateDbUpdateSimpleState({
                        whereConditions: [
                          ...dbUpdateSimpleState.whereConditions,
                          newCondition,
                        ],
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-dashed rounded-md hover:bg-muted transition-colors"
                  >
                    + Add Condition
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Mode UI - Original JSON editor */}
            {dbUpdateSimpleState.mode === "advanced" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Table Name:</label>
                  {tableSuggestions.length > 0 ? (
                    <select
                      value={data.tableName || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, tableName: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table...</option>
                      {tableSuggestions.map((table) => (
                        <option key={table.value} value={table.value}>
                          {table.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter table name..."
                      value={data.tableName || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNodes((nodes) =>
                          nodes.map((node) =>
                            node.id === id
                              ? {
                                  ...node,
                                  data: { ...node.data, tableName: value },
                                }
                              : node
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Data:</label>
                  <textarea
                    placeholder='{"status": "inactive", "updated_at": "{{now}}"}'
                    value={
                      typeof data.updateData === "string"
                        ? data.updateData
                        : JSON.stringify(data.updateData || {}, null, 2)
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: value },
                              }
                            : node
                        )
                      );
                    }}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Where Conditions:
                  </label>
                  <textarea
                    placeholder='[{"field": "id", "operator": "=", "value": "{{context.userId}}"}]'
                    value={
                      typeof data.whereConditions === "string"
                        ? data.whereConditions
                        : JSON.stringify(data.whereConditions || [], null, 2)
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, whereConditions: value },
                              }
                            : node
                        )
                      );
                    }}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <div className="text-xs text-muted-foreground">
                    Array of condition objects with field, operator, value,
                    logic
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "match":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Left Value:</label>
              <input
                type="text"
                placeholder="{{context.userRole}}"
                value={data.leftValue || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, leftValue: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Operator:</label>
              <select
                value={data.operator || "equals"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, operator: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="equals">Equals</option>
                <option value="notEquals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="greaterThan">Greater Than</option>
                <option value="lessThan">Less Than</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Right Value:</label>
              <input
                type="text"
                placeholder="admin"
                value={data.rightValue || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, rightValue: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "roleIs":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Required Role:</label>
              <input
                type="text"
                placeholder="admin"
                value={data.requiredRole || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, requiredRole: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-muted-foreground">
                User must have this role to proceed
              </div>
            </div>
          </div>
        );

      case "expr":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression:</label>
              <textarea
                placeholder="{{context.price}} * 1.1"
                value={data.exprExpression || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, exprExpression: value },
                          }
                        : node
                    )
                  );
                }}
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <div className="text-xs text-muted-foreground">
                JavaScript expression to evaluate
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Output Variable (Optional):
              </label>
              <input
                type="text"
                placeholder="result"
                value={data.exprOutputVariable || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, exprOutputVariable: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "onLogin":
      case "auth.verify":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                This block triggers automatically on{" "}
                {data.label === "onLogin"
                  ? "user login"
                  : "authentication verification"}
                . No additional configuration required.
              </div>
            </div>
          </div>
        );

      case "onDrop":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Element ID:</label>
              <input
                type="text"
                placeholder="drop-zone"
                value={data.targetElementId || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, targetElementId: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Accepted File Types:
              </label>
              <input
                type="text"
                placeholder="image/*, .pdf, .doc"
                value={(data.acceptedTypes || []).join(", ")}
                onChange={(e) => {
                  const value = e.target.value;
                  const types = value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, acceptedTypes: types },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-muted-foreground">
                Comma-separated list of MIME types or extensions
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max File Size (MB):</label>
              <input
                type="number"
                placeholder="10"
                value={data.maxFileSize || ""}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || undefined;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, maxFileSize: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "onSubmit":
      case "isFilled":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Group:</label>
              <select
                value={data.selectedFormGroup || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, selectedFormGroup: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a form group...</option>
                {formGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case "dateValid":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Elements:</label>
              <div className="text-xs text-muted-foreground mb-2">
                Select date input elements to validate
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {formElements
                  .filter(
                    (el) => el.type === "date" || el.type === "datetime-local"
                  )
                  .map((element) => (
                    <label
                      key={element.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(data.selectedElementIds || []).includes(
                          element.id
                        )}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const currentIds = data.selectedElementIds || [];
                          const newIds = checked
                            ? [...currentIds, element.id]
                            : currentIds.filter((id) => id !== element.id);
                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      selectedElementIds: newIds,
                                    },
                                  }
                                : node
                            )
                          );
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {element.name || element.id}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        );

      case "ai.summarize":
        return (
          <div className="space-y-4">
            {/* File Upload Element Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                File Upload Element:
              </label>
              {(() => {
                const fileUploadElements = getFileUploadElements();

                if (fileUploadElements.length === 0) {
                  return (
                    <div className="w-full px-3 py-2 text-sm border rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
                      ⚠️ No FILE_UPLOAD elements found on canvas
                    </div>
                  );
                }

                return (
                  <select
                    value={data.fileVariable || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, fileVariable: value },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a file upload element...</option>
                    {fileUploadElements.map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.name} ({element.type}) - {element.pageName}
                      </option>
                    ))}
                  </select>
                );
              })()}
              <div className="text-xs text-muted-foreground">
                Select the FILE_UPLOAD element to get the file from
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gemini API Key:</label>
              <input
                type="password"
                placeholder="Enter your Gemini API key"
                value={data.apiKey || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, apiKey: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Google AI Studio
                </a>
              </div>
            </div>

            {/* Output Variable */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Output Variable:</label>
              <input
                type="text"
                placeholder="e.g., aiSummary"
                value={data.outputVariable || "aiSummary"}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, outputVariable: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-muted-foreground">
                Variable name to store the summary result
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
              <div className="text-sm text-pink-900 dark:text-pink-100">
                <div className="font-medium mb-2">📄 How It Works:</div>
                <ul className="space-y-1 text-xs">
                  <li>• Extracts text from uploaded PDF, DOCX, or TXT files</li>
                  <li>
                    • Sends text to Google Gemini 1.5 Pro for summarization
                  </li>
                  <li>• Returns concise summary in output variable</li>
                  <li>• Supports files up to 50MB</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 text-lg">
                  ⚙️
                </div>
                <div>
                  <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Configuration Panel
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    Configuration for <strong>{data.label}</strong> will be
                    added here.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={`relative min-w-[200px] max-w-[300px] p-3 ${
        colors.bg
      } border-2 ${
        colors.border
      } rounded-lg shadow-sm transition-all duration-200 ${
        selected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Node content */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${colors.icon} relative`}>
          {React.createElement(getBlockIcon(data.label), {
            className: "w-4 h-4 text-white",
          })}
          {/* Configuration Status Indicator */}
          {isBlockConfigured(data) ? (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <Check className="w-2 h-2 text-white" />
            </div>
          ) : (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-white flex items-center justify-center">
              <AlertCircle className="w-2 h-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${colors.text} truncate`}>
            {data.label}
          </div>
          {data.description && (
            <div className={`text-xs ${colors.text} opacity-70 truncate`}>
              {data.description}
            </div>
          )}
        </div>
        {/* Gear Button */}
        <button
          onClick={() => setIsConfigOpen(true)}
          className={`p-1.5 rounded hover:bg-white/10 transition-colors relative`}
          title={
            isBlockConfigured(data)
              ? "Configure (Configured)"
              : "Configure (Needs Configuration)"
          }
        >
          <Settings className={`w-4 h-4 ${colors.text}`} />
          {/* Badge on gear button */}
          {!isBlockConfigured(data) && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full border border-white"></div>
          )}
        </button>
      </div>

      {/* OnClick Configuration - Now in Modal */}
      {false && data.label === "onClick" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Target Page:</div>
            <select
              value={data.targetPageId || ""}
              onChange={(e) => {
                const value = e.target.value;
                console.log("📄 [ON-PAGE-LOAD] Target page selected:", value);
                console.log("📄 [ON-PAGE-LOAD] Available pages:", pages);
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, targetPageId: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">
                {pages.length === 0
                  ? "No pages found..."
                  : "Select target page..."}
              </option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name || `Page ${page.id}`}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              Pages available: {pages.length}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>• {`{{context.pageId}}`} - Current page ID</div>
              <div>• {`{{context.pageName}}`} - Current page name</div>
              <div>
                • {`{{context.loadData.timestamp}}`} - Page load timestamp
              </div>
              <div>
                • {`{{context.loadData.elementCount}}`} - Number of elements on
                page
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OnSchedule Configuration - Now in Modal */}
      {false && data.label === "onSchedule" && (
        <div className="mt-2 w-full space-y-3">
          {/* Schedule Type */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Schedule Type:</div>
            <select
              value={data.scheduleType || "interval"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, scheduleType: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron Expression</option>
            </select>
          </div>

          {/* Interval Configuration */}
          {(data.scheduleType || "interval") === "interval" && (
            <>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Interval Value:
                </div>
                <input
                  type="number"
                  placeholder="5"
                  value={data.scheduleValue || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                scheduleValue: parseInt(value) || 0,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Unit:</div>
                <select
                  value={data.scheduleUnit || "minutes"}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, scheduleUnit: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>
            </>
          )}

          {/* Cron Configuration */}
          {data.scheduleType === "cron" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Cron Expression:
              </div>
              <input
                type="text"
                placeholder="0 0 * * * (daily at midnight)"
                value={data.cronExpression || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, cronExpression: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-400">
                Format: minute hour day month weekday
              </div>
            </div>
          )}

          {/* Enabled Toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={data.enabled !== false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, enabled: e.target.checked },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              Enabled
            </label>
          </div>
        </div>
      )}

      {/* OnRecordCreate Configuration - Now in Modal */}
      {false && data.label === "onRecordCreate" && (
        <div className="mt-2 w-full space-y-3">
          {/* Table Name */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Table Name (Required):
            </div>
            <input
              type="text"
              placeholder="users"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Table to monitor for new records
            </div>
          </div>

          {/* Filter Conditions */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Filter Conditions (Optional):
            </div>
            <div className="text-xs text-gray-400">
              Trigger only when specific conditions are met
            </div>
            {(data.filterConditions || []).map((condition, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Column"
                  value={condition.column || ""}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].column = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={condition.operator || "equals"}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].operator = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  value={condition.value || ""}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    const newConditions = (data.filterConditions || []).filter(
                      (_, i) => i !== index
                    );
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newConditions = [
                  ...(data.filterConditions || []),
                  { column: "", operator: "equals", value: "" },
                ];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            filterConditions: newConditions,
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full px-2 py-1 text-xs bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30"
            >
              + Add Condition
            </button>
          </div>
        </div>
      )}

      {/* OnRecordUpdate Configuration - Now in Modal */}
      {false && data.label === "onRecordUpdate" && (
        <div className="mt-2 w-full space-y-3">
          {/* Table Name */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Table Name (Required):
            </div>
            <input
              type="text"
              placeholder="users"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Table to monitor for record updates
            </div>
          </div>

          {/* Watch Columns */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Watch Columns (Optional):
            </div>
            <div className="text-xs text-gray-400">
              Trigger only when these columns change
            </div>
            {(data.watchColumns || []).map((column, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Column name"
                  value={column || ""}
                  onChange={(e) => {
                    const newColumns = [...(data.watchColumns || [])];
                    newColumns[index] = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                watchColumns: newColumns,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    const newColumns = (data.watchColumns || []).filter(
                      (_, i) => i !== index
                    );
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                watchColumns: newColumns,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newColumns = [...(data.watchColumns || []), ""];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            watchColumns: newColumns,
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full px-2 py-1 text-xs bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30"
            >
              + Add Column
            </button>
          </div>

          {/* Filter Conditions */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Filter Conditions (Optional):
            </div>
            <div className="text-xs text-gray-400">
              Trigger only when specific conditions are met
            </div>
            {(data.filterConditions || []).map((condition, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Column"
                  value={condition.column || ""}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].column = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={condition.operator || "equals"}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].operator = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  value={condition.value || ""}
                  onChange={(e) => {
                    const newConditions = [...(data.filterConditions || [])];
                    newConditions[index].value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    const newConditions = (data.filterConditions || []).filter(
                      (_, i) => i !== index
                    );
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                filterConditions: newConditions,
                              },
                            }
                          : node
                      )
                    );
                  }}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newConditions = [
                  ...(data.filterConditions || []),
                  { column: "", operator: "equals", value: "" },
                ];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            filterConditions: newConditions,
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full px-2 py-1 text-xs bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30"
            >
              + Add Condition
            </button>
          </div>
        </div>
      )}

      {/* OnLogin Configuration - Now in Modal */}
      {false && data.label === "onLogin" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={data.captureUserData ?? true}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              captureUserData: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-4 h-4"
              />
              <span className="text-xs text-muted-foreground">
                Capture User Data
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={data.storeToken ?? true}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              storeToken: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-4 h-4"
              />
              <span className="text-xs text-muted-foreground">
                Store Authentication Token
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>• {`{{context.user.id}}`} - User ID</div>
              <div>• {`{{context.user.email}}`} - User email</div>
              <div>• {`{{context.user.role}}`} - User role</div>
              <div>• {`{{context.user.verified}}`} - Email verified status</div>
              <div>• {`{{context.token}}`} - Authentication token</div>
              <div>• {`{{context.loginTime}}`} - Login timestamp</div>
            </div>
          </div>
        </div>
      )}

      {/* OnDrop Configuration - Now in Modal */}
      {false && data.label === "onDrop" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Target Element:</div>
            {(() => {
              const dropZoneElements = getDropZoneElements();

              if (dropZoneElements.length === 0) {
                return (
                  <div className="w-full px-2 py-2 text-xs border rounded bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                    ⚠️ No drop zone elements found. Add a Shape, Container, or
                    Image element to your canvas first.
                  </div>
                );
              }

              return (
                <select
                  value={data.targetElementId || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: { ...node.data, targetElementId: value },
                            }
                          : node
                      )
                    );
                  }}
                  className="w-full h-7 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select drop zone element...</option>
                  {dropZoneElements.map((element) => (
                    <option key={element.id} value={element.id}>
                      {element.name} ({element.type}) - {element.pageName}
                    </option>
                  ))}
                </select>
              );
            })()}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Accepted File Types:
            </div>
            <input
              type="text"
              placeholder='["image/*", "application/pdf"]'
              value={
                data.acceptedTypes
                  ? JSON.stringify(data.acceptedTypes)
                  : '["image/*", "application/pdf"]'
              }
              onChange={(e) => {
                try {
                  const value = JSON.parse(e.target.value);
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, acceptedTypes: value },
                          }
                        : node
                    )
                  );
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Max File Size (bytes):
            </div>
            <input
              type="number"
              placeholder="5242880"
              value={data.maxFileSize || 5242880}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, maxFileSize: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500">
              {((data.maxFileSize || 5242880) / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={data.allowMultiple ?? false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              allowMultiple: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-4 h-4"
              />
              <span className="text-xs text-muted-foreground">
                Allow Multiple Files
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>
                • {`{{context.dropResult.files}}`} - Dropped files array
              </div>
              <div>
                • {`{{context.dropResult.successCount}}`} - Files uploaded
              </div>
              <div>• {`{{context.dropResult.position}}`} - Drop position</div>
              <div>• {`{{context.elementId}}`} - Drop zone element ID</div>
            </div>
          </div>
        </div>
      )}

      {/* DateValid Configuration - Now in Modal */}
      {false && data.label === "dateValid" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Date Elements:</div>
            {(() => {
              const dateElements = getDateElements();
              const selectedIds = data.selectedElementIds || [];

              if (dateElements.length === 0) {
                return (
                  <div className="w-full px-2 py-2 text-xs border rounded bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                    ⚠️ No date elements found. Add a Date Picker element to your
                    canvas first.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {/* Multi-select checkboxes */}
                  <div className="max-h-40 overflow-y-auto border rounded bg-background/50 p-2 space-y-1">
                    {dateElements.map((element) => {
                      const isSelected = selectedIds.includes(element.id);
                      return (
                        <label
                          key={element.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-blue-500/10 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSelectedIds = e.target.checked
                                ? [...selectedIds, element.id]
                                : selectedIds.filter((id) => id !== element.id);

                              setNodes((nodes) =>
                                nodes.map((node) =>
                                  node.id === id
                                    ? {
                                        ...node,
                                        data: {
                                          ...node.data,
                                          selectedElementIds: newSelectedIds,
                                        },
                                      }
                                    : node
                                )
                              );
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-xs">
                            {element.name} ({element.type}) - {element.pageName}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Selected count */}
                  <div className="text-xs text-muted-foreground">
                    {selectedIds.length} element
                    {selectedIds.length !== 1 ? "s" : ""} selected
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Date Format:</div>
            <select
              value={data.dateFormat || "YYYY-MM-DD"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, dateFormat: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Min Date:</div>
            <input
              type="date"
              value={data.validationRules?.minDate || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            validationRules: {
                              ...node.data.validationRules,
                              minDate: value,
                            },
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Max Date:</div>
            <input
              type="date"
              value={data.validationRules?.maxDate || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            validationRules: {
                              ...node.data.validationRules,
                              maxDate: value,
                            },
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>
                • {`{{context.isValid}}`} - Validation result (true/false)
              </div>
              <div>• {`{{context.errors}}`} - Array of validation errors</div>
              <div>• {`{{context.parsedDate}}`} - Parsed date value</div>
            </div>
          </div>
        </div>
      )}

      {/* OnSubmit Configuration - Now in Modal */}
      {false && data.label === "onSubmit" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Form Group:</div>
            <select
              value={data.selectedFormGroup || ""}
              onChange={(e) => {
                const value = e.target.value;
                console.log("🎯 [ON-SUBMIT] Form group selected:", value);
                console.log(
                  "🎯 [ON-SUBMIT] Available form groups:",
                  formGroups
                );
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, selectedFormGroup: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">
                {formGroups.length === 0
                  ? "No form groups found..."
                  : "Select form group..."}
              </option>
              {formGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.elementIds?.length || 0} fields)
                </option>
              ))}
            </select>
            <button
              onClick={refreshFormGroups}
              className="w-full h-6 px-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Refresh form groups from canvas"
            >
              🔄 Refresh Form Groups
            </button>
            <div className="text-xs text-gray-500">
              Form groups found: {formGroups.length}
            </div>
          </div>
        </div>
      )}

      {/* IsFilled Configuration - Now in Modal */}
      {false && data.label === "isFilled" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Form Group:</div>
            <select
              value={data.selectedFormGroup || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, selectedFormGroup: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select form group...</option>
              {formGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {data.selectedFormGroup && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Elements to Check:
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {(() => {
                  const selectedGroup = formGroups.find(
                    (g) => g.id === data.selectedFormGroup
                  );
                  const groupElements = selectedGroup
                    ? formElements.filter((el) =>
                        selectedGroup?.elementIds.includes(el.id)
                      )
                    : [];

                  return groupElements.map((element) => (
                    <label
                      key={element.id}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={(data.selectedElementIds || []).includes(
                          element.id
                        )}
                        onChange={(e) => {
                          const currentIds = data.selectedElementIds || [];
                          const newIds = e.target.checked
                            ? [...currentIds, element.id]
                            : currentIds.filter((id) => id !== element.id);

                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      selectedElementIds: newIds,
                                    },
                                  }
                                : node
                            )
                          );
                        }}
                        className="w-3 h-3"
                      />
                      <span
                        className="text-xs"
                        title={`${element.name} (${element.type})`}
                      >
                        {element.name}
                      </span>
                    </label>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DbCreate Configuration - Now in Modal */}
      {false && data.label === "db.create" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Table Name:</div>
            <input
              type="text"
              placeholder="form_data"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={50}
            />
            <div className="text-xs text-muted-foreground">
              Final table: app_{appId || "X"}_{data.tableName || "table_name"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Form Data Mapping:
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <div>• Automatically maps form fields to table columns</div>
              <div>• Creates table on first submission</div>
              <div>• Inserts data on subsequent submissions</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>
                • {`{{context.formData.fieldName}}`} - Form field values
              </div>
              <div>• {`{{context.recordId}}`} - Database record ID</div>
              <div>• {`{{context.userName}}`} - Current user name</div>
              <div>• {`{{context.timestamp}}`} - Current timestamp</div>
            </div>
          </div>
        </div>
      )}

      {/* DbFind Configuration - Now in Modal */}
      {false && data.label === "db.find" && (
        <div className="mt-2 w-full space-y-3">
          {/* Table Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Table Name:</div>
            <input
              type="text"
              placeholder="app_1_form_data"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={100}
            />
          </div>

          {/* WHERE Conditions */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              WHERE Conditions:
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {(data.conditions || []).map((condition, index) => (
                <div key={index} className="flex gap-1 items-center">
                  <input
                    type="text"
                    placeholder="field"
                    value={condition.field || ""}
                    onChange={(e) => {
                      const newConditions = [...(data.conditions || [])];
                      newConditions[index] = {
                        ...condition,
                        field: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  conditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-6 px-1 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={condition.operator || "="}
                    onChange={(e) => {
                      const newConditions = [...(data.conditions || [])];
                      newConditions[index] = {
                        ...condition,
                        operator: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  conditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="h-6 px-1 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="LIKE">LIKE</option>
                    <option value="IN">IN</option>
                  </select>
                  <input
                    type="text"
                    placeholder="value or context.field"
                    value={condition.value || ""}
                    onChange={(e) => {
                      const newConditions = [...(data.conditions || [])];
                      newConditions[index] = {
                        ...condition,
                        value: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  conditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-6 px-1 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const newConditions = (data.conditions || []).filter(
                        (_, i) => i !== index
                      );
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  conditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="h-6 w-6 text-xs text-red-400 hover:text-red-300 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const newConditions = [
                  ...(data.conditions || []),
                  { field: "", operator: "=", value: "", logic: "AND" },
                ];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, conditions: newConditions },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Condition
            </button>
          </div>

          {/* Pagination */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <div className="text-xs text-muted-foreground">Limit:</div>
              <input
                type="number"
                placeholder="100"
                value={data.limit || ""}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || undefined;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, limit: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="1"
                max="1000"
              />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-xs text-muted-foreground">Offset:</div>
              <input
                type="number"
                placeholder="0"
                value={data.offset || ""}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || undefined;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, offset: value },
                          }
                        : node
                    )
                  );
                }}
                className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
        </div>
      )}

      {/* DbUpdate Configuration - Now in Modal */}
      {false && data.label === "db.update" && (
        <div className="mt-2 w-full space-y-3">
          {/* Table Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Table Name:</div>
            <input
              type="text"
              placeholder="app_1_form_data"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={100}
            />
          </div>

          {/* Update Data Mapping */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Update Fields:</div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {(data.updateData
                ? Object.entries(data.updateData || {})
                : []
              ).map(([column, value], index) => (
                <div key={index} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="column"
                    value={column || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.updateData || {};
                      const newData = { ...currentData };

                      // Remove old key and add new key
                      delete newData[column];
                      if (newValue) {
                        newData[newValue] = value;
                      }

                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <input
                    type="text"
                    placeholder="{{context.value}}"
                    value={value || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.updateData || {};
                      const newData = { ...currentData, [column]: newValue };

                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <button
                    onClick={() => {
                      const currentData = data.updateData || {};
                      const newData = { ...currentData };
                      delete newData[column];

                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-xs text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const currentData = data.updateData || {};
                const newData = { ...currentData, "": "" };

                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, updateData: newData },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Field
            </button>
          </div>

          {/* WHERE Conditions */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              WHERE Conditions (Required):
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {(data.whereConditions || []).map((condition, index) => (
                <div key={index} className="flex gap-1 text-xs">
                  <input
                    type="text"
                    placeholder="field"
                    value={condition.field || ""}
                    onChange={(e) => {
                      const newConditions = [...(data.whereConditions || [])];
                      newConditions[index] = {
                        ...condition,
                        field: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  whereConditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 border rounded bg-background/50"
                  />
                  <select
                    value={condition.operator || "="}
                    onChange={(e) => {
                      const newConditions = [...(data.whereConditions || [])];
                      newConditions[index] = {
                        ...condition,
                        operator: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  whereConditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-12 h-5 px-1 border rounded bg-background/50"
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="LIKE">LIKE</option>
                  </select>
                  <input
                    type="text"
                    placeholder="value"
                    value={condition.value || ""}
                    onChange={(e) => {
                      const newConditions = [...(data.whereConditions || [])];
                      newConditions[index] = {
                        ...condition,
                        value: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  whereConditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 border rounded bg-background/50"
                  />
                  <button
                    onClick={() => {
                      const newConditions = (data.whereConditions || []).filter(
                        (_, i) => i !== index
                      );
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  whereConditions: newConditions,
                                },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const newCondition = {
                  field: "",
                  operator: "=",
                  value: "",
                  logic: "AND",
                };
                const newConditions = [
                  ...(data.whereConditions || []),
                  newCondition,
                ];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            whereConditions: newConditions,
                          },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Condition
            </button>
          </div>
        </div>
      )}

      {/* DbUpsert Configuration - Now in Modal */}
      {false && data.label === "db.upsert" && (
        <div className="mt-2 w-full space-y-3">
          {/* Table Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Table Name:</div>
            <input
              type="text"
              placeholder="app_1_users"
              value={data.tableName || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tableName: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={100}
            />
          </div>

          {/* Unique Fields */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Unique Fields (for matching):
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {(data.uniqueFields || []).map((field, index) => (
                <div key={index} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="email"
                    value={field || ""}
                    onChange={(e) => {
                      const newFields = [...(data.uniqueFields || [])];
                      newFields[index] = e.target.value;
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, uniqueFields: newFields },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <button
                    onClick={() => {
                      const newFields = (data.uniqueFields || []).filter(
                        (_, i) => i !== index
                      );
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, uniqueFields: newFields },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-xs text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const newFields = [...(data.uniqueFields || []), ""];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, uniqueFields: newFields },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Field
            </button>
          </div>

          {/* Update Data Mapping */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Update Fields (if exists):
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {(data.updateData
                ? Object.entries(data.updateData || {})
                : []
              ).map(([column, value], index) => (
                <div key={index} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="column"
                    value={column || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.updateData || {};
                      const newData = { ...currentData };
                      delete newData[column];
                      if (newValue) {
                        newData[newValue] = value;
                      }
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <input
                    type="text"
                    placeholder="{{context.value}}"
                    value={value || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.updateData || {};
                      const newData = { ...currentData, [column]: newValue };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <button
                    onClick={() => {
                      const currentData = data.updateData || {};
                      const newData = { ...currentData };
                      delete newData[column];
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, updateData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-xs text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const currentData = data.updateData || {};
                const newData = { ...currentData, "": "" };
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, updateData: newData },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Field
            </button>
          </div>

          {/* Insert Data Mapping */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Insert Fields (if new):
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {(data.insertData
                ? Object.entries(data.insertData || {})
                : []
              ).map(([column, value], index) => (
                <div key={index} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="column"
                    value={column || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.insertData || {};
                      const newData = { ...currentData };
                      delete newData[column];
                      if (newValue) {
                        newData[newValue] = value;
                      }
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, insertData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <input
                    type="text"
                    placeholder="{{context.value}}"
                    value={value || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const currentData = data.insertData || {};
                      const newData = { ...currentData, [column]: newValue };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, insertData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-5 px-1 text-xs border rounded bg-background/50"
                  />
                  <button
                    onClick={() => {
                      const currentData = data.insertData || {};
                      const newData = { ...currentData };
                      delete newData[column];
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, insertData: newData },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-xs text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const currentData = data.insertData || {};
                const newData = { ...currentData, "": "" };
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, insertData: newData },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Field
            </button>
          </div>
        </div>
      )}

      {/* EmailSend Configuration - Now in Modal */}
      {false && data.label === "email.send" && (
        <div className="mt-2 w-full space-y-3">
          {/* Recipient Email */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Recipient Email (Required):
            </div>
            <input
              type="text"
              placeholder="{{context.user.email}}"
              value={data.emailTo || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, emailTo: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Use {`{{context.variable}}`} for dynamic values
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Subject (Required):
            </div>
            <input
              type="text"
              placeholder="Welcome {{context.user.name}}!"
              value={data.emailSubject || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, emailSubject: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Email Body (Required):
            </div>
            <textarea
              placeholder="<h1>Welcome!</h1><p>Thank you for joining {{context.appName}}</p>"
              value={data.emailBody || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, emailBody: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-20 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="text-xs text-gray-400">
              Supports HTML. Use {`{{context.variable}}`} for dynamic content
            </div>
          </div>

          {/* Body Type */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Body Type:</div>
            <select
              value={data.emailBodyType || "html"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, emailBodyType: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="html">HTML</option>
              <option value="text">Plain Text</option>
            </select>
          </div>
        </div>
      )}

      {/* Switch Configuration - Now in Modal */}
      {false && data.label === "switch" && (
        <div className="mt-2 w-full space-y-3">
          {/* Input Value */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Input Value (Required):
            </div>
            <input
              type="text"
              placeholder="{{context.userRole}}"
              value={data.switchInputValue || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, switchInputValue: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Use {`{{context.variable}}`} for dynamic values
            </div>
          </div>

          {/* Cases */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Cases:</div>
            {Array.isArray(data.switchCases) &&
              data.switchCases?.map((caseItem, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Case value"
                    value={caseItem.caseValue || ""}
                    onChange={(e) => {
                      const newCases = [...(data.switchCases || [])];
                      newCases[index] = {
                        ...caseItem,
                        caseValue: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, switchCases: newCases },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={caseItem.caseLabel || ""}
                    onChange={(e) => {
                      const newCases = [...(data.switchCases || [])];
                      newCases[index] = {
                        ...caseItem,
                        caseLabel: e.target.value,
                      };
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, switchCases: newCases },
                              }
                            : node
                        )
                      );
                    }}
                    className="flex-1 h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const newCases = (data.switchCases || []).filter(
                        (_, i) => i !== index
                      );
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id
                            ? {
                                ...node,
                                data: { ...node.data, switchCases: newCases },
                              }
                            : node
                        )
                      );
                    }}
                    className="w-5 h-5 text-xs text-red-400 hover:text-red-300 border border-dashed border-red-400/30 rounded"
                  >
                    ✕
                  </button>
                </div>
              ))}
            <button
              onClick={() => {
                const newCases = [
                  ...(data.switchCases || []),
                  { caseValue: "", caseLabel: "" },
                ];
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, switchCases: newCases },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-400/30 rounded"
            >
              + Add Case
            </button>
          </div>

          {/* Default Case */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={data.switchDefaultCase || false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              switchDefaultCase: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              Use Default Case
            </label>
          </div>
        </div>
      )}

      {/* Expr Configuration - Now in Modal */}
      {false && data.label === "expr" && (
        <div className="mt-2 w-full space-y-3">
          {/* Expression Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Expression (Required):
            </div>
            <textarea
              placeholder="context.user.age > 18 && context.user.verified === true"
              value={data.exprExpression || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, exprExpression: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-20 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
            />
            <div className="text-xs text-gray-400">
              JavaScript expression. Use context.variable for dynamic values.
              Returns true/false for yes/no routing.
            </div>
          </div>

          {/* Output Variable */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Output Variable (Optional):
            </div>
            <input
              type="text"
              placeholder="exprResult"
              value={data.exprOutputVariable || "exprResult"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, exprOutputVariable: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Variable name to store the result in context
            </div>
          </div>
        </div>
      )}

      {/* OpenModal Configuration - Now in Modal */}
      {false && data.label === "ui.openModal" && (
        <div className="mt-2 w-full space-y-3">
          {/* Modal ID */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Modal ID (Required):
            </div>
            <input
              type="text"
              placeholder="confirmModal"
              value={data.modalId || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, modalId: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Unique identifier for the modal
            </div>
          </div>

          {/* Modal Title */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Modal Title (Optional):
            </div>
            <input
              type="text"
              placeholder="Confirm Action"
              value={data.modalTitle || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, modalTitle: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Modal Content */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Modal Content (Optional):
            </div>
            <textarea
              placeholder="Are you sure you want to proceed?"
              value={data.modalContent || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, modalContent: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-16 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Modal Size */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Modal Size:</div>
            <select
              value={data.modalSize || "medium"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, modalSize: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
          </div>

          {/* Show Close Button */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={data.showCloseButton !== false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              showCloseButton: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              Show Close Button
            </label>
          </div>

          {/* Show Backdrop */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={data.showBackdrop !== false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              showBackdrop: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              Show Backdrop
            </label>
          </div>

          {/* Close on Backdrop Click */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={data.closeOnBackdropClick !== false}
                onChange={(e) => {
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              closeOnBackdropClick: e.target.checked,
                            },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              Close on Backdrop Click
            </label>
          </div>
        </div>
      )}

      {/* NotifyToast Configuration - Now in Modal */}
      {false && data.label === "notify.toast" && (
        <div className="mt-2 w-full space-y-3">
          {/* Message Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Message (Required):
            </div>
            <textarea
              placeholder="{{context.formData.name}} has been saved successfully!"
              value={data.message || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, message: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-16 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              maxLength={500}
            />
            <div className="text-xs text-gray-400">
              Use {`{{context.variable}}`} for dynamic content
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Title (Optional):
            </div>
            <input
              type="text"
              placeholder="Success"
              value={data.title || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, title: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={100}
            />
          </div>

          {/* Variant Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Type:</div>
            <select
              value={data.variant || "default"}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, variant: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="default">Default (Info)</option>
              <option value="success">Success (Green)</option>
              <option value="destructive">Error (Red)</option>
            </select>
          </div>

          {/* Duration Setting */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Duration (ms):</div>
            <select
              value={data.duration || 5000}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, duration: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={2000}>2 seconds</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds (default)</option>
              <option value={7000}>7 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={15000}>15 seconds</option>
            </select>
          </div>

          {/* Context Variables Help */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>
                • {`{{context.formData.fieldName}}`} - Form field values
              </div>
              <div>• {`{{context.recordId}}`} - Database record ID</div>
              <div>• {`{{context.userName}}`} - Current user name</div>
              <div>• {`{{context.timestamp}}`} - Current timestamp</div>
            </div>
          </div>
        </div>
      )}

      {/* auth.verify Configuration - Now in Modal */}
      {false && data.label === "auth.verify" && (
        <div className="mt-2 w-full space-y-3">
          {/* Token Source Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Token Source:</div>
            <select
              value={data.tokenSource || "context"}
              onChange={(e) => {
                const value = e.target.value as "context" | "header" | "config";
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, tokenSource: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="context">From Context (Workflow)</option>
              <option value="header">From Authorization Header</option>
              <option value="config">From Configuration</option>
            </select>
            <div className="text-xs text-gray-400">
              Where to get the authentication token
            </div>
          </div>

          {/* Require Verified Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="require-verified"
              checked={data.requireVerified !== false}
              onChange={(e) => {
                const value = e.target.checked;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, requireVerified: value },
                        }
                      : node
                  )
                );
              }}
              className="rounded border-gray-300"
            />
            <label
              htmlFor="require-verified"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Require Verified User
            </label>
          </div>

          {/* Required Role Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Required Role (Optional):
            </div>
            <input
              type="text"
              placeholder="developer, admin, user, etc."
              value={data.requiredRole || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, requiredRole: value },
                        }
                      : node
                  )
                );
              }}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={50}
            />
            <div className="text-xs text-gray-400">
              Leave empty to allow any role
            </div>
          </div>

          {/* Validate Expiration Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="validate-expiration"
              checked={data.validateExpiration !== false}
              onChange={(e) => {
                const value = e.target.checked;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, validateExpiration: value },
                        }
                      : node
                  )
                );
              }}
              className="rounded border-gray-300"
            />
            <label
              htmlFor="validate-expiration"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Validate Token Expiration
            </label>
          </div>

          {/* Check Blacklist Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="check-blacklist"
              checked={data.checkBlacklist !== false}
              onChange={(e) => {
                const value = e.target.checked;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? {
                          ...node,
                          data: { ...node.data, checkBlacklist: value },
                        }
                      : node
                  )
                );
              }}
              className="rounded border-gray-300"
            />
            <label
              htmlFor="check-blacklist"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Check Token Blacklist
            </label>
          </div>

          {/* Configuration Help */}
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs">
            <div className="font-medium text-purple-700 dark:text-purple-300 mb-1">
              Authentication Configuration:
            </div>
            <div className="text-purple-600 dark:text-purple-400 space-y-1">
              <div>• Token Source: Where to find the JWT token</div>
              <div>• Require Verified: User must have verified email</div>
              <div>• Required Role: Specific role needed (RBAC)</div>
              <div>• Validate Expiration: Check if token is expired</div>
              <div>• Check Blacklist: Verify token not revoked</div>
            </div>
          </div>
        </div>
      )}

      {/* http.request Configuration - Now in Modal */}
      {false && data.label === "http.request" && (
        <div className="mt-2 w-full space-y-3">
          <div className="text-sm font-medium text-gray-700">
            HTTP Request Configuration
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              URL *
            </label>
            <input
              type="text"
              placeholder="https://api.example.com/endpoint"
              value={data.url || ""}
              onChange={(e) => updateNodeData("url", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Method Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Method *
            </label>
            <select
              value={data.method || "GET"}
              onChange={(e) => updateNodeData("method", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          {/* Headers */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Headers
            </label>
            {(data.headers || []).map((header: any, index: number) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Header Name"
                  value={header.key || ""}
                  onChange={(e) => {
                    const newHeaders = [...(data.headers || [])];
                    newHeaders[index] = {
                      ...newHeaders[index],
                      key: e.target.value,
                    };
                    updateNodeData("headers", newHeaders);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="Header Value"
                  value={header.value || ""}
                  onChange={(e) => {
                    const newHeaders = [...(data.headers || [])];
                    newHeaders[index] = {
                      ...newHeaders[index],
                      value: e.target.value,
                    };
                    updateNodeData("headers", newHeaders);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={() => {
                    const newHeaders = (data.headers || []).filter(
                      (_: any, i: number) => i !== index
                    );
                    updateNodeData("headers", newHeaders);
                  }}
                  className="px-3 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newHeaders = [
                  ...(data.headers || []),
                  { key: "", value: "" },
                ];
                updateNodeData("headers", newHeaders);
              }}
              className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
            >
              + Add Header
            </button>
          </div>

          {/* Authentication Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Authentication
            </label>
            <select
              value={data.authType || "none"}
              onChange={(e) => updateNodeData("authType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="none">No Authentication</option>
              <option value="bearer">Bearer Token</option>
              <option value="api-key">API Key</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>

          {/* Bearer Token */}
          {data.authType === "bearer" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bearer Token *
              </label>
              <input
                type="password"
                placeholder="Enter Bearer Token"
                value={data.authConfig?.token || ""}
                onChange={(e) =>
                  updateNodeData("authConfig", {
                    ...data.authConfig,
                    token: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          )}

          {/* API Key */}
          {data.authType === "api-key" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  API Key *
                </label>
                <input
                  type="password"
                  placeholder="Enter API Key"
                  value={data.authConfig?.apiKey || ""}
                  onChange={(e) =>
                    updateNodeData("authConfig", {
                      ...data.authConfig,
                      apiKey: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  API Key Header Name
                </label>
                <input
                  type="text"
                  placeholder="X-API-Key"
                  value={data.authConfig?.apiKeyHeader || "X-API-Key"}
                  onChange={(e) =>
                    updateNodeData("authConfig", {
                      ...data.authConfig,
                      apiKeyHeader: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </>
          )}

          {/* Basic Auth */}
          {data.authType === "basic" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  placeholder="Enter Username"
                  value={data.authConfig?.username || ""}
                  onChange={(e) =>
                    updateNodeData("authConfig", {
                      ...data.authConfig,
                      username: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={data.authConfig?.password || ""}
                  onChange={(e) =>
                    updateNodeData("authConfig", {
                      ...data.authConfig,
                      password: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </>
          )}

          {/* Request Body (for POST/PUT/PATCH) */}
          {["POST", "PUT", "PATCH"].includes(data.method || "") && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Body Type
                </label>
                <select
                  value={data.bodyType || "none"}
                  onChange={(e) => updateNodeData("bodyType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="none">No Body</option>
                  <option value="json">JSON</option>
                  <option value="raw">Raw Text</option>
                </select>
              </div>

              {data.bodyType !== "none" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Request Body
                  </label>
                  <textarea
                    placeholder={
                      data.bodyType === "json"
                        ? '{"key": "value"}'
                        : "Enter raw text"
                    }
                    value={data.body || ""}
                    onChange={(e) => updateNodeData("body", e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  />
                </div>
              )}
            </>
          )}

          {/* Timeout */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              placeholder="30000"
              value={data.timeout || 30000}
              onChange={(e) =>
                updateNodeData("timeout", parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Save Response To */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Save Response To (Context Variable)
            </label>
            <input
              type="text"
              placeholder="httpResponse"
              value={data.saveResponseTo || "httpResponse"}
              onChange={(e) => updateNodeData("saveResponseTo", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Help Text */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>• {`{{context.httpResponse.data}}`} - Response data</div>
              <div>
                • {`{{context.httpResponse.statusCode}}`} - HTTP status code
              </div>
              <div>
                • {`{{context.httpResponse.headers}}`} - Response headers
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Configuration - Now in Modal */}
      {false && data.label === "match" && (
        <div className="mt-2 w-full space-y-3">
          {/* Left Value Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Compare This:</div>
            <input
              type="text"
              placeholder="{{context.formData.status}}"
              value={data.leftValue || ""}
              onChange={(e) => updateNodeData("leftValue", e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Use {`{{context.variable}}`} for dynamic values
            </div>
          </div>

          {/* Comparison Type Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Comparison Type:
            </div>
            <select
              value={data.comparisonType || "text"}
              onChange={(e) => {
                updateNodeData("comparisonType", e.target.value);
                // Reset operator when type changes
                updateNodeData("operator", getDefaultOperator(e.target.value));
              }}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50"
            >
              <option value="text">Text Comparison</option>
              <option value="number">Number Comparison</option>
              <option value="date">Date Comparison</option>
              <option value="list">List/Array Comparison</option>
            </select>
          </div>

          {/* Operator Selection */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Operator:</div>
            <select
              value={
                data.operator ||
                getDefaultOperator(data.comparisonType || "text")
              }
              onChange={(e) => updateNodeData("operator", e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50"
            >
              {getOperatorOptions(data.comparisonType || "text").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Right Value Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">With This:</div>
            <input
              type="text"
              placeholder={getRightValuePlaceholder(
                data.comparisonType || "text",
                data.operator || "equals"
              )}
              value={data.rightValue || ""}
              onChange={(e) => updateNodeData("rightValue", e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              {getRightValueHint(
                data.comparisonType || "text",
                data.operator || "equals"
              )}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Options:</div>
            <div className="space-y-1">
              <label className="flex items-center space-x-2 text-xs">
                <input
                  type="checkbox"
                  checked={data.options?.ignoreCase || false}
                  onChange={(e) =>
                    updateNodeData("options", {
                      ...data.options,
                      ignoreCase: e.target.checked,
                    })
                  }
                  className="w-3 h-3"
                />
                <span>Ignore case (treat "Active" same as "active")</span>
              </label>
              <label className="flex items-center space-x-2 text-xs">
                <input
                  type="checkbox"
                  checked={data.options?.trimSpaces || false}
                  onChange={(e) =>
                    updateNodeData("options", {
                      ...data.options,
                      trimSpaces: e.target.checked,
                    })
                  }
                  className="w-3 h-3"
                />
                <span>Trim spaces (ignore extra spaces)</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preview:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              "{data.leftValue || "value1"}"{" "}
              {getOperatorLabel(data.operator || "equals")} "
              {data.rightValue || "value2"}"
              {data.options?.ignoreCase && " (case insensitive)"}
              {data.options?.trimSpaces && " (trimmed)"}
            </div>
          </div>

          {/* Context Variables Help */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
              Available Context Variables:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>
                • {`{{context.formData.fieldName}}`} - Form field values
              </div>
              <div>• {`{{context.recordId}}`} - Database record ID</div>
              <div>• {`{{context.userName}}`} - Current user name</div>
              <div>• {`{{context.timestamp}}`} - Current timestamp</div>
            </div>
          </div>
        </div>
      )}

      {/* roleIs Configuration - Now in Modal */}
      {false && data.label === "roleIs" && (
        <div className="mt-2 w-full space-y-3">
          <div className="text-sm font-medium text-gray-700">
            Role Check Configuration
          </div>

          {/* Check Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Check Mode
            </label>
            <select
              value={data.checkMultiple ? "multiple" : "single"}
              onChange={(e) =>
                updateNodeData("checkMultiple", e.target.value === "multiple")
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="single">Single Role</option>
              <option value="multiple">Multiple Roles (Any Match)</option>
            </select>
          </div>

          {/* Single Role Mode */}
          {!data.checkMultiple && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Required Role *
              </label>
              <input
                type="text"
                placeholder="e.g., admin, manager, user"
                value={data.requiredRole || ""}
                onChange={(e) => updateNodeData("requiredRole", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                User must have exactly this role
              </div>
            </div>
          )}

          {/* Multiple Roles Mode */}
          {data.checkMultiple && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Allowed Roles
              </label>
              {(data.roles || []).map((role: string, index: number) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g., admin"
                    value={role}
                    onChange={(e) => {
                      const newRoles = [...(data.roles || [])];
                      newRoles[index] = e.target.value;
                      updateNodeData("roles", newRoles);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const newRoles = (data.roles || []).filter(
                        (_: string, i: number) => i !== index
                      );
                      updateNodeData("roles", newRoles);
                    }}
                    className="px-3 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newRoles = [...(data.roles || []), ""];
                  updateNodeData("roles", newRoles);
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
              >
                + Add Role
              </button>
              <div className="text-xs text-gray-500 mt-2">
                User must have at least one of these roles
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
              How It Works:
            </div>
            <div className="text-blue-600 dark:text-blue-400 space-y-1">
              <div>• User role is retrieved from context or database</div>
              <div>• If user has required role(s), follows "yes" path</div>
              <div>• Otherwise, follows "no" path</div>
              <div>• Common roles: admin, manager, user, guest</div>
            </div>
          </div>

          {/* Example */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Example:
            </div>
            <div className="text-gray-600 dark:text-gray-400 space-y-1">
              <div>Single mode: Check if user role = "admin"</div>
              <div>
                Multiple mode: Check if user role in ["admin", "manager"]
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page.Redirect Configuration - Now in Modal */}
      {false && data.label === "page.redirect" && (
        <div className="mt-2 w-full space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Target Page:</div>
            <select
              value={data.targetPageId || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? { ...node, data: { ...node.data, targetPageId: value } }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select target page...</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name || `Page ${page.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* URL Option */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Or External URL:
            </div>
            <input
              type="text"
              placeholder="https://example.com"
              value={data.url || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id
                      ? { ...node, data: { ...node.data, url: value } }
                      : node
                  )
                );
              }}
              className="w-full h-6 px-2 text-xs border rounded bg-background/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-xs">
              <input
                type="checkbox"
                checked={data.openInNewTab || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: { ...node.data, openInNewTab: checked },
                          }
                        : node
                    )
                  );
                }}
                className="w-3 h-3"
              />
              <span>Open in new tab</span>
            </label>
          </div>

          {/* Preview */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preview:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {data.targetPageId
                ? `Navigate to: ${
                    pages.find((p) => p.id === data.targetPageId)?.name ||
                    data.targetPageId
                  }`
                : data.url
                ? `Navigate to: ${data.url}`
                : "No target selected"}
              {data.openInNewTab && " (new tab)"}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className={`p-2 rounded-lg ${colors.icon}`}>
                {React.createElement(getBlockIcon(data.label), {
                  className: "w-5 h-5 text-white",
                })}
              </div>
              Configure {data.label}
            </DialogTitle>
            <DialogDescription>
              {data.description ||
                `Configure settings for this ${data.category.toLowerCase()} block`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 px-1">
            {renderConfigurationContent()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Close
            </Button>
            <Button onClick={() => setIsConfigOpen(false)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ports */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-500 !rounded-full"
        style={{ left: "-6px", top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        className="!w-3 !h-3 !border-2 !border-white !bg-indigo-500 !rounded-full"
        style={{ right: "-6px", top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="onError"
        className="!w-3 !h-3 !border-2 !border-white !bg-red-500 !rounded-full"
        style={{ bottom: "-6px", left: "50%", transform: "translateX(-50%)" }}
      />
    </div>
  );
};

// Helper functions for match configuration
const getDefaultOperator = (comparisonType: string): string => {
  switch (comparisonType) {
    case "text":
      return "equals";
    case "number":
      return "equals";
    case "date":
      return "equals";
    case "list":
      return "includes";
    default:
      return "equals";
  }
};

const getOperatorOptions = (comparisonType: string) => {
  switch (comparisonType) {
    case "text":
      return [
        { value: "equals", label: "equals exactly" },
        { value: "not_equals", label: "does not equal" },
        { value: "contains", label: "contains" },
        { value: "not_contains", label: "does not contain" },
        { value: "starts_with", label: "starts with" },
        { value: "ends_with", label: "ends with" },
        { value: "is_empty", label: "is empty" },
        { value: "is_not_empty", label: "is not empty" },
        { value: "matches_pattern", label: "matches pattern (regex)" },
      ];
    case "number":
      return [
        { value: "equals", label: "equals" },
        { value: "not_equals", label: "does not equal" },
        { value: "greater_than", label: "is greater than" },
        { value: "less_than", label: "is less than" },
        { value: "at_least", label: "is at least" },
        { value: "at_most", label: "is at most" },
        { value: "between", label: "is between" },
        { value: "is_number", label: "is a number" },
        { value: "is_not_number", label: "is not a number" },
      ];
    case "date":
      return [
        { value: "equals", label: "is exactly" },
        { value: "not_equals", label: "is not" },
        { value: "is_after", label: "is after" },
        { value: "is_before", label: "is before" },
        { value: "is_today", label: "is today" },
        { value: "is_this_week", label: "is this week" },
        { value: "is_this_month", label: "is this month" },
        { value: "is_within_last_days", label: "is within last X days" },
        { value: "is_within_next_days", label: "is within next X days" },
      ];
    case "list":
      return [
        { value: "includes", label: "includes" },
        { value: "not_includes", label: "does not include" },
        { value: "includes_any_of", label: "includes any of" },
        { value: "includes_all_of", label: "includes all of" },
        { value: "includes_none_of", label: "includes none of" },
        { value: "has_length", label: "has length" },
        { value: "has_length_greater_than", label: "has length greater than" },
        { value: "has_length_less_than", label: "has length less than" },
        { value: "is_empty", label: "is empty" },
        { value: "is_not_empty", label: "is not empty" },
      ];
    default:
      return [{ value: "equals", label: "equals" }];
  }
};

const getRightValuePlaceholder = (
  comparisonType: string,
  operator: string
): string => {
  switch (comparisonType) {
    case "text":
      if (operator === "matches_pattern") return "^[A-Z]+$";
      if (operator === "is_empty" || operator === "is_not_empty")
        return "(no value needed)";
      return "active";
    case "number":
      if (operator === "between") return "10,20";
      if (operator === "is_number" || operator === "is_not_number")
        return "(no value needed)";
      return "18";
    case "date":
      if (
        operator === "is_today" ||
        operator === "is_this_week" ||
        operator === "is_this_month"
      )
        return "(no value needed)";
      if (
        operator === "is_within_last_days" ||
        operator === "is_within_next_days"
      )
        return "30";
      return "2024-01-01";
    case "list":
      if (operator === "includes" || operator === "not_includes")
        return "premium";
      if (
        operator === "has_length" ||
        operator === "has_length_greater_than" ||
        operator === "has_length_less_than"
      )
        return "3";
      if (operator === "is_empty" || operator === "is_not_empty")
        return "(no value needed)";
      return '["option1", "option2"]';
    default:
      return "value";
  }
};

const getRightValueHint = (
  comparisonType: string,
  operator: string
): string => {
  switch (comparisonType) {
    case "text":
      if (operator === "matches_pattern")
        return "Enter a regular expression pattern";
      if (operator === "is_empty" || operator === "is_not_empty")
        return "No value needed for this operator";
      return "Enter text to compare against";
    case "number":
      if (operator === "between") return "Enter min,max format (e.g., 10,20)";
      if (operator === "is_number" || operator === "is_not_number")
        return "No value needed for this operator";
      return "Enter a number";
    case "date":
      if (
        operator === "is_today" ||
        operator === "is_this_week" ||
        operator === "is_this_month"
      )
        return "No value needed for this operator";
      if (
        operator === "is_within_last_days" ||
        operator === "is_within_next_days"
      )
        return "Enter number of days";
      return "Enter date in YYYY-MM-DD format";
    case "list":
      if (operator === "includes" || operator === "not_includes")
        return "Enter single value to check";
      if (
        operator === "has_length" ||
        operator === "has_length_greater_than" ||
        operator === "has_length_less_than"
      )
        return "Enter expected length";
      if (operator === "is_empty" || operator === "is_not_empty")
        return "No value needed for this operator";
      return "Enter JSON array or comma-separated values";
    default:
      return "Enter value to compare";
  }
};

const getOperatorLabel = (operator: string): string => {
  const allOptions = [
    ...getOperatorOptions("text"),
    ...getOperatorOptions("number"),
    ...getOperatorOptions("date"),
    ...getOperatorOptions("list"),
  ];
  const option = allOptions.find((opt) => opt.value === operator);
  return option ? option.label : operator;
};

export default WorkflowNode;
