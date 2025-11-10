import React from "react";
import { get } from "lodash";

interface TextDisplayProps {
  element: any;
  context?: Record<string, any>;
  isPreviewMode?: boolean;
  style?: React.CSSProperties;
}

export const TextDisplay: React.FC<TextDisplayProps> = ({
  element,
  context = {},
  isPreviewMode = false,
  style = {},
}) => {
  // Helper function to resolve a single binding path
  const resolvePath = (path: string): any => {
    // Normalize array indices: "dbFindResult[0].name" -> "dbFindResult.0.name"
    const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");

    if (isPreviewMode) {
      console.log("🔍 [TEXT-DISPLAY] Resolving path:", {
        original: path,
        normalized: normalizedPath,
      });
    }

    const value = get(context, normalizedPath);

    if (isPreviewMode) {
      console.log("🔍 [TEXT-DISPLAY] Resolved value:", {
        path: normalizedPath,
        value: value,
        valueType: typeof value,
      });
    }

    return value;
  };

  const getValue = () => {
    const bindingPath = element.properties?.bindingPath;

    // Debug logging - only in preview mode to avoid cluttering edit mode logs
    if (isPreviewMode) {
      console.log("🔍 [TEXT-DISPLAY] Debug Info:", {
        elementId: element.id,
        bindingPath: bindingPath,
        contextKeys: Object.keys(context),
        fullContext: context,
      });
    }

    // If no binding path, return fallback text
    if (!bindingPath) {
      if (isPreviewMode) {
        console.log(
          "⚠️ [TEXT-DISPLAY] No binding path configured, using fallback text"
        );
      }
      return element.properties?.fallbackText || "No data";
    }

    // If no context, return fallback text
    if (!context || Object.keys(context).length === 0) {
      if (isPreviewMode) {
        console.log("⚠️ [TEXT-DISPLAY] Context is empty or undefined");
      }
      return element.properties?.fallbackText || "No data";
    }

    try {
      // Check if binding path contains template syntax {{...}}
      const templateRegex = /\{\{([^}]+)\}\}/g;
      const hasTemplate = templateRegex.test(bindingPath);

      if (hasTemplate) {
        // Template string mode - replace all {{path}} with values
        if (isPreviewMode) {
          console.log("🎨 [TEXT-DISPLAY] Using template mode");
        }

        let result = bindingPath;
        let hasUndefinedValue = false;

        // Reset regex lastIndex
        templateRegex.lastIndex = 0;

        // Replace each {{path}} with its value
        result = bindingPath.replace(
          templateRegex,
          (match: string, path: string) => {
            const trimmedPath = path.trim();
            const value = resolvePath(trimmedPath);

            if (value === undefined || value === null) {
              hasUndefinedValue = true;
              return match; // Keep original {{path}} if value not found
            }

            return String(value);
          }
        );

        if (isPreviewMode) {
          console.log("🎨 [TEXT-DISPLAY] Template result:", {
            original: bindingPath,
            result: result,
            hasUndefinedValue: hasUndefinedValue,
          });
        }

        // If any value was undefined, return fallback
        if (hasUndefinedValue) {
          if (isPreviewMode) {
            console.log(
              "⚠️ [TEXT-DISPLAY] Some template values undefined, using fallback"
            );
          }
          return element.properties?.fallbackText || "No data";
        }

        return result;
      } else {
        // Simple binding mode - single path
        if (isPreviewMode) {
          console.log("📍 [TEXT-DISPLAY] Using simple binding mode");
        }

        const value = resolvePath(bindingPath);

        // If value is undefined or null, return fallback
        if (value === undefined || value === null) {
          if (isPreviewMode) {
            console.log(
              "⚠️ [TEXT-DISPLAY] Value is undefined or null, using fallback text"
            );
          }
          return element.properties?.fallbackText || "No data";
        }

        return value;
      }
    } catch (error) {
      console.error("❌ [TEXT-DISPLAY] Error resolving binding path:", {
        bindingPath,
        error,
        context,
      });
      return element.properties?.fallbackText || "Error";
    }
  };

  const formatValue = (value: any): string => {
    const format = element.properties?.format || "text";

    // Handle null/undefined
    if (value === null || value === undefined) {
      return element.properties?.fallbackText || "No data";
    }

    try {
      switch (format) {
        case "currency":
          const num = Number(value);
          if (isNaN(num)) return "Invalid";
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(num);

        case "date":
          const date = new Date(value);
          if (isNaN(date.getTime())) return "Invalid Date";
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

        case "datetime":
          const dt = new Date(value);
          if (isNaN(dt.getTime())) return "Invalid Date";
          return dt.toLocaleString("en-US");

        case "number":
          const n = Number(value);
          return isNaN(n)
            ? "Invalid"
            : new Intl.NumberFormat("en-US").format(n);

        case "percentage":
          const p = Number(value);
          if (isNaN(p)) return "Invalid";
          return `${(p * 100).toFixed(2)}%`;

        case "phone":
          const phone = String(value).replace(/\D/g, "");
          if (phone.length !== 10) return value;
          return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(
            6
          )}`;

        case "uppercase":
          return String(value).toUpperCase();

        case "lowercase":
          return String(value).toLowerCase();

        case "capitalize":
          return (
            String(value).charAt(0).toUpperCase() +
            String(value).slice(1).toLowerCase()
          );

        case "text":
        default:
          return String(value);
      }
    } catch (error) {
      console.error(`Format error for ${format}:`, error);
      return "Format Error";
    }
  };

  const displayValue = getValue();
  const formattedValue = formatValue(displayValue);

  // Merge element styles with provided style
  const mergedStyle: React.CSSProperties = {
    fontSize: `${element.properties?.fontSize || 14}px`,
    fontWeight: element.properties?.fontWeight || "normal",
    color: element.properties?.color || "#000000",
    textAlign: (element.properties?.textAlign || "left") as any,
    opacity: (element.opacity || 100) / 100,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    ...style,
  };

  return <div style={mergedStyle}>{formattedValue}</div>;
};

export default TextDisplay;
