/**
 * Unified Style Mapping for Runtime Rendering
 *
 * This module provides a single source of truth for converting CanvasElement
 * properties to React CSS styles. Used by both Editor preview and Run App
 * to ensure visual parity.
 */

import { CanvasElement } from "@/components/canvas/ElementManager";

export interface RuntimeStyleOptions {
  /**
   * Whether to include editor-specific styles (selection borders, etc.)
   */
  includeEditorStyles?: boolean;

  /**
   * Whether the element is selected (only relevant in edit mode)
   */
  isSelected?: boolean;
}

/**
 * Convert a CanvasElement to runtime CSS styles
 *
 * This function maps all style properties from the element's properties.style
 * and properties objects to valid CSS properties, ensuring consistency
 * between editor preview and runtime rendering.
 */
export function toRuntimeStyle(
  el: CanvasElement,
  options: RuntimeStyleOptions = {}
): React.CSSProperties {
  const { includeEditorStyles = false, isSelected = false } = options;

  // Extract style properties from nested structure
  const st = el.properties?.style ?? {};
  const p = el.properties ?? {};

  // Border width handling
  const borderW = Number(st.borderWidth ?? p.borderWidth ?? 0);

  // Base positioning and dimensions
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation ?? 0}deg)`,
    opacity: st.opacity ?? (el.opacity ?? 100) / 100,
    zIndex: el.zIndex ?? 1,
    boxSizing: "border-box",
  };

  // Background and border styles
  const visualStyle: React.CSSProperties = {
    background:
      st.background ?? st.fillColor ?? p.backgroundColor ?? "transparent",
    borderStyle: borderW > 0 ? "solid" : "none",
    borderWidth: borderW,
    borderColor: st.borderColor ?? p.borderColor ?? "transparent",
    borderRadius: st.borderRadius ?? p.borderRadius ?? 0,
    boxShadow: st.boxShadow ?? st.shadow ?? p.boxShadow ?? "none",
  };

  // Typography styles
  const textStyle: React.CSSProperties = {
    color: st.textColor ?? st.color ?? p.color ?? "#111",
    fontFamily:
      st.fontFamily ?? p.fontFamily ?? "Poppins, system-ui, sans-serif",
    fontWeight: st.fontWeight ?? p.fontWeight ?? 400,
    fontSize: st.fontSize ?? p.fontSize ?? 14,
    lineHeight: st.lineHeight ? `${st.lineHeight}px` : p.lineHeight ?? "1.2",
    textAlign: (st.textAlign ?? p.textAlign ?? "left") as any,
  };

  // Layout and interaction styles
  const layoutStyle: React.CSSProperties = {
    padding: st.padding ?? p.padding ?? "8px 10px",
    overflow: st.overflow ?? p.overflow ?? "visible",
    outline: "none",
  };

  // Interaction states
  const isDisabled = st.disabled ?? p.disabled ?? false;
  const interactionStyle: React.CSSProperties = {
    pointerEvents: isDisabled ? "none" : "auto",
    cursor: isDisabled
      ? "not-allowed"
      : el.type === "BUTTON"
      ? "pointer"
      : "default",
  };

  // Combine all styles
  let finalStyle: React.CSSProperties = {
    ...baseStyle,
    ...visualStyle,
    ...textStyle,
    ...layoutStyle,
    ...interactionStyle,
  };

  // Add editor-specific styles if requested
  if (includeEditorStyles) {
    if (isSelected) {
      // For selected elements, add selection border as outline instead of overriding border
      finalStyle.outline = "3px solid #3b82f6";
      finalStyle.outlineOffset = "-3px";
      finalStyle.boxShadow = "0 0 0 1px rgba(59, 130, 246, 0.3)";
    }
    // Don't override border in edit mode - preserve element's actual border styling
    finalStyle.cursor = "move";
  }

  return finalStyle;
}

/**
 * Get a hash of the element's visual properties for debugging
 */
export function getStyleHash(el: CanvasElement): string {
  const st = el.properties?.style ?? {};
  const p = el.properties ?? {};

  return JSON.stringify({
    bg: st.background ?? p.backgroundColor,
    border: `${st.borderWidth ?? 0}px ${st.borderColor ?? "none"}`,
    radius: st.borderRadius ?? 0,
    shadow: st.boxShadow ?? "none",
    color: st.textColor ?? p.color,
    font: `${st.fontSize ?? 14}px ${st.fontFamily ?? "Poppins"}`,
    opacity: st.opacity ?? el.opacity ?? 100,
  });
}

/**
 * Log element rendering for debugging
 */
export function logElementRender(
  el: CanvasElement,
  context: "editor" | "preview" | "runtime"
): void {
  if (process.env.NODE_ENV === "production") return;

  console.debug(`[${context.toUpperCase()}:RENDER]`, {
    id: el.id,
    type: el.type,
    position: { x: el.x, y: el.y },
    size: { w: el.width, h: el.height },
    styleHash: getStyleHash(el),
    zIndex: el.zIndex,
    rotation: el.rotation,
  });
}
