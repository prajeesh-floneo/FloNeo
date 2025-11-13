"use client";

import React, { useState } from "react";
import { CanvasElement } from "./ElementManager";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import { toRuntimeStyle, logElementRender } from "@/runtime/styleMap";
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
}
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
}) => {
  const { isPreviewMode } = useCanvasWorkflow();

  // Determine if we're in preview mode - either from prop or context
  const isInPreviewMode = mode === "preview" || readOnly || isPreviewMode;

  // Runtime state for form values
  const [values, setValues] = useState<Record<string, any>>({});

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
        onEvent?.(element.id, "click", { element, event: e });
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
            style={style}
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
          />
        );

      case "TEXT_AREA":
      case "textarea":
        return (
          <textarea
            key={element.id}
            style={style}
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
          />
        );

      case "DROPDOWN":
        return (
          <select
            key={element.id}
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
                  ? (e) => handleValueChange(element.id, e.target.checked)
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
                  ? (e) => handleValueChange(element.id, e.target.checked)
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
        };

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
            readOnly={mode === "edit" && !isInPreviewMode}
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
      case "image":
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
            {element.properties.src ? (
              <img
                src={element.properties.src}
                alt={element.properties.alt || "Image"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span style={{ color: "#6b7280", fontSize: "14px" }}>
                No image
              </span>
            )}
          </div>
        );

      case "VIDEO":
      case "video":
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
            {element.properties.src ? (
              <video
                src={element.properties.src}
                controls
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

      case "AUDIO":
      case "audio":
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
            {element.properties.src ? (
              <audio
                src={element.properties.src}
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

      case "MEDIA":
      case "media":
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
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            {...dropProps}
          >
            {element.properties.src ? (
              <>
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
                >
                  {element.properties.fileName || "File"}
                </span>
              </>
            ) : (
              <span style={{ color: "#6b7280", fontSize: "14px" }}>
                No file
              </span>
            )}
          </div>
        );

      case "SHAPE":
      default:
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
    }
  };

  // Determine if we should show editor chrome
  const showEditorChrome = mode === "edit";

  return (
    <div
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
