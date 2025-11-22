"use client";

import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Eye,
  EyeOff,
  Download,
  Minimize,
  Minimize2,
  Maximize,
  Maximize2,
  X,
  Settings,
  RefreshCw,
  Info,
  HelpCircle,
  Search,
  Plus,
  Edit,
  Trash2,
  Save,
  Upload,
  Home,
  ArrowLeft,
  Forward,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CanvasElement } from "./ElementManager";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import { toRuntimeStyle, logElementRender } from "@/runtime/styleMap";
import { normalizeMediaUrl, detectMediaKind } from "@/lib/utils";
import { TextDisplay } from "./elements/TextDisplay";
import { getSocket } from "@/lib/socket";

import { ChartElement } from "./ChartElement";

export interface CanvasRendererProps {
  elements: CanvasElement[];
  selectedElement?: CanvasElement | null;
  selectedElements?: CanvasElement[];
  canvasTransform?: { x: number; y: number; scale: number };
  onElementClick?: (element: CanvasElement, event: React.MouseEvent) => void;
  onElementDoubleClick?: (element: CanvasElement) => void;
  onMouseDown?: (event: React.MouseEvent, element: CanvasElement) => void;
  // New props for preview mode
  mode?: "edit" | "preview";
  readOnly?: boolean;
  onEvent?: (elementId: string, eventType: string, data?: any) => void;
  // Canvas dimensions for preview mode
  canvasWidth?: number;
  canvasHeight?: number;
  // Workflow integration - function to check if element has click workflow
  hasClickWorkflow?: (elementId: string) => boolean;
  // Form groups for form submission detection
  formGroups?: any[];
  // Callback to get current form values
  onGetFormValues?: (callback: (values: Record<string, any>) => void) => void;
  // Workflow context for data display elements
  workflowContext?: Record<string, any>;
}

const resolveMediaSource = (element: CanvasElement): string | undefined => {
  if (element.runtime?.media?.url) {
    return element.runtime.media.url;
  }

  return normalizeMediaUrl(
    element.properties?.src ||
      element.properties?.url ||
      element.properties?.path ||
      element.properties?.mediaUrl
  );
};

const resolveMediaThumbnail = (
  element: CanvasElement
): string | undefined => {
  const runtimeThumb = element.runtime?.media?.thumbnail;
  if (runtimeThumb) {
    return runtimeThumb;
  }

  return normalizeMediaUrl(
    element.properties?.thumbnail || element.properties?.thumbUrl
  );
};

const resolveMediaMimeType = (element: CanvasElement): string | undefined =>
  element.runtime?.media?.mimeType || element.properties?.mimeType;
// Icon mapping
const iconMap: Record<string, React.ComponentType<any>> = {
  minimize: Minimize,
  maximize: Maximize,
  close: X,
  settings: Settings,
  refresh: RefreshCw,
  info: Info,
  help: HelpCircle,
  search: Search,
};


const iconComponentMap: Record<string, LucideIcon> = {
  ICON_MINIMIZE: Minimize2,
  ICON_MAXIMIZE: Maximize2,
  ICON_CLOSE: X,
  ICON_SETTINGS: Settings,
  ICON_REFRESH: RefreshCw,
  ICON_INFO: Info,
  ICON_HELP: HelpCircle,
  ICON_SEARCH: Search,
  ICON_ADD: Plus,
  ICON_EDIT: Edit,
  ICON_DELETE: Trash2,
  ICON_SAVE: Save,
  ICON_DOWNLOAD: Download,
  ICON_UPLOAD: Upload,
  ICON_HOME: Home,
  ICON_BACK: ArrowLeft,
  ICON_FORWARD: Forward,
};

const getIconComponent = (type: string): LucideIcon | null => {
  if (!type) return null;

  const normalized = type.replace(/-/g, "_").toUpperCase();
  if (!normalized.startsWith("ICON")) return null;

  return iconComponentMap[normalized] ?? null;
};
export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  elements,
  selectedElement = null,
  selectedElements = [],
  canvasTransform = { x: 0, y: 0, scale: 1 },
  onElementClick,
  onElementDoubleClick,
  onMouseDown,
  mode = "edit",
  readOnly = false,
  onEvent,
  canvasWidth,
  canvasHeight,
  hasClickWorkflow,
  formGroups = [],
  onGetFormValues,
  workflowContext = {},
}) => {
  const { isPreviewMode } = useCanvasWorkflow();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  React.useEffect(() => {
    // Trigger one re-render after mount so canvasRef is available for portal positioning
    setCanvasReady(true);
  }, []);

  // Determine if we're in preview mode - either from prop or context
  const isInPreviewMode = mode === "preview" || readOnly || isPreviewMode;

  // Runtime state for form values
  const [values, setValues] = useState<Record<string, any>>({});
  // Per-element show-password state for password fields
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handler for form value changes
  const handleValueChange = (id: string, value: any) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    onEvent?.(id, "change", { value });
  };

  // Store form values in window for access from parent component
  React.useEffect(() => {
    if (mode === "preview") {
      (window as any).__canvasFormValues = values;
    }
  }, [values, mode]);

  // Debug: Log workflow context changes
  React.useEffect(() => {
    if (mode === "preview") {
      console.log("🔄 [CANVAS-RENDERER] Workflow context updated:", {
        contextKeys: Object.keys(workflowContext),
        fullContext: workflowContext,
      });
    }
  }, [workflowContext, mode]);
  // Helper function to render icons
  function renderIcon(
    iconType: string,
    size: number = 24,
    color: string = "#000000",
    strokeWidth: number = 2
  ) {
    // Extract the icon name from types like "icon-close", "ICON_CLOSE", etc.
    const iconName = iconType
      .toLowerCase()
      .replace("icon-", "")
      .replace("icon_", "");

    const IconComponent = iconMap[iconName];

    if (!IconComponent) {
      // Fallback for unknown icons
      return (
        <div
          style={{
            fontSize: size * 0.7,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ?
        </div>
      );
    }

    return (
      <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
    );
  }

  // Phase 7: Logging for parity verification
  React.useEffect(() => {
    if (elements.length > 0) {
      const firstFiveElements = elements.slice(0, 5).map((el) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        w: el.width,
        h: el.height,
        z: el.zIndex,
        rotation: el.rotation,
        opacity: el.opacity,
      }));

      console.log(
        `🎨 CANVAS RENDERER [${mode}]: Rendering ${elements.length} elements`,
        {
          mode,
          isInPreviewMode,
          readOnly,
          canvasTransform,
          firstFiveElements,
          elementsHash: elements
            .map((el) => `${el.id}:${el.x},${el.y}`)
            .join("|")
            .slice(0, 100),
        }
      );
    }
  }, [elements, mode, isInPreviewMode, readOnly, canvasTransform]);
  const renderElement = (element: CanvasElement) => {
    // Log element rendering for debugging
    if (mode === "preview") {
      logElementRender(element, isInPreviewMode ? "runtime" : "preview");
    }

    const isSelected =
      !isInPreviewMode &&
      (selectedElement?.id === element.id ||
        selectedElements.some((el) => el.id === element.id));

    // Check if this element has workflows for different event types
    const elementHasClickWorkflow =
      isInPreviewMode && hasClickWorkflow?.(element.id);
    const elementHasHoverWorkflow =
      isInPreviewMode && hasClickWorkflow?.(`${element.id}:hover`);
    const elementHasFocusWorkflow =
      isInPreviewMode && hasClickWorkflow?.(`${element.id}:focus`);

    // Use unified style mapping
    const style = toRuntimeStyle(element, {
      includeEditorStyles: !isInPreviewMode,
      isSelected,
    });

    // Add cursor pointer if element has click workflow
    const interactiveStyle = elementHasClickWorkflow
      ? { ...style, cursor: "pointer" }
      : style;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isInPreviewMode) {
        // In preview mode, trigger runtime events
        // IMPORTANT: Don't pass the entire element or event object - they contain circular references
        // Only pass serializable data
        onEvent?.(element.id, "click", {
          elementId: element.id,
          elementType: element.type,
          clientX: e.clientX,
          clientY: e.clientY,
          timestamp: Date.now(),
        });
      } else {
        // In edit mode, handle selection
        onElementClick?.(element, e);
      }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!isInPreviewMode) {
        onElementDoubleClick?.(element);
      }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!isInPreviewMode) {
        onMouseDown?.(e, element);
      }
    };

    // File drop handlers for preview mode
    const handleDragOver = (e: React.DragEvent) => {
      if (isInPreviewMode) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragEnter = (e: React.DragEvent) => {
      if (isInPreviewMode) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      if (isInPreviewMode) {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          console.log(
            "📁 [CANVAS-DROP] Files dropped on element:",
            element.id,
            files.length
          );

          // Convert files to a format that can be passed through the event system
          const fileData = files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            // Convert file to base64 for transmission
            data: null as string | null, // Will be populated by FileReader
          }));

          // Read files as base64
          Promise.all(
            files.map((file) => {
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            })
          ).then((base64Results) => {
            // Add base64 data to file objects
            fileData.forEach((fileObj, index) => {
              fileObj.data = base64Results[index];
            });

            // Trigger drop event with file data
            onEvent?.(element.id, "drop", {
              files: fileData,
              position: {
                x: e.clientX,
                y: e.clientY,
              },
              element,
              event: e,
            });
          });
        }
      }
    };

    // Common props for clickable non-interactive elements
    const clickableProps = elementHasClickWorkflow
      ? {
          onClick: handleClick,
          role: "button",
          tabIndex: 0,
          style: interactiveStyle,
        }
      : { style: interactiveStyle };

    // Common drop props for all elements in preview mode
    const dropProps = isInPreviewMode
      ? {
          onDragOver: handleDragOver,
          onDragEnter: handleDragEnter,
          onDrop: handleDrop,
        }
      : {};

    const iconComponent = getIconComponent(element.type);

    if (iconComponent) {
      const IconComponent = iconComponent;
      const iconSize = element.properties?.iconSize || 24;
      const iconColor = element.properties?.iconColor || "#6b7280";
      const rawOpacity = element.properties?.iconOpacity;
      const iconOpacity =
        rawOpacity === undefined || rawOpacity === null || rawOpacity === ""
          ? 1
          : Number(rawOpacity);
      const iconRotation = element.properties?.iconRotation || 0;
      const baseBorderWidth = element.properties?.borderWidth || 0;
      const borderColor = element.properties?.borderColor || "#d1d5db";

      const iconWrapperStyle: React.CSSProperties = {
        ...interactiveStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          element.properties?.backgroundColor ??
          (interactiveStyle.backgroundColor as string) ??
          "transparent",
        borderRadius:
          element.properties?.borderRadius ?? interactiveStyle.borderRadius ?? 0,
        padding: element.properties?.padding ?? interactiveStyle.padding ?? 0,
        border:
          baseBorderWidth > 0
            ? `${baseBorderWidth}px solid ${borderColor}`
            : interactiveStyle.border,
      };

      const iconWrapperProps: React.HTMLAttributes<HTMLDivElement> = {
        style: iconWrapperStyle,
        ...dropProps,
      };

      if (isInPreviewMode && elementHasClickWorkflow) {
        iconWrapperProps.onClick = handleClick;
        iconWrapperProps.role = "button";
        iconWrapperProps.tabIndex = 0;
        iconWrapperProps.style = {
          ...iconWrapperProps.style,
          cursor: "pointer",
        };
      } else if (!isInPreviewMode) {
        iconWrapperProps.onClick = handleClick;
        iconWrapperProps.onDoubleClick = handleDoubleClick;
        iconWrapperProps.onMouseDown = handleMouseDown;
      }

      if (mode === "preview" && elementHasHoverWorkflow) {
        iconWrapperProps.onMouseEnter = () => onEvent?.(element.id, "hover");
      }

      if (mode === "preview" && elementHasFocusWorkflow) {
        iconWrapperProps.onFocus = () => onEvent?.(element.id, "focus");
        iconWrapperProps.tabIndex = 0;
      }

      return (
        <div key={element.id} {...iconWrapperProps}>
          <IconComponent
            size={iconSize}
            color={iconColor}
            style={{
              opacity: Number.isFinite(iconOpacity)
                ? Number(iconOpacity)
                : 1,
              transform: `rotate(${iconRotation}deg)`,
            }}
          />
        </div>
      );
    }

    switch (element.type) {
      case "BUTTON":
      case "button":
        return (
          <button
            key={element.id}
            style={style}
            {...dropProps}
            onClick={
              mode === "preview"
                ? () => {
                    // First check if button is marked as submit button with explicit properties
                    if (
                      element.properties?.isSubmitButton &&
                      element.properties?.formGroupId
                    ) {
                      const formGroupId = element.properties.formGroupId;
                      const parentFormGroup = formGroups.find(
                        (group) =>
                          group.id === formGroupId && group.type === "form"
                      );

                      if (parentFormGroup) {
                        // This is a form submission - collect form data
                        const formData: Record<string, any> = {};

                        // Find all form elements in this group using elementIds
                        const formElements = elements.filter(
                          (el) =>
                            parentFormGroup.elementIds.includes(el.id) &&
                            [
                              // Uppercase variants
                              "TEXT_FIELD",
                              "TEXT_AREA",
                              "CHECKBOX",
                              "RADIO_BUTTON",
                              "DROPDOWN",
                              "TOGGLE",
                              "PHONE_FIELD",
                              "PASSWORD_FIELD",
                              "DATE_PICKER",
                              "DATE_FIELD",
                              "EMAIL_FIELD",
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
                            ].includes(el.type)
                        );

                        // Collect form data
                        formElements.forEach((formEl) => {
                          const value =
                            values[formEl.id] || formEl.properties?.value || "";
                          formData[formEl.id] = value;
                          if (formEl.properties?.name) {
                            formData[formEl.properties.name] = value;
                          }
                        });

                        console.log(
                          "📝 [FORM-SUBMIT] Form submission detected (explicit):",
                          {
                            formGroupId: parentFormGroup.id,
                            formGroupName: parentFormGroup.name,
                            submitButtonId: element.id,
                            formElementsFound: formElements.length,
                            formElementIds: formElements.map((el) => el.id),
                            formData: formData,
                            formDataKeys: Object.keys(formData),
                          }
                        );

                        // Trigger form submission event with proper form group context
                        onEvent?.(element.id, "submit", {
                          formData,
                          triggerElement: element,
                          formGroupId: parentFormGroup.id,
                        });
                        return;
                      }
                    }

                    // Fallback: Check if button is linked to a form group via submitButtonId (legacy)
                    const parentFormGroup = formGroups.find(
                      (group) =>
                        group.type === "form" &&
                        (group.submitButtonId === element.id ||
                          group.properties?.submitButtonId === element.id)
                    );

                    if (parentFormGroup) {
                      // This is a form submission - collect form data
                      const formData: Record<string, any> = {};

                      // Find all form elements in this group using elementIds
                      const formElements = elements.filter(
                        (el) =>
                          parentFormGroup.elementIds.includes(el.id) &&
                          [
                            "TEXT_FIELD",
                            "TEXT_AREA",
                            "CHECKBOX",
                            "RADIO_BUTTON",
                            "DROPDOWN",
                            "PHONE_FIELD",
                            "DATE_PICKER",
                            "EMAIL_FIELD",
                            "PASSWORD_FIELD",
                            "NUMBER_FIELD",
                            "textfield",
                            "textarea",
                            "checkbox",
                            "radiobutton",
                            "dropdown",
                            "phonefield",
                            "datepicker",
                          ].includes(el.type)
                      );

                      // Collect form data
                      formElements.forEach((formEl) => {
                        const value =
                          values[formEl.id] || formEl.properties?.value || "";
                        formData[formEl.id] = value;
                        if (formEl.properties?.name) {
                          formData[formEl.properties.name] = value;
                        }
                      });

                      console.log(
                        "📝 [FORM-SUBMIT] Form submission detected:",
                        {
                          formGroupId: parentFormGroup.id,
                          formGroupName: parentFormGroup.name,
                          submitButtonId: element.id,
                          formElementsFound: formElements.length,
                          formElementIds: formElements.map((el) => el.id),
                          formData: formData,
                          formDataKeys: Object.keys(formData),
                        }
                      );

                      // Trigger form submission event with proper form group context
                      onEvent?.(element.id, "submit", {
                        formData,
                        triggerElement: element,
                        formGroupId: parentFormGroup.id,
                      });
                    } else {
                      // Regular button click
                      onEvent?.(element.id, "click");
                    }
                  }
                : handleClick
            }
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            onMouseEnter={
              mode === "preview" && elementHasHoverWorkflow
                ? () => onEvent?.(element.id, "hover")
                : undefined
            }
            onFocus={
              mode === "preview" && elementHasFocusWorkflow
                ? () => onEvent?.(element.id, "focus")
                : undefined
            }
          >
            {element.properties?.text ?? "Button"}
          </button>
        );

      case "TEXT_FIELD":
      case "textfield":
        return (
          <input
            key={element.id}
            type="text"
            style={{
              ...style,
              pointerEvents: "auto" as React.CSSProperties["pointerEvents"],
              zIndex: (element.zIndex ?? 1) + 1000 as React.CSSProperties["zIndex"],
            }}
            tabIndex={mode === "preview" ? 0 : undefined}
            {...dropProps}
            value={
              mode === "preview"
                ? values[element.id] ??
                  element.properties?.value ??
                  element.properties?.text ??
                  ""
                : undefined
            }
            defaultValue={
              mode === "edit"
                ? element.properties?.value ?? element.properties?.text ?? ""
                : undefined
            }
            placeholder={element.properties?.placeholder ?? "Enter text"}
            onChange={
              mode === "preview"
                ? (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleValueChange(element.id, e.target.value)
                : undefined
            }
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
          />
        );

      case "TEXT_AREA":
      case "textarea":
        return (
          <textarea
            key={element.id}
            style={{
              ...style,
              pointerEvents: "auto" as React.CSSProperties["pointerEvents"],
              zIndex: (element.zIndex ?? 1) + 1000 as React.CSSProperties["zIndex"],
            }}
            tabIndex={mode === "preview" ? 0 : undefined}
            {...dropProps}
            placeholder={element.properties?.placeholder ?? "Enter text"}
            value={
              mode === "preview"
                ? values[element.id] ??
                  element.properties?.text ??
                  element.properties?.value ??
                  ""
                : undefined
            }
            defaultValue={
              mode === "edit"
                ? element.properties?.text ?? element.properties?.value ?? ""
                : undefined
            }
            rows={element.properties?.rows ?? 4}
            onChange={
              mode === "preview"
                ? (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleValueChange(element.id, e.target.value)
                : undefined
            }
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
          />
        );

      case "DROPDOWN":
        return (
          <select
            key={element.id}
            style={{
              ...style,
              pointerEvents: "auto" as React.CSSProperties["pointerEvents"],
              zIndex: (element.zIndex ?? 1) + 1000 as React.CSSProperties["zIndex"],
            }}
            tabIndex={mode === "preview" ? 0 : undefined}
            value={
              mode === "preview"
                ? values[element.id] ?? element.properties?.value ?? ""
                : undefined
            }
            defaultValue={
              mode === "edit" ? element.properties?.value ?? "" : undefined
            }
            onChange={
              mode === "preview"
                ? (e: React.ChangeEvent<HTMLSelectElement>) =>
                    handleValueChange(element.id, e.target.value)
                : undefined
            }
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
          >
            <option value="">
              {element.properties.placeholder || "Select option"}
            </option>
            {(element.properties.options || []).map(
              (option: string, index: number) => (
                <option key={index} value={option}>
                  {option}
                </option>
              )
            )}
          </select>
        );

      case "CHECKBOX":
      case "checkbox":
        return (
          <label
            key={element.id}
            style={{
              ...style,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: mode === "preview" ? "pointer" : "default",
            }}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <input
              type="checkbox"
              checked={
                mode === "preview"
                  ? !!(
                      values[element.id] ??
                      element.properties?.checked ??
                      false
                    )
                  : !!(element.properties?.checked ?? false)
              }
              onChange={
                mode === "preview"
                  ? (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleValueChange(element.id, e.target.checked)
                  : undefined
              }
              readOnly={mode === "edit"}
              disabled={
                !!(
                  element.properties?.style?.disabled ||
                  element.properties?.disabled
                )
              }
            />
            <span>{element.properties?.label || "Checkbox"}</span>
          </label>
        );
      case "chart-bar":
      case "chart-line":
      case "chart-pie":
      case "chart-donut":
      case "CHART_BAR":
      case "CHART_LINE":
      case "CHART_PIE":
      case "CHART_DONUT":
      case "KPI_CARD":
      case "kpi-card":
      case "TABLE":
      case "table":
      case "MATRIX_CHART":
      case "matrix-chart":
        return (
          <div
            key={element.id}
            style={interactiveStyle}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <ChartElement
              type={element.type}
              properties={element.properties}
              showHeader={element.properties?.showHeader ?? true}
            />
          </div>
        );
      case "triangle":
      case "TRIANGLE": {
        const triangleStrokeColor =
          element.properties?.borderColor || "transparent";
        const triangleStrokeWidth = element.properties?.borderWidth || 0;
        return (
          <svg
            key={element.id}
            width="100%"
            height="100%"
            viewBox={`0 0 ${element.width} ${element.height}`}
            style={{
              ...interactiveStyle,
              background: "transparent", // Critical: no background on SVG
              border: "none", // Critical: no border on SVG
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <polygon
              points={`${element.width / 2},0 0,${element.height} ${
                element.width
              },${element.height}`}
              fill={element.properties?.backgroundColor || "#ffffff"}
              stroke={triangleStrokeWidth > 0 ? triangleStrokeColor : "none"}
              strokeWidth={triangleStrokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );
      }

      case "star":
      case "STAR": {
        const starStrokeColor =
          element.properties?.borderColor || "transparent";
        const starStrokeWidth = element.properties?.borderWidth || 0;
        return (
          <svg
            key={element.id}
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            style={{
              ...interactiveStyle,
              background: "transparent",
              border: "none",
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={element.properties?.backgroundColor || "#fbbf24"}
              stroke={starStrokeWidth > 0 ? starStrokeColor : "none"}
              strokeWidth={starStrokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );
      }

      case "heart":
      case "HEART": {
        const heartStrokeColor =
          element.properties?.borderColor || "transparent";
        const heartStrokeWidth = element.properties?.borderWidth || 0;
        return (
          <svg
            key={element.id}
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            style={{
              ...interactiveStyle,
              background: "transparent",
              border: "none",
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              fill={element.properties?.backgroundColor || "#ef4444"}
              stroke={heartStrokeWidth > 0 ? heartStrokeColor : "none"}
              strokeWidth={heartStrokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );
      }
      case "circle":
      case "CIRCLE":
        return (
          <div
            key={element.id}
            style={{
              ...interactiveStyle,
              borderRadius: "50%",
              backgroundColor: element.properties?.backgroundColor || "#ffffff",
              border: element.properties?.borderWidth
                ? `${element.properties.borderWidth}px solid ${
                    element.properties.borderColor || "#d1d5db"
                  }`
                : "none",
            }}
            className="w-full h-full"
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          />
        );
      case "arrow":
      case "ARROW": {
        const arrowStrokeWidth = element.properties?.strokeWidth || 2;
        const arrowStrokeColor = element.properties?.strokeColor || "#1f2937";
        const arrowStrokeStyle = element.properties?.strokeStyle || "solid";
        const arrowOpacity = element.properties?.strokeOpacity || 1;
        const arrowHeadSize = element.properties?.arrowHeadSize || 8;

        return (
          <div
            key={element.id}
            className="flex items-center w-full h-full"
            style={{
              ...interactiveStyle,
              opacity: arrowOpacity,
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <div
              style={{
                flex: 1,
                height: `${arrowStrokeWidth}px`,
                backgroundColor:
                  arrowStrokeStyle === "solid"
                    ? arrowStrokeColor
                    : "transparent",
                borderStyle:
                  arrowStrokeStyle === "dashed"
                    ? "dashed"
                    : arrowStrokeStyle === "dotted"
                    ? "dotted"
                    : "solid",
                borderWidth:
                  arrowStrokeStyle !== "solid"
                    ? `${arrowStrokeWidth}px 0 0 0`
                    : "0",
                borderColor:
                  arrowStrokeStyle !== "solid"
                    ? arrowStrokeColor
                    : "transparent",
              }}
            />
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: `${arrowHeadSize}px solid ${arrowStrokeColor}`,
                borderTop: `${arrowHeadSize / 2}px solid transparent`,
                borderBottom: `${arrowHeadSize / 2}px solid transparent`,
              }}
            />
          </div>
        );
      }
      case "line":
      case "LINE": {
        const lineStrokeColor =
          element.properties?.borderColor ||
          element.properties?.backgroundColor ||
          "#000000";
        const lineStrokeWidth = element.properties?.borderWidth || 2;
        return (
          <svg
            key={element.id}
            width="100%"
            height="100%"
            viewBox={`0 0 ${element.width} ${element.height}`}
            style={{
              ...interactiveStyle,
              background: "transparent",
              border: "none",
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <line
              x1="0"
              y1={element.height / 2}
              x2={element.width}
              y2={element.height / 2}
              stroke={lineStrokeColor}
              strokeWidth={lineStrokeWidth}
              strokeLinecap="round"
            />
          </svg>
        );
      }

      case "RADIO_BUTTON":
        return (
          <label
            key={element.id}
            style={{
              ...style,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: mode === "preview" ? "pointer" : "default",
            }}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <input
              type="radio"
              checked={
                mode === "preview"
                  ? !!(
                      values[element.id] ??
                      element.properties?.checked ??
                      false
                    )
                  : !!(element.properties?.checked ?? false)
              }
              onChange={
                mode === "preview"
                  ? (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleValueChange(element.id, e.target.checked)
                  : undefined
              }
              readOnly={mode === "edit"}
              disabled={
                !!(
                  element.properties?.style?.disabled ||
                  element.properties?.disabled
                )
              }
            />
            <span>{element.properties.label || "Radio Button"}</span>
          </label>
        );

      case "TOGGLE":
        const toggleChecked =
          mode === "preview"
            ? !!(values[element.id] ?? element.properties?.checked ?? false)
            : !!(element.properties?.checked ?? false);

        return (
          <label
            key={element.id}
            style={{
              ...style,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: mode === "preview" ? "pointer" : "default",
            }}
            onClick={
              mode === "preview"
                ? () => handleValueChange(element.id, !toggleChecked)
                : handleClick
            }
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <div
              style={{
                width: "40px",
                height: "20px",
                backgroundColor: toggleChecked ? "#3b82f6" : "#d1d5db",
                borderRadius: "10px",
                position: "relative",
                transition: "background-color 0.2s",
                opacity: !!(
                  element.properties?.style?.disabled ||
                  element.properties?.disabled
                )
                  ? 0.5
                  : 1,
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "50%",
                  position: "absolute",
                  top: "2px",
                  left: toggleChecked ? "22px" : "2px",
                  transition: "left 0.2s",
                }}
              />
            </div>
            <span>{element.properties.label || "Toggle"}</span>
          </label>
        );

      case "phone":
      case "password":
      case "PHONE_FIELD":
      case "EMAIL_FIELD":
      case "PASSWORD_FIELD":
      case "NUMBER_FIELD":
        // Ensure all styling properties are explicitly applied for input fields
        const inputStyle = {
          ...style,
          // Explicitly ensure border styling is applied
          borderWidth:
            element.properties?.borderWidth || style.borderWidth || 1,
          borderColor:
            element.properties?.borderColor || style.borderColor || "#d1d5db",
          borderStyle: "solid",
          borderRadius:
            element.properties?.borderRadius || style.borderRadius || 6,
          backgroundColor:
            element.properties?.backgroundColor ||
            style.background ||
            "#ffffff",
          color: element.properties?.color || style.color || "#000000",
          padding: element.properties?.padding || style.padding || "8px 12px",
          fontSize: element.properties?.fontSize || style.fontSize || 14,
          fontFamily:
            element.properties?.fontFamily ||
            style.fontFamily ||
            "Poppins, system-ui, sans-serif",
          outline: "none",
          // Ensure inputs are interactive in runtime/preview
          pointerEvents: "auto" as React.CSSProperties["pointerEvents"],
          zIndex: (element.zIndex ?? 1) + 1000 as React.CSSProperties["zIndex"],
        };

        // If this is a password field, render an input with an eye toggle inside a wrapper
        const isPasswordType =
          element.type === "password" || element.type === "PASSWORD_FIELD" ||
          (typeof element.type === "string" && element.type.toLowerCase().includes("password"));

        if (isPasswordType) {
          const show = !!showPasswordMap[element.id];

          // Debugging: log computed stacking values so we can diagnose visibility issues in run mode
          try {
            const inputZ = ((element.zIndex ?? 1) as number) + 1000;
            const toggleZ = ((element.zIndex ?? 1) as number) + 1200;
            console.log("[CANVAS][PASSWORD] rendering", {
              id: element.id,
              type: element.type,
              elementZ: element.zIndex,
              inputZ,
              toggleZ,
              mode,
              isInPreviewMode,
            });
          } catch (e) {
            console.warn("[CANVAS][PASSWORD] debug log failed", e);
          }
          return (
            <div key={element.id} style={{ position: "relative" }} {...dropProps}>
              <input
                type={show ? "text" : "password"}
                style={inputStyle}
                placeholder={element.properties.placeholder || "Enter value"}
                value={
                  mode === "preview"
                    ? values[element.id] ?? element.properties?.value ?? ""
                    : undefined
                }
                defaultValue={
                  mode === "edit" ? element.properties?.value ?? "" : undefined
                }
                onChange={
                  mode === "preview"
                    ? (e: React.ChangeEvent<HTMLInputElement>) =>
                        handleValueChange(element.id, e.target.value)
                    : undefined
                }
                tabIndex={mode === "preview" ? 0 : undefined}
                onClick={mode === "preview" ? undefined : handleClick}
                onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
                onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
                disabled={
                  !!(
                    element.properties?.style?.disabled ||
                    element.properties?.disabled
                  )
                }
                readOnly={mode !== "preview"}
              />
              <button
                aria-label={show ? "Hide password" : "Show password"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleShowPassword(element.id);
                }}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.6)",
                  border: "none",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  borderRadius: "50%",
                  // Ensure the toggle sits above the input which uses element.zIndex + 1000
                  zIndex: ((element.zIndex ?? 1) as number) + 1200,
                  pointerEvents: "auto",
                }}
              >
                {show ? (
                  <EyeOff size={16} color={element.properties?.iconColor || "#6b7280"} />
                ) : (
                  <Eye size={16} color={element.properties?.iconColor || "#6b7280"} />
                )}
              </button>
            </div>
          );
        }

        // Special handling for phone fields to enforce digits-only and 10-digit length
        if (
          typeof element.type === "string" &&
          element.type.toUpperCase().includes("PHONE")
        ) {
          return (
            <input
              key={element.id}
              type={getInputType(element.type)}
              inputMode="numeric"
              pattern="[0-9]*"
              style={inputStyle}
              {...dropProps}
              placeholder={element.properties.placeholder || "Phone number"}
              value={
                mode === "preview"
                  ? values[element.id] ?? element.properties?.value ?? ""
                  : undefined
              }
              defaultValue={mode === "edit" ? element.properties?.value ?? "" : undefined}
              onChange={
                mode === "preview"
                  ? (e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value || "";
                      const digits = raw.replace(/\D+/g, "");

                      if (raw !== digits) {
                        // notify parent so it can show a toast/prompt
                        onEvent?.(element.id, "invalidPhone", {
                          message: "Not a valid phone number. Please enter digits only.",
                        });
                      }

                      let normalized = digits;
                      if (normalized.length > 10) {
                        normalized = normalized.slice(0, 10);
                        onEvent?.(element.id, "invalidPhone", {
                          message: "Phone number must be 10 digits. Extra digits were removed.",
                        });
                      }

                      handleValueChange(element.id, normalized);

                      // Also reflect normalized value in the input for uncontrolled cases
                      try {
                        const input = e.target as HTMLInputElement;
                        if (input && input.value !== normalized) input.value = normalized;
                      } catch (err) {
                        /* ignore DOM write errors */
                      }
                    }
                  : undefined
              }
              onBlur={
                mode === "preview"
                  ? (e: React.FocusEvent<HTMLInputElement>) => {
                      const value = (e.target as HTMLInputElement).value || "";
                      if (value.length !== 10) {
                        onEvent?.(element.id, "invalidPhone", {
                          message: "Not a valid phone number. Phone number must be exactly 10 digits.",
                        });
                      }
                    }
                  : undefined
              }
              tabIndex={mode === "preview" ? 0 : undefined}
              onClick={mode === "preview" ? undefined : handleClick}
              onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
              onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
              disabled={
                !!(
                  element.properties?.style?.disabled ||
                  element.properties?.disabled
                )
              }
              readOnly={mode !== "preview"}
            />
          );
        }

        return (
          <input
            key={element.id}
            type={getInputType(element.type)}
            style={inputStyle}
            {...dropProps}
            placeholder={element.properties.placeholder || "Enter value"}
            value={
              mode === "preview"
                ? values[element.id] ?? element.properties?.value ?? ""
                : undefined
            }
            defaultValue={
              mode === "edit" ? element.properties?.value ?? "" : undefined
            }
            onChange={
              mode === "preview"
                ? (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleValueChange(element.id, e.target.value)
                : undefined
            }
            tabIndex={mode === "preview" ? 0 : undefined}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
            readOnly={mode !== "preview"}
          />
        );

      case "DATE_FIELD":
        return (
          <input
            key={element.id}
            type="date"
            style={style}
            value={
              mode === "preview"
                ? values[element.id] ?? element.properties?.value ?? ""
                : undefined
            }
            defaultValue={
              mode === "edit" ? element.properties?.value ?? "" : undefined
            }
            onChange={
              mode === "preview"
                ? (e) => handleValueChange(element.id, e.target.value)
                : undefined
            }
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
            disabled={
              !!(
                element.properties?.style?.disabled ||
                element.properties?.disabled
              )
            }
            readOnly={mode === "edit"}
          />
        );

      case "FILE_UPLOAD":
        return (
          <div
            key={element.id}
            style={{
              ...style,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: mode === "preview" ? "pointer" : "default",
              padding: "10px",
              textAlign: "center",
            }}
            onClick={
              mode === "preview"
                ? () => {
                    // In preview mode, trigger file input
                    const input = document.createElement("input");
                    input.type = "file";
                    input.onchange = (e: any) => {
                      const file = e.target?.files?.[0];
                      if (file) {
                        // Store both the file name and the actual file object
                        handleValueChange(element.id, file.name);
                        // Store the file object in a separate map for later retrieval
                        if (!(window as any).__uploadedFiles) {
                          (window as any).__uploadedFiles = {};
                        }
                        (window as any).__uploadedFiles[element.id] = file;
                        console.log(
                          `📁 [FILE-UPLOAD] File selected for ${element.id}:`,
                          {
                            name: file.name,
                            size: file.size,
                            type: file.type,
                          }
                        );
                      }
                    };
                    input.click();
                  }
                : handleClick
            }
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            <span
              style={{ color: "#6b7280", fontSize: "14px", fontWeight: "500" }}
            >
              {values[element.id] ||
                element.properties?.fileName ||
                element.properties?.placeholder ||
                "Choose file"}
            </span>
            {values[element.id] && (
              <span
                style={{ color: "#9ca3af", fontSize: "12px", marginTop: "4px" }}
              >
                File selected
              </span>
            )}
          </div>
        );

      case "IMAGE":
      case "image": {
        const imageSrc = resolveMediaSource(element);
        const altText =
          element.properties.alt ||
          element.properties.fileName ||
          "Image";

        return (
          <div
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.properties.backgroundColor || "#f3f4f6",
              border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            {...dropProps}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={altText}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                loading="lazy"
              />
            ) : (
              <span style={{ color: "#6b7280", fontSize: "14px" }}>
                No image
              </span>
            )}
          </div>
        );
      }

      case "VIDEO":
      case "video": {
        const videoSrc = resolveMediaSource(element);
        const posterSrc = resolveMediaThumbnail(element);

        return (
          <div
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.properties.backgroundColor || "#000000",
              border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            {...dropProps}
          >
            {videoSrc ? (
              <video
                src={videoSrc}
                controls
                poster={posterSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{ color: "#ffffff", fontSize: "14px" }}>
                No video
              </span>
            )}
          </div>
        );
      }

      case "AUDIO":
      case "audio": {
        const audioSrc = resolveMediaSource(element);

        return (
          <div
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.properties.backgroundColor || "#f3f4f6",
              border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: "10px",
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            {...dropProps}
          >
            {audioSrc ? (
              <audio
                src={audioSrc}
                controls
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />
            ) : (
              <span style={{ color: "#6b7280", fontSize: "14px" }}>
                No audio
              </span>
            )}
          </div>
        );
      }

      case "MEDIA":
      case "media": {
        const mediaSrc = resolveMediaSource(element);
        const thumbnailSrc = resolveMediaThumbnail(element);
        const mimeType = resolveMediaMimeType(element);
        const mediaKind = detectMediaKind(mimeType, mediaSrc);
        const fileLabel =
          element.properties.fileName ||
          element.properties.label ||
          mediaSrc?.split("/").pop() ||
          "File";

        const buildDownloadFileName = () => {
          const fromUrl = mediaSrc?.split("/").pop()?.split("?")[0] || "";
          const raw =
            element.properties.fileName ||
            element.properties.label ||
            fromUrl ||
            "download";
          const sanitized = raw.replace(/[\\/:*?"<>|]+/g, "_");

          if (!fromUrl) {
            return sanitized;
          }

          const urlExtension = fromUrl.includes(".")
            ? fromUrl.split(".").pop()?.toLowerCase()
            : undefined;

          if (!urlExtension) {
            return sanitized;
          }

          return sanitized.toLowerCase().endsWith(`.${urlExtension}`)
            ? sanitized
            : `${sanitized}.${urlExtension}`;
        };

        const handleDownloadClick = async (
          event: React.MouseEvent<HTMLButtonElement>
        ) => {
          event.preventDefault();
          event.stopPropagation();

          if (!mediaSrc) return;

          try {
            const directProtocols = ["blob:", "data:"];
            if (directProtocols.some((prefix) => mediaSrc.startsWith(prefix))) {
              const anchor = document.createElement("a");
              anchor.href = mediaSrc;
              anchor.download = buildDownloadFileName();
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);
              return;
            }

            const token =
              typeof window !== "undefined"
                ? window.localStorage.getItem("authToken")
                : null;

            const response = await fetch(mediaSrc, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              credentials: "include",
            });

            if (!response.ok) {
              console.error(
                `[MEDIA] Download failed for ${element.id} with status`,
                response.status
              );
              if (typeof window !== "undefined") {
                window.open(mediaSrc, "_blank");
              }
              return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = buildDownloadFileName();
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);

            // Revoke the object URL after the browser has started the download
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          } catch (error) {
            console.error(`[MEDIA] Download error for ${element.id}:`, error);
            if (typeof window !== "undefined") {
              window.open(mediaSrc, "_blank");
            }
          }
        };

        const renderMediaPreview = () => {
          if (!mediaSrc) {
            return (
              <span style={{ color: "#6b7280", fontSize: "14px" }}>
                No file
              </span>
            );
          }

          if (mediaKind === "image") {
            return (
              <img
                src={thumbnailSrc || mediaSrc}
                alt={fileLabel}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                loading="lazy"
              />
            );
          }

          if (mediaKind === "video") {
            return (
              <video
                src={mediaSrc}
                controls
                poster={thumbnailSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            );
          }

          if (mediaKind === "audio") {
            return (
              <audio
                src={mediaSrc}
                controls
                style={{
                  width: "100%",
                }}
              />
            );
          }

          return (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
              }}
            >
              <svg
                style={{
                  width: "40px",
                  height: "40px",
                  color: "#9ca3af",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          );
        };

        return (
          <div
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.properties.backgroundColor || "#f3f4f6",
              border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexDirection: "column",
              padding: "10px",
              position: "relative",
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            {...dropProps}
          >
            {renderMediaPreview()}
            {mediaSrc && (
              <span
                style={{
                  color: "#6b7280",
                  fontSize: "12px",
                  marginTop: "8px",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}
                title={fileLabel}
              >
                {fileLabel}
              </span>
            )}
            {isInPreviewMode && mediaKind === "other" && mediaSrc && (
              <button
                type="button"
                onClick={handleDownloadClick}
                title="Download file"
                aria-label="Download file"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(148, 163, 184, 0.4)",
                  borderRadius: "9999px",
                  padding: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                  pointerEvents: "auto",
                }}
              >
                <Download size={16} color="#1f2937" />
              </button>
            )}
          </div>
        );
      }

      case "TEXT_DISPLAY":
      case "text_display":
        const textDisplayProps = elementHasClickWorkflow
          ? { ...clickableProps, style }
          : {
              style,
              onClick: isInPreviewMode ? undefined : handleClick,
              onDoubleClick: isInPreviewMode ? undefined : handleDoubleClick,
              onMouseDown: isInPreviewMode ? undefined : handleMouseDown,
            };
        return (
          <div key={element.id} {...textDisplayProps}>
            <TextDisplay
              element={element}
              context={workflowContext || {}}
              isPreviewMode={isInPreviewMode}
            />
          </div>
        );

      case "SHAPE":
      default:
        // Check if this SHAPE has a bindingPath (making it a TEXT_DISPLAY)
        const hasBindingPath = element.properties?.bindingPath;

        if (hasBindingPath) {
          // Render as TEXT_DISPLAY
          const textDisplayShapeProps = elementHasClickWorkflow
            ? { ...clickableProps, style }
            : {
                style,
                onClick: isInPreviewMode ? undefined : handleClick,
                onDoubleClick: isInPreviewMode ? undefined : handleDoubleClick,
                onMouseDown: isInPreviewMode ? undefined : handleMouseDown,
              };
          return (
            <div key={element.id} {...textDisplayShapeProps}>
              <TextDisplay
                element={element}
                context={workflowContext || {}}
                isPreviewMode={isInPreviewMode}
              />
            </div>
          );
        }

        // Use clickableProps for non-interactive elements with workflows
        const shapeProps = elementHasClickWorkflow
          ? clickableProps
          : {
              style: interactiveStyle,
              onClick: isInPreviewMode ? undefined : handleClick,
              onDoubleClick: isInPreviewMode ? undefined : handleDoubleClick,
              onMouseDown: isInPreviewMode ? undefined : handleMouseDown,
            };

        // Support background images for shapes (e.g., from onDrop workflow)
        const backgroundStyle = element.properties.backgroundImage
          ? {
              backgroundImage: `url(${element.properties.backgroundImage})`,
              backgroundSize: element.properties.backgroundSize || "contain",
              backgroundPosition:
                element.properties.backgroundPosition || "center",
              backgroundRepeat: "no-repeat",
            }
          : {
              backgroundColor: element.properties.backgroundColor || "#e5e7eb",
            };

        return (
          <div
            key={element.id}
            {...shapeProps}
            {...dropProps}
            style={{
              ...(shapeProps.style || interactiveStyle),
              ...backgroundStyle,
              border: isSelected
                ? "2px solid #3b82f6"
                : `${element.properties.borderWidth || 1}px solid ${
                    element.properties.borderColor || "#d1d5db"
                  }`,
            }}
          />
        );

      // Add these cases in your switch statement
      case "icon-minimize":
      case "icon-maximize":
      case "icon-close":
      case "icon-settings":
      case "icon-refresh":
      case "icon-info":
      case "icon-help":
      case "icon-search":
      case "ICON_MINIMIZE":
      case "ICON_MAXIMIZE":
      case "ICON_CLOSE":
      case "ICON_SETTINGS":
      case "ICON_REFRESH":
      case "ICON_INFO":
      case "ICON_HELP":
      case "ICON_SEARCH": {
        const iconSize = Math.min(element.width, element.height) * 0.6;
        const iconColor = element.properties?.color || "#000000";
        const strokeWidth = element.properties?.strokeWidth || 2;

        return (
          <div
            key={element.id}
            style={{
              ...interactiveStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: mode === "preview" ? "pointer" : "default",
            }}
            {...dropProps}
            onClick={mode === "preview" ? undefined : handleClick}
            onDoubleClick={isInPreviewMode ? undefined : handleDoubleClick}
            onMouseDown={isInPreviewMode ? undefined : handleMouseDown}
          >
            {renderIcon(element.type, iconSize, iconColor, strokeWidth)}
          </div>
        );
      }
    }
  };

  // Determine if we should show editor chrome
  const showEditorChrome = mode === "edit";

  return (
    <div
      ref={canvasRef}
      className={`relative overflow-hidden ${
        mode === "preview" ? "runtime-reset" : ""
      }`}
      style={{
        // Canvas dimensions
        width: canvasWidth,
        height: canvasHeight,
        // NEVER scale/translate in preview mode
        transform:
          mode === "edit" && canvasTransform
            ? `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`
            : "none",
        pointerEvents: "auto",
      }}
      tabIndex={0}
    >
      {/* Form group backgrounds - show in edit mode only */}
      {mode === "edit" && formGroups && formGroups.length > 0 && (
        <>
          {formGroups
            .filter((group) => group.type === "form")
            .map((formGroup) => {
              const groupElements = elements.filter((el) =>
                formGroup.elementIds.includes(el.id)
              );
              if (groupElements.length === 0) return null;

              const minX = Math.min(...groupElements.map((el) => el.x));
              const minY = Math.min(...groupElements.map((el) => el.y));
              const maxX = Math.max(
                ...groupElements.map((el) => el.x + el.width)
              );
              const maxY = Math.max(
                ...groupElements.map((el) => el.y + el.height)
              );

              return (
                <div
                  key={formGroup.id}
                  className="absolute pointer-events-none border-2 border-dashed border-blue-400 bg-blue-50/20 rounded-lg"
                  style={{
                    left: minX - 10,
                    top: minY - 30,
                    width: maxX - minX + 20,
                    height: maxY - minY + 40,
                    zIndex: -1,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    📝 {formGroup.name}
                  </div>
                </div>
              );
            })}
        </>
      )}

      {elements
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((element) => renderElement(element))}

      {/* Portal fallback for password toggle buttons (fixed positioned) */}
  {typeof window !== "undefined" && canvasRef.current && canvasReady &&
        elements
          .filter((el) =>
            (el.type || "").toString().toLowerCase().includes("password")
          )
          .map((el) => {
            const show = !!showPasswordMap[el.id];
            try {
              const rect = canvasRef.current!.getBoundingClientRect();
              const left = rect.left + (el.x || 0) + (el.width || 0) - 32 - window.scrollX;
              const top = rect.top + (el.y || 0) + (el.height || 0) / 2 - 12 - window.scrollY;

              const button = (
                <button
                  key={`portal-toggle-${el.id}`}
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleShowPassword(el.id);
                  }}
                  style={{
                    position: "fixed",
                    left: `${left}px`,
                    top: `${top}px`,
                    background: "rgba(255,255,255,0.8)",
                    border: "none",
                    padding: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    zIndex: 9999999,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  {show ? (
                    <EyeOff size={16} color={el.properties?.iconColor || "#6b7280"} />
                  ) : (
                    <Eye size={16} color={el.properties?.iconColor || "#6b7280"} />
                  )}
                </button>
              );

              return ReactDOM.createPortal(button, document.body);
            } catch (e) {
              return null;
            }
          })}

      {/* Editor-only overlays - only show in edit mode */}
      {showEditorChrome && (
        <>
          {/* Selection overlays, guides, handles would go here */}
          {/* These are typically rendered by parent components */}
        </>
      )}
    </div>
  );
};

// Helper function to get input type
const getInputType = (elementType: string): string => {
  const typeMap: Record<string, string> = {
    phone: "tel",
    password: "password",
    PHONE_FIELD: "tel",
    EMAIL_FIELD: "email",
    PASSWORD_FIELD: "password",
    NUMBER_FIELD: "number",
  };
  return typeMap[elementType] || "text";
};

export default CanvasRenderer;
