import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types for preview snapshot
export interface PreviewElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  pageId: string;
  groupId?: string;
  properties: Record<string, any>;
}

export interface PreviewPage {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  canvasBackground: {
    color?: string;
    image?: string;
    type?: "color" | "image" | "gradient";
  };
  elements: PreviewElement[];
}

export interface PreviewSnapshot {
  appId: string;
  pages: PreviewPage[];
  currentPageId: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    zoom?: number;
    snapToGrid?: boolean;
  };
}

/**
 * Phase 1: Get preview snapshot from backend API
 * Returns the exact canvas JSON used by the editor with absolute element frames
 * Strips editor-only fields like selection state, drag handles, etc.
 */
export async function getPreviewSnapshot(
  appId: string
): Promise<PreviewSnapshot> {
  try {
    const token = localStorage.getItem("authToken") || "";

    // Fetch canvas data with preview flag to bypass auth if needed
    const response = await fetch(`/api/canvas/${appId}?preview=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch canvas data: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error("Invalid canvas data response");
    }

    // Parse canvas state
    let canvasState;
    const rawCanvasState = data.data.canvasState;

    if (typeof rawCanvasState === "string") {
      canvasState = JSON.parse(rawCanvasState);
    } else {
      canvasState = rawCanvasState;
    }

    if (!canvasState || !canvasState.pages) {
      throw new Error("No pages found in canvas state");
    }

    // Strip editor-only fields and normalize data
    const cleanPages: PreviewPage[] = canvasState.pages.map((page: any) => ({
      id: page.id,
      name: page.name,
      canvasWidth: page.canvasWidth || 1200,
      canvasHeight: page.canvasHeight || 800,
      canvasBackground: {
        color: page.canvasBackground?.color || "#ffffff",
        image: page.canvasBackground?.image,
        type: page.canvasBackground?.type || "color",
      },
      elements: (page.elements || []).map((element: any) => ({
        id: element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation || 0,
        opacity: element.opacity || 100,
        zIndex: element.zIndex || 0,
        pageId: element.pageId || page.id,
        groupId: element.groupId,
        properties: {
          ...element.properties,
          // Strip editor-only properties
          isSelected: undefined,
          isDragging: undefined,
          isResizing: undefined,
          showHandles: undefined,
          isHovered: undefined,
        },
      })),
    }));

    const snapshot: PreviewSnapshot = {
      appId,
      pages: cleanPages,
      currentPageId: canvasState.currentPageId || cleanPages[0]?.id || "",
      canvas: {
        width: canvasState.canvas?.width || 1200,
        height: canvasState.canvas?.height || 800,
        backgroundColor: canvasState.canvas?.backgroundColor || "#ffffff",
        zoom: 1, // Always 1 for preview, ignore editor zoom
        snapToGrid: false, // Not relevant for preview
      },
    };

    console.log("📸 PREVIEW SNAPSHOT: Generated snapshot", {
      appId,
      pagesCount: snapshot.pages.length,
      currentPageId: snapshot.currentPageId,
      totalElements: snapshot.pages.reduce(
        (sum, page) => sum + page.elements.length,
        0
      ),
    });

    return snapshot;
  } catch (error) {
    console.error("❌ PREVIEW SNAPSHOT: Error generating snapshot", error);

    // Fallback snapshot for development
    const fallbackSnapshot: PreviewSnapshot = {
      appId,
      pages: [
        {
          id: "page-1",
          name: "Page 1",
          canvasWidth: 1200,
          canvasHeight: 800,
          canvasBackground: { color: "#ffffff", type: "color" },
          elements: [],
        },
      ],
      currentPageId: "page-1",
      canvas: {
        width: 1200,
        height: 800,
        backgroundColor: "#ffffff",
        zoom: 1,
        snapToGrid: false,
      },
    };

    console.warn("⚠️ PREVIEW SNAPSHOT: Using fallback snapshot");
    return fallbackSnapshot;
  }
}
