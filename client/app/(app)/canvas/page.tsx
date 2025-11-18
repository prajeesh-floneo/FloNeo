"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, uploadFile } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import { useRouter as useNextRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ElementToolbar } from "@/components/element-toolbar";
import { PropertiesPanel } from "@/components/properties-panel";
import Image from "next/image";
import {
  X,
  ArrowLeft,
  Save,
  Play,
  Settings,
  Workflow,
  Database,
  Plus,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer,
  Hand,
  Type,
  Square,
  Circle,
  ImageIcon,
  Calendar,
  Phone,
  CheckSquare,
  ToggleLeft,
  Upload,
  ChevronDown,
  Triangle,
  Minus,
  ArrowRight,
  Star,
  Heart,
  Layers,
  Lock,
  // Icon elements
  Minimize2,
  Maximize2,
  RefreshCw,
  Info,
  HelpCircle,
  Search,
  Edit,
  Trash2,
  Download,
  Home,
  LayoutGrid,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublishModal } from "@/components/publish-modal";
import DatabaseTab from "@/components/canvas/database-tab";
import ChartElement from "@/components/canvas/ChartElement";

interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, any>;
  rotation: number;
  opacity: number;
  pageId: string;
  zIndex: number;
  name?: string;
  groupId?: string; // Added groupId for element grouping
}

interface ElementGroup {
  id: string;
  name: string;
  elementIds: string[];
  collapsed: boolean;
  type: "regular" | "form"; // NEW: Add type field for form groups
  properties?: {
    submitButtonId?: string; // Which button triggers form submission
    formName?: string; // Custom form name
  };
}

interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
  groups: ElementGroup[]; // Added groups array to page
  visible: boolean;
  canvasBackground: {
    type: "color" | "gradient" | "image";
    color?: string;
    gradient?: {
      type: "linear" | "radial";
      colors: string[];
      direction?: string;
    };
    image?: {
      url: string;
      size: "cover" | "contain" | "repeat";
      position: string;
    };
  };
  canvasWidth?: number; // Added canvasWidth
  canvasHeight?: number; // Added canvasHeight
}

function CanvasPageContent() {
  console.log("🎨 CanvasPage component is rendering");

  // IMMEDIATE TEST - This will show if the component is actually rendering
  if (typeof window !== "undefined") {
    console.log(
      "🚨 BROWSER ENVIRONMENT DETECTED - Component is rendering in browser"
    );
  }

  const router = useRouter();
  const nextRouter = useNextRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const {
    selectedElementId,
    setSelectedElementId,
    linkElementToWorkflow,
    setPages: setContextPages,
    workflows,
    setWorkflows,
    isPreviewMode,
    setIsPreviewMode,
    currentAppId: contextAppId,
    setCanvasElements,
    setFormGroups,
    setSaveCanvasWorkflow,
  } = useCanvasWorkflow();
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(
    null
  );
  const [selectedElements, setSelectedElements] = useState<CanvasElement[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ElementGroup | null>(null); // Added selectedGroup state
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });

  // Panel visibility states
  const [isLeftPanelHidden, setIsLeftPanelHidden] = useState(false);
  const [isRightPanelHidden, setIsRightPanelHidden] = useState(false);

  // Split-screen mode detection
  const [isSplitScreenMode, setIsSplitScreenMode] = useState(false);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState("");
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<
    { pages: Page[]; currentPageId: string }[]
  >([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pages, setPages] = useState<Page[]>([
    {
      id: "page-1",
      name: "Page 1",
      elements: [],
      groups: [], // Initialize groups array
      visible: true,
      canvasBackground: {
        type: "color",
        color: "#ffffff",
      },
      canvasWidth: 1200, // Default canvas width
      canvasHeight: 800, // Default canvas height
    },
  ]);
  const [currentPageId, setCurrentPageId] = useState("page-1");
  const [expandedPages, setExpandedPages] = useState<Set<string>>(
    new Set(["page-1"])
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState("");
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [appName, setAppName] = useState("Untitled App");
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [canvasTransform, setCanvasTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // Per-element show-password state for password fields in the canvas
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  // Single dismissible prompt for user-facing messages. Use showPrompt(message) to display.
  const [inlinePrompt, setInlinePrompt] = useState<string | null>(null);
  const showPrompt = useCallback((message: string) => {
    // Replace any existing prompt with the new one (ensures only one is visible)
    setInlinePrompt(message);
  }, []);
  const [showCanvasProperties, setShowCanvasProperties] = useState(false);
  const [canvasMode, setCanvasMode] = useState<"select" | "pan" | "text">(
    "select"
  );
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [currentView, setCurrentView] = useState<"canvas" | "database">(
    "canvas"
  );

  // Auto-save state management
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRetryCountRef = useRef(0);
  const lastSavedStateRef = useRef<string>("");
  const maxRetries = 3;

  const currentPage = pages.find((p) => p.id === currentPageId);
  const canvasElements = currentPage?.elements || [];
  const currentGroups = currentPage?.groups || []; // Get current groups

  // Register function once on mount
  useEffect(() => {
    setSaveCanvasWorkflow?.(() => saveCanvasToBackend);
  }, [setSaveCanvasWorkflow]);

  // Sync canvas elements to context for workflow blocks
  useEffect(() => {
    setCanvasElements(canvasElements);
    console.log(
      "🔄 Canvas: Synced canvas elements to context:",
      canvasElements.length
    );
  }, [canvasElements, setCanvasElements]);

  // Sync form groups to context for OnSubmit workflow blocks
  useEffect(() => {
    const formGroupsOnly = currentGroups.filter(
      (group) => group.type === "form"
    );
    setFormGroups(formGroupsOnly);
    console.log(
      "📝 Canvas: Synced form groups to context:",
      formGroupsOnly.length,
      "form groups"
    );

    // Dispatch custom event to notify workflow builder of form group updates
    const event = new CustomEvent("formGroupsUpdated", {
      detail: formGroupsOnly,
    });
    window.dispatchEvent(event);
  }, [currentGroups, setFormGroups]);

  // Sync pages with Canvas-Workflow context (ALWAYS sync, even if empty)
  useEffect(() => {
    const contextPages = pages.map((page) => ({
      id: page.id,
      name: page.name,
      elements: page.elements,
      groups: page.groups,
      canvasWidth: page.canvasWidth,
      canvasHeight: page.canvasHeight,
    }));
    setContextPages(contextPages);
    console.log(
      "🔄 Canvas: Synced pages to context:",
      contextPages.length,
      "pages",
      contextPages.map((p) => p.name)
    );

    // Also update document title for debugging
    if (typeof window !== "undefined") {
      document.title = `Canvas - ${contextPages.length} pages: ${contextPages
        .map((p) => p.name)
        .join(", ")}`;
    }
  }, [pages, setContextPages]);

  // Force sync pages to context on component mount (for workflow integration)
  useEffect(() => {
    console.log("🔄 Canvas: Component mounted, forcing pages sync to context");
    const contextPages = pages.map((page) => ({
      id: page.id,
      name: page.name,
      elements: page.elements,
      groups: page.groups,
      canvasWidth: page.canvasWidth,
      canvasHeight: page.canvasHeight,
    }));
    setContextPages(contextPages);
    console.log(
      "✅ Canvas: Force synced pages to context:",
      contextPages.length,
      "pages",
      contextPages.map((p) => p.name)
    );

    // Also force save to backend to ensure workflow builder can access latest pages
    if (pages.length > 0) {
      console.log(
        "🔄 Canvas: Force saving pages to backend for workflow integration"
      );
      manualSave();
    }
  }, []); // Run once on mount

  // Map backend element types to frontend types
  const mapBackendElementType = (backendType: string): string => {
    const typeMap: { [key: string]: string } = {
      TEXT_FIELD: "text",
      TEXT_AREA: "textarea",
      BUTTON: "button",
      DROPDOWN: "dropdown",
      CHECKBOX: "checkbox",
      RADIO_BUTTON: "radio",
      PHONE_FIELD: "phone",
      TOGGLE: "toggle",
      DATE_PICKER: "date",
      IMAGE: "image",
      UPLOAD_MEDIA: "upload",
      ADD_MEDIA: "media",
      SHAPE: "rectangle", // Default shape to rectangle
      // Icon mappings
      ICON: "icon-minimize", // Default icon type
      ICON_MINIMIZE: "icon-minimize",
      ICON_MAXIMIZE: "icon-maximize",
      ICON_CLOSE: "icon-close",
      ICON_SETTINGS: "icon-settings",
      ICON_REFRESH: "icon-refresh",
      ICON_INFO: "icon-info",
      ICON_HELP: "icon-help",
      ICON_SEARCH: "icon-search",
      CHART_BAR: "chart-bar",
      CHART_LINE: "chart-line",
      CHART_PIE: "chart-pie",
      CHART_DONUT: "chart-donut",
      CHART_KPI_CARD: "kpi-card",
      TABLE: "table",
      MATRIX_CHART: "matrix-chart",
    };
    return typeMap[backendType] || "rectangle";
  };

  // Canvas persistence functions
  const loadCanvasFromBackend = useCallback(
    async (appId: string) => {
      try {
        console.log("🔄 Loading canvas from backend for app:", appId);
        const response = await authenticatedFetch(`/api/canvas/${appId}`);

        if (!response.ok) {
          console.warn(`⚠️ Failed to load canvas: ${response.status}`);
          return false;
        }

        const result = await response.json();

        if (result.success && result.data) {
          const canvas = result.data;
          console.log("✅ Canvas loaded from backend:", canvas);

          // Try to parse pages from canvasState
          let loadedPages: Page[] = [];

          try {
            if (canvas.canvasState && typeof canvas.canvasState === "string") {
              const parsedState = JSON.parse(canvas.canvasState);
              if (parsedState.pages && Array.isArray(parsedState.pages)) {
                loadedPages = parsedState.pages;
                console.log(
                  "📄 Full pages loaded:",
                  JSON.stringify(loadedPages)
                );
              }
            } else if (
              canvas.canvasState &&
              typeof canvas.canvasState === "object" &&
              canvas.canvasState.pages
            ) {
              loadedPages = canvas.canvasState.pages;
              console.log("📄 Full pages loaded:", JSON.stringify(loadedPages));
            }
          } catch (parseError) {
            console.error("❌ Error parsing canvas state:", parseError);
          }

          // Validate loaded pages
          if (loadedPages.length > 0) {
            const validPages = loadedPages.filter(
              (page) =>
                page &&
                typeof page === "object" &&
                page.id &&
                page.name &&
                Array.isArray(page.elements)
            );

            if (validPages.length > 0) {
              console.log(
                `✅ ${validPages.length} valid pages found, setting pages state`
              );
              console.log(
                "📋 Loaded pages and generated tabs:",
                validPages.map((p) => ({
                  id: p.id,
                  name: p.name,
                  elements: p.elements.length,
                }))
              );

              // Set pages state first
              setPages(validPages);

              // Immediately sync to context for workflow integration
              const contextPages = validPages.map((page) => ({
                id: page.id,
                name: page.name,
                elements: page.elements,
                groups: page.groups,
                canvasWidth: page.canvasWidth,
                canvasHeight: page.canvasHeight,
              }));
              setContextPages(contextPages);
              console.log(
                "🚀 Canvas: IMMEDIATE sync to context after backend load:",
                contextPages.length,
                "pages",
                contextPages.map((p) => p.name)
              );

              // Set current page to first page or maintain current if exists
              const firstPageId = validPages[0].id;
              const currentExists = validPages.some(
                (p) => p.id === currentPageId
              );
              if (!currentExists) {
                console.log(`🔄 Switching to first page: ${firstPageId}`);
                setCurrentPageId(firstPageId);
              } else {
                console.log(
                  `✅ Current page ${currentPageId} exists, keeping it active`
                );
              }

              // Generate tabs dynamically from pages - this makes all tabs visible
              const pageIds = validPages.map((p) => p.id);
              console.log("🏷️ Setting expanded pages (tabs):", pageIds);
              setExpandedPages(new Set(pageIds));

              // Force a re-render to ensure tabs appear
              setTimeout(() => {
                console.log(
                  "🔄 Force refresh - pages state:",
                  validPages.length,
                  "expanded pages:",
                  pageIds.length
                );
              }, 100);

              return true;
            } else {
              console.warn(
                "⚠️ No valid pages found in loaded data, falling back to legacy format"
              );
            }
          } else {
            console.log(
              "ℹ️ No pages found in canvasState, checking for legacy format"
            );
          }

          // Fallback: Convert legacy single-page format
          console.log(
            "📊 Backend elements found (legacy format):",
            canvas.elements?.length || 0
          );
          const convertedElements =
            canvas.elements?.map((element: any) => ({
              id: element.elementId,
              type: mapBackendElementType(element.type),
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              rotation: element.rotation,
              opacity: element.styles?.opacity || 100,
              zIndex: element.zIndex,
              pageId: currentPageId,
              groupId: element.groupId,
              properties: {
                ...element.properties,
                locked: element.locked,
                hidden: !element.visible,
                backgroundColor: element.styles?.backgroundColor,
                color: element.styles?.color,
                fontSize: element.styles?.fontSize,
                fontWeight: element.styles?.fontWeight,
                textAlign: element.styles?.textAlign,
                borderRadius: element.styles?.borderRadius,
                borderWidth: element.styles?.borderWidth,
                borderColor: element.styles?.borderColor,
              },
            })) || [];

          console.log(
            "🔄 Converted elements (legacy):",
            convertedElements.length
          );

          // Update the current page with loaded elements (legacy support)
          setPages((prev) =>
            prev.map((page) =>
              page.id === currentPageId
                ? {
                    ...page,
                    elements: convertedElements,
                    canvasBackground: canvas.background
                      ? {
                          type: "color" as const,
                          color: canvas.background.color || "#ffffff",
                        }
                      : page.canvasBackground,
                    canvasWidth: canvas.width || 1200,
                    canvasHeight: canvas.height || 800,
                  }
                : page
            )
          );

          return true;
        }
      } catch (error) {
        console.error("❌ Failed to load canvas from backend:", error);
        return false;
      }
    },
    [currentPageId]
  );

  // Map frontend element types to backend enum values
  const mapElementType = (frontendType: string): string => {
    const typeMap: { [key: string]: string } = {
      text: "TEXT_FIELD",
      TEXT_FIELD: "TEXT_FIELD",
      textarea: "TEXT_AREA",
      TEXT_AREA: "TEXT_AREA",
      button: "BUTTON",
      BUTTON: "BUTTON",
      dropdown: "DROPDOWN",
      DROPDOWN: "DROPDOWN",
      select: "DROPDOWN",
      checkbox: "CHECKBOX",
      CHECKBOX: "CHECKBOX",
      radio: "RADIO_BUTTON",
      RADIO_BUTTON: "RADIO_BUTTON",
      phone: "PHONE_FIELD",
      PHONE_FIELD: "PHONE_FIELD",
      toggle: "TOGGLE",
      TOGGLE: "TOGGLE",
      date: "DATE_PICKER",
      DATE_PICKER: "DATE_PICKER",
      image: "IMAGE",
      IMAGE: "IMAGE",
      upload: "UPLOAD_MEDIA",
      UPLOAD_MEDIA: "UPLOAD_MEDIA",
      media: "ADD_MEDIA",
      ADD_MEDIA: "ADD_MEDIA",
      rectangle: "SHAPE",
      circle: "SHAPE",
      shape: "SHAPE",
      SHAPE: "SHAPE",
      // Icon mappings
      "icon-minimize": "ICON_MINIMIZE",
      "icon-maximize": "ICON_MAXIMIZE",
      "icon-close": "ICON_CLOSE",
      "icon-settings": "ICON_SETTINGS",
      "icon-refresh": "ICON_REFRESH",
      "icon-info": "ICON_INFO",
      "icon-help": "ICON_HELP",
      "icon-search": "ICON_SEARCH",
    };
    return (
      typeMap[frontendType] || typeMap[frontendType.toLowerCase()] || "SHAPE"
    );
  };

  const loadTemplateStructure = useCallback(
    async (templateId: string) => {
      try {
        console.log("🎨 Loading template structure:", templateId);
        const response = await authenticatedFetch(
          `/api/templates/${templateId}`
        );
        const templateData = await response.json();

        console.log("📊 Template response:", templateData);

        if (templateData.success && templateData.data.template.structure) {
          const structure = templateData.data.template.structure;
          const templateElements = structure.elements || [];

          console.log("🔍 Template structure found:", {
            elementsCount: templateElements.length,
            hasCanvasBackground: !!structure.canvasBackground,
            firstElement: templateElements[0],
          });

          // Update the current page with template elements
          setPages((prevPages) => {
            const updatedPages = [...prevPages];
            const currentPageIndex = updatedPages.findIndex(
              (p) => p.id === currentPageId
            );

            if (currentPageIndex >= 0) {
              updatedPages[currentPageIndex] = {
                ...updatedPages[currentPageIndex],
                elements: templateElements.map((el: any, index: number) => ({
                  ...el,
                  pageId: currentPageId,
                  zIndex: el.zIndex !== undefined ? el.zIndex : index,
                })),
                canvasBackground: structure.canvasBackground || {
                  type: "color",
                  color: "#ffffff",
                },
                canvasWidth: structure.canvasWidth || 1200,
                canvasHeight: structure.canvasHeight || 800,
              };
            }

            return updatedPages;
          });

          console.log(
            "✅ Template structure loaded:",
            templateElements.length,
            "elements"
          );

          // Force a re-render by updating a state
          setSelectedElement(null);

          // Add a test element to verify canvas is working
          console.log("🧪 Adding test element to verify canvas functionality");
          setPages((prevPages) => {
            const updatedPages = [...prevPages];
            const currentPageIndex = updatedPages.findIndex(
              (p) => p.id === currentPageId
            );

            if (currentPageIndex >= 0) {
              const testElement = {
                id: "test-element-" + Date.now(),
                type: "TEXT" as const,
                x: 50,
                y: 50,
                width: 200,
                height: 40,
                zIndex: 999,
                opacity: 100,
                rotation: 0,
                pageId: currentPageId,
                properties: {
                  text: "TEST: Template Loaded!",
                  color: "#ff0000",
                  fontSize: 16,
                  fontWeight: "bold",
                  textAlign: "left",
                  fontFamily: "Arial",
                  backgroundColor: "transparent",
                },
              };

              updatedPages[currentPageIndex] = {
                ...updatedPages[currentPageIndex],
                elements: [
                  ...updatedPages[currentPageIndex].elements,
                  testElement,
                ],
              };
            }

            return updatedPages;
          });
        } else {
          console.log("❌ Template structure not found or invalid response:", {
            success: templateData.success,
            hasTemplate: !!templateData.data?.template,
            hasStructure: !!templateData.data?.template?.structure,
          });
        }
      } catch (error) {
        console.error("❌ Error loading template structure:", error);
      }
    },
    [currentPageId]
  );

  const saveCanvasToBackend = useCallback(
    async (appId: string) => {
      try {
        console.log("💾 Saving canvas to backend for app:", appId);
        console.log("📊 Total pages to save:", pages.length);

        // Serialize the entire pages array with all elements and pageIds
        const pagesWithElements = pages.map((page) => ({
          id: page.id,
          name: page.name,
          elements: page.elements.map((element) => ({
            ...element,
            pageId: page.id, // Ensure pageId matches the page
          })),
          groups: page.groups || [],
          visible: page.visible,
          canvasBackground: page.canvasBackground,
          canvasWidth: page.canvasWidth || 1200,
          canvasHeight: page.canvasHeight || 800,
        }));

        let serializedPages;
        try {
          serializedPages = JSON.stringify(pagesWithElements);
          console.log("📄 Full pages saved:", serializedPages);
        } catch (serializationError) {
          console.error("❌ Serialization failed:", serializationError);
          throw new Error("Failed to serialize pages data");
        }

        const canvasState = {
          name: appName,
          width: currentPage?.canvasWidth || 1200,
          height: currentPage?.canvasHeight || 800,
          background: currentPage?.canvasBackground || { color: "#ffffff" },
          pages: pagesWithElements, // Include full pages array
          // Legacy support: also include current page elements
          elements: canvasElements.map((element) => ({
            id: element.id,
            type: mapElementType(element.type),
            name: element.properties?.text || `${element.type}-${element.id}`,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            rotation: element.rotation,
            opacity: element.opacity,
            zIndex: element.zIndex,
            groupId: element.groupId,
            properties: element.properties,
            pageId: element.pageId,
          })),
        };

        // Validate pages array before saving
        if (
          !Array.isArray(canvasState.pages) ||
          canvasState.pages.length === 0
        ) {
          console.error("❌ Invalid pages array:", canvasState.pages);
          throw new Error("Pages array is empty or invalid");
        }

        console.log(
          "📦 Mapped canvas state with pages:",
          JSON.stringify(canvasState, null, 2)
        );

        const response = await authenticatedFetch(
          `/api/canvas/${appId}/state`,
          {
            method: "PATCH",
            body: JSON.stringify({ canvasState }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to save canvas: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          console.log("✅ Canvas with all pages saved to backend successfully");
          return true;
        } else {
          throw new Error(result.message || "Save failed");
        }
      } catch (error) {
        console.error("❌ Failed to save canvas to backend:", error);
        return false;
      }
    },
    [appName, currentPage, canvasElements, pages]
  );

  // Auto-save functionality with debouncing and error handling
  const triggerAutoSave = useCallback(async () => {
    if (!currentAppId) {
      console.warn("⚠️ No currentAppId for auto-save");
      return;
    }

    try {
      setAutoSaveStatus("saving");
      setAutoSaveError(null);
      console.log(
        "🔄 Auto-save triggered - Elements to save:",
        canvasElements.length
      );

      const success = await saveCanvasToBackend(currentAppId);

      if (success) {
        setAutoSaveStatus("saved");
        autoSaveRetryCountRef.current = 0;

        // Update last saved state
        const currentState = JSON.stringify({ pages, canvasElements });
        lastSavedStateRef.current = currentState;

        // Show "Saved" status for 2 seconds, then hide
        setTimeout(() => {
          setAutoSaveStatus("idle");
        }, 2000);

        console.log("✅ Auto-save completed successfully");
      } else {
        throw new Error("Save operation returned false");
      }
    } catch (error) {
      console.error("❌ Auto-save failed:", error);
      setAutoSaveStatus("error");
      setAutoSaveError(
        error instanceof Error ? error.message : "Auto-save failed"
      );

      // Retry logic
      if (autoSaveRetryCountRef.current < maxRetries) {
        autoSaveRetryCountRef.current++;
        console.log(
          `🔄 Retrying auto-save (attempt ${autoSaveRetryCountRef.current}/${maxRetries})`
        );

        // Exponential backoff: 2s, 4s, 8s
        const retryDelay = Math.pow(2, autoSaveRetryCountRef.current) * 1000;
        setTimeout(() => {
          triggerAutoSave();
        }, retryDelay);
      } else {
        console.error("❌ Auto-save failed after maximum retries");
        // Keep error status visible until next successful save
      }
    }
  }, [currentAppId, canvasElements, pages, saveCanvasToBackend, maxRetries]);

  // Debounced auto-save function
  const debouncedAutoSave = useCallback(() => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Only auto-save if there are actual changes
    const currentState = JSON.stringify({ pages, canvasElements });
    if (currentState === lastSavedStateRef.current) {
      console.log("📝 No changes detected, skipping auto-save");
      return;
    }

    // Set new timeout for auto-save (1.5 seconds of inactivity)
    autoSaveTimeoutRef.current = setTimeout(() => {
      triggerAutoSave();
    }, 1500);

    console.log("⏱️ Auto-save scheduled in 1.5 seconds");
  }, [pages, canvasElements, triggerAutoSave]);

  // Manual save function
  const manualSave = useCallback(() => {
    if (currentAppId) {
      console.log(
        "💾 Manual save triggered - Elements to save:",
        canvasElements.length
      );

      // Cancel any pending auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // Trigger immediate save
      triggerAutoSave();
    } else {
      console.warn("⚠️ No currentAppId for manual save");
    }
  }, [currentAppId, canvasElements, triggerAutoSave]);

  // Initialize last saved state and cleanup on unmount
  useEffect(() => {
    // Initialize the last saved state when pages/elements are first loaded
    if (pages.length > 0 || canvasElements.length > 0) {
      const initialState = JSON.stringify({ pages, canvasElements });
      lastSavedStateRef.current = initialState;
      console.log("📝 Initialized last saved state");
    }

    // Cleanup function to clear timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update last saved state when data is loaded from backend
  useEffect(() => {
    if (pages.length > 0 && lastSavedStateRef.current === "") {
      const currentState = JSON.stringify({ pages, canvasElements });
      lastSavedStateRef.current = currentState;
      console.log("📝 Updated last saved state after data load");
    }
  }, [pages, canvasElements]);

  const saveToHistory = useCallback(() => {
    const newHistoryEntry = {
      pages: JSON.parse(JSON.stringify(pages)),
      currentPageId,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newHistoryEntry);

    // Keep only last 50 history entries
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }

    setHistory(newHistory);
  }, [pages, currentPageId, history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setPages(previousState.pages);
      setCurrentPageId(previousState.currentPageId);
      setHistoryIndex(historyIndex - 1);
      setSelectedElement(null);
      setSelectedElements([]);
      setSelectedGroup(null); // Deselect group on undo
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPages(nextState.pages);
      setCurrentPageId(nextState.currentPageId);
      setHistoryIndex(historyIndex + 1);
      setSelectedElement(null);
      setSelectedElements([]);
      setSelectedGroup(null); // Deselect group on redo
    }
  }, [history, historyIndex]);

  const copyElements = useCallback(() => {
    if (selectedElements.length > 0) {
      setClipboard([...selectedElements]);
    }
  }, [selectedElements]);

  const cutElements = useCallback(() => {
    if (selectedElements.length > 0) {
      setClipboard([...selectedElements]);
      saveToHistory();
      updatePageElements(currentPageId, (prev) =>
        prev.filter(
          (el) => !selectedElements.some((selected) => selected.id === el.id)
        )
      );
      setSelectedElement(null);
      setSelectedElements([]);
    }
  }, [selectedElements, currentPageId, saveToHistory]);

  const pasteElements = useCallback(() => {
    if (clipboard.length > 0) {
      saveToHistory();
      const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);

      const pastedElements = clipboard.map((el, index) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${index}`,
        x: el.x + 20,
        y: el.y + 20,
        zIndex: maxZIndex + index + 1,
        pageId: currentPageId,
      }));

      updatePageElements(currentPageId, (prev) => [...prev, ...pastedElements]);
      setSelectedElements(pastedElements);
      setSelectedElement(pastedElements[0]);
      setShowCanvasProperties(false);
    }
  }, [clipboard, canvasElements, currentPageId, saveToHistory]);

  const selectAllElements = useCallback(() => {
    const visibleElements = canvasElements.filter(
      (el) => !el.properties.hidden
    );
    setSelectedElements(visibleElements);
    setSelectedElement(visibleElements[0] || null);
    setSelectedGroup(null); // Deselect group when selecting all elements
    setShowCanvasProperties(false);
  }, [canvasElements]);

  const deleteSelectedElements = useCallback(() => {
    if (selectedElements.length > 0) {
      saveToHistory();
      updatePageElements(currentPageId, (prev) =>
        prev.filter(
          (el) => !selectedElements.some((selected) => selected.id === el.id)
        )
      );
      setSelectedElement(null);
      setSelectedElements([]);
    }
  }, [selectedElements, currentPageId, saveToHistory]);

  const duplicateSelectedElements = useCallback(() => {
    if (selectedElements.length > 0) {
      saveToHistory();
      const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);

      const duplicatedElements = selectedElements.map((el, index) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${index}`,
        x: el.x + 20,
        y: el.y + 20,
        zIndex: maxZIndex + index + 1,
      }));

      updatePageElements(currentPageId, (prev) => [
        ...prev,
        ...duplicatedElements,
      ]);
      setSelectedElements(duplicatedElements);
      setSelectedElement(duplicatedElements[0]);
    }
  }, [selectedElements, canvasElements, currentPageId, saveToHistory]);

  const moveSelectedElements = useCallback(
    (direction: "up" | "down" | "left" | "right", distance = 1) => {
      if (selectedElements.length === 0) return;

      saveToHistory();
      const updatedElements = selectedElements.map((el) => {
        switch (direction) {
          case "up":
            return { ...el, y: el.y - distance };
          case "down":
            return { ...el, y: el.y + distance };
          case "left":
                return { ...el, x: el.x - distance };
          case "right":
            return { ...el, x: el.x + distance };
          default:
            return el;
        }
      });
      
      setSelectedElements(updatedElements);
      if (selectedElement) {
        const updatedSelected = updatedElements.find(
          (el) => el.id === selectedElement.id
        );
        if (updatedSelected) setSelectedElement(updatedSelected);
      }

      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => {
          const updated = updatedElements.find(
            (updated) => updated.id === el.id
          );
          return updated || el;
        })
      );
    },
    [selectedElements, selectedElement, currentPageId, saveToHistory]
  );

  const createGroup = useCallback(() => {
    if (selectedElements.length < 2) return;

    saveToHistory();
    const groupId = `group-${Date.now()}`;
    const groupName = `Group ${currentGroups.length + 1}`;

    const newGroup: ElementGroup = {
      id: groupId,
      name: groupName,
      elementIds: selectedElements.map((el) => el.id),
      collapsed: false,
      type: "regular", // Default to regular group
    };

    // Update elements to include groupId
    const updatedElements = selectedElements.map((el) => ({ ...el, groupId }));

    setPages((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? {
              ...page,
              groups: [...page.groups, newGroup],
              elements: page.elements.map((el) => {
                const updated = updatedElements.find(
                  (updated) => updated.id === el.id
                );
                return updated || el;
              }),
            }
          : page
      )
    );

    setSelectedGroup(newGroup);
    setSelectedElement(null);
    setSelectedElements([]);
  }, [selectedElements, currentGroups, currentPageId, saveToHistory]);

  // NEW: Create form group function
  const createFormGroup = useCallback(() => {
    if (selectedElements.length < 2) return;

    // Check if we have at least one form field (not just buttons)
    const hasFormFields = selectedElements.some((el) =>
      [
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
        "FILE_UPLOAD",
        "UPLOAD",
        "ADDFILE",
      ].includes(el.type)
    );

    if (!hasFormFields) {
      console.warn(
        "📝 [FORM-GROUP] Cannot create form group: No form fields selected"
      );
      return;
    }

    // Prompt user for form name
    const defaultName = `Form ${
      currentGroups.filter((g) => g.type === "form").length + 1
    }`;
    const groupName = prompt("Enter form name:", defaultName);

    if (!groupName || groupName.trim() === "") {
      console.warn("⚠️ [FORM-GROUP] Form name is required");
      return;
    }

    saveToHistory();
    const groupId = `form-group-${Date.now()}`;

    // Separate form fields from buttons
    const formFields = selectedElements.filter(
      (el) => !["BUTTON", "button"].includes(el.type)
    );
    const submitButton = selectedElements.find(
      (el) => el.type === "BUTTON" || el.type === "button"
    );

    console.log("📝 [FORM-GROUP] Separating elements:", {
      totalSelected: selectedElements.length,
      formFields: formFields.length,
      hasSubmitButton: !!submitButton,
      formFieldTypes: formFields.map((el) => el.type),
      submitButtonId: submitButton?.id,
    });

    const newGroup: ElementGroup = {
      id: groupId,
      name: groupName,
      elementIds: formFields.map((el) => el.id), // ONLY form fields, NOT buttons
      collapsed: false,
      type: "form", // Set as form group
      properties: {
        submitButtonId: submitButton?.id, // Button is linked but NOT included in group
        formName: groupName.trim(),
      },
    };

    console.log("🔗 [FORM-GROUP] Button linking details:", {
      submitButtonFound: !!submitButton,
      submitButtonId: submitButton?.id,
      submitButtonType: submitButton?.type,
      formGroupId: groupId,
      linkingStrategy: "submitButtonId property",
    });

    // Update ONLY form fields to include groupId (NOT buttons)
    const updatedElements = formFields.map((el) => ({ ...el, groupId }));

    setPages((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? {
              ...page,
              groups: [...page.groups, newGroup],
              elements: page.elements.map((el) => {
                // Only update form fields with groupId, leave buttons unchanged
                const updated = updatedElements.find(
                  (updated) => updated.id === el.id
                );
                return updated || el;
              }),
            }
          : page
      )
    );

    setSelectedGroup(newGroup);
    setSelectedElement(null);
    setSelectedElements([]);

    console.log("📝 [FORM-GROUP] Created form group:", {
      id: groupId,
      name: groupName,
      formFieldCount: formFields.length,
      submitButtonId: submitButton?.id,
      formFieldIds: formFields.map((el) => el.id),
      formFieldTypes: formFields.map((el) => el.type),
      buttonSeparate: !!submitButton,
    });

    // Trigger auto-save to persist the form group
    console.log("💾 [FORM-GROUP] Triggering auto-save for form group creation");
    debouncedAutoSave();
  }, [selectedElements, currentGroups, currentPageId, saveToHistory]);

  // NEW: Form data collection function
  const collectFormGroupData = useCallback(
    (formGroupId: string, formValues: Record<string, any> = {}) => {
      const formGroup = currentGroups.find(
        (g) => g.id === formGroupId && g.type === "form"
      );
      if (!formGroup) {
        console.warn("📝 [FORM-DATA] Form group not found:", formGroupId);
        return {};
      }

      const formData: Record<string, any> = {};

      // Find all elements in this form group
      const formElements = canvasElements.filter(
        (el) =>
          el.groupId === formGroupId &&
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
          ].includes(el.type)
      );

      console.log(
        "📋 [FORM-DATA] Collecting data from",
        formElements.length,
        "form elements"
      );

      formElements.forEach((element) => {
        // Get value from formValues (runtime state) or element properties (default)
        const value = formValues[element.id] || element.properties?.value || "";

        // Store by element ID
        formData[element.id] = value;

        // Also store by element name if available
        if (element.properties?.name) {
          formData[element.properties.name] = value;
        }

        console.log(
          "📝 [FORM-DATA] Element:",
          element.id,
          "Type:",
          element.type,
          "Value:",
          value
        );
      });

      console.log(
        "📊 [FORM-DATA] Collected form data:",
        Object.keys(formData).length,
        "fields"
      );
      return formData;
    },
    [currentGroups, canvasElements]
  );

  const ungroupElements = useCallback(
    (groupId: string) => {
      saveToHistory();

      setPages((prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                groups: page.groups.filter((g) => g.id !== groupId),
                elements: page.elements.map((el) =>
                  el.groupId === groupId ? { ...el, groupId: undefined } : el
                ),
              }
            : page
        )
      );

      setSelectedGroup(null);
    },
    [currentPageId, saveToHistory]
  );

  const selectGroup = useCallback(
    (groupId: string) => {
      const group = currentGroups.find((g) => g.id === groupId);
      if (!group) return;

      const groupElements = canvasElements.filter(
        (el) => el.groupId === groupId
      );
      setSelectedElements(groupElements);
      setSelectedElement(groupElements[0] || null);
      setSelectedGroup(group);
      setShowCanvasProperties(false);
    },
    [currentGroups, canvasElements]
  );

  const moveGroup = useCallback(
    (groupId: string, deltaX: number, deltaY: number) => {
      const groupElements = canvasElements.filter(
        (el) => el.groupId === groupId
      );

      const updatedElements = groupElements.map((el) => ({
        ...el,
        x: el.x + deltaX,
        y: el.y + deltaY,
      }));

      setSelectedElements(updatedElements);

      // Update the selected element if it's part of the group
      if (selectedElement && selectedElement.groupId === groupId) {
        const updatedSelectedElement = updatedElements.find(
          (el) => el.id === selectedElement.id
        );
        if (updatedSelectedElement) {
          setSelectedElement(updatedSelectedElement);
        }
      }

      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => {
          const updated = updatedElements.find(
            (updated) => updated.id === el.id
          );
          return updated || el;
        })
      );
    },
    [canvasElements, currentPageId, selectedElement]
  );

  const duplicateGroup = useCallback(
    (groupId: string) => {
      const group = currentGroups.find((g) => g.id === groupId);
      const groupElements = canvasElements.filter(
        (el) => el.groupId === groupId
      );

      if (!group || groupElements.length === 0) return;

      saveToHistory();
      const newGroupId = `group-${Date.now()}`;
      const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);

      const duplicatedElements = groupElements.map((el, index) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${index}`,
        x: el.x + 20,
        y: el.y + 20,
        zIndex: maxZIndex + index + 1,
        groupId: newGroupId,
      }));

      const newGroup: ElementGroup = {
        id: newGroupId,
        name: `${group.name} Copy`,
        elementIds: duplicatedElements.map((el) => el.id),
        collapsed: false,
        type: group.type || "regular", // Preserve group type
        properties: group.properties
          ? {
              ...group.properties,
              // Update submit button ID if it's a form group
              submitButtonId: group.properties.submitButtonId
                ? duplicatedElements.find((el) =>
                    el.id.includes(
                      group.properties!.submitButtonId!.split("-")[0]
                    )
                  )?.id
                : undefined,
            }
          : undefined,
      };

      setPages((prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                groups: [...page.groups, newGroup],
                elements: [...page.elements, ...duplicatedElements],
              }
            : page
        )
      );

      setSelectedElements(duplicatedElements);
      setSelectedElement(duplicatedElements[0]);
      setSelectedGroup(newGroup);
    },
    [currentGroups, canvasElements, currentPageId, saveToHistory]
  );

  const switchToPage = useCallback((pageId: string) => {
    setCurrentPageId(pageId);
    setSelectedElement(null);
    setSelectedElements([]);
    setSelectedGroup(null); // Deselect group when switching page
    setShowCanvasProperties(true);
  }, []); // Removed dependencies that cause infinite loops

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Prevent default browser shortcuts for our custom ones
      if (
        cmdOrCtrl &&
        [
          "z",
          "y",
          "c",
          "v",
          "x",
          "a",
          "d",
          "g",
          "u",
          "s",
          "n",
          "f",
          "r",
          "l",
          "h",
          "i",
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }

      // === FILE OPERATIONS ===
      // Save
      if (cmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveApp();
        return;
      }

      // New Page
      if (cmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addNewPage();
        return;
      }

      // === HISTORY OPERATIONS ===
      // Undo
      if (cmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        undo();
        return;
      }
      // Redo
      if (
        cmdOrCtrl &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        redo();
        return;
      }

      // === SELECTION OPERATIONS ===
      // Select All
      if (cmdOrCtrl && e.key.toLowerCase() === "a") {
        selectAllElements();
        return;
      }
      // Escape to deselect
      if (e.key === "Escape") {
        setSelectedElement(null);
        setSelectedElements([]);
        setSelectedGroup(null);
        setShowCanvasProperties(true);
        return;
      }

      // === CLIPBOARD OPERATIONS ===
      // Copy
      if (cmdOrCtrl && e.key.toLowerCase() === "c") {
        copyElements();
        return;
      }
      // Cut
      if (cmdOrCtrl && e.key.toLowerCase() === "x") {
        cutElements();
        return;
      }
      // Paste
      if (cmdOrCtrl && e.key.toLowerCase() === "v") {
        pasteElements();
        return;
      }

      // === ELEMENT OPERATIONS ===
      // Duplicate
      if (cmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedGroup) {
          duplicateGroup(selectedGroup.id);
        } else {
          duplicateSelectedElements();
        }
        return;
      }

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedGroup) {
          ungroupElements(selectedGroup.id);
        } else {
          deleteSelectedElements();
        }
        return;
      }

      // === GROUPING OPERATIONS ===
      // Group elements
      if (cmdOrCtrl && e.key.toLowerCase() === "g" && !e.shiftKey) {
        if (selectedElements.length >= 2) {
          createGroup();
        }
        return;
      }
      // Ungroup elements
      if (cmdOrCtrl && e.key.toLowerCase() === "g" && e.shiftKey) {
        if (selectedGroup) {
          ungroupElements(selectedGroup.id);
        }
        return;
      }

      // === LAYER OPERATIONS ===
      // Bring Forward
      if (cmdOrCtrl && e.key.toLowerCase() === "]" && !e.shiftKey) {
        if (selectedElement) {
          moveElementLayer("up");
        }
        return;
      }
      // Send Backward
      if (cmdOrCtrl && e.key.toLowerCase() === "[" && !e.shiftKey) {
        if (selectedElement) {
          moveElementLayer("down");
        }
        return;
      }
      // Bring to Front
      if (cmdOrCtrl && e.key.toLowerCase() === "]" && e.shiftKey) {
        if (selectedElement) {
          // Move to top layer
          const maxZIndex = Math.max(
            ...canvasElements.map((el) => el.zIndex),
            0
          );
          updateElementTransform("zIndex", maxZIndex + 1);
        }
        return;
      }
      // Send to Back
      if (cmdOrCtrl && e.key.toLowerCase() === "[" && e.shiftKey) {
        if (selectedElement) {
          // Move to bottom layer
          const minZIndex = Math.min(
            ...canvasElements.map((el) => el.zIndex),
            0
          );
          updateElementTransform("zIndex", minZIndex - 1);
        }
        return;
      }

      // === ELEMENT PROPERTIES ===
      // Toggle Lock
      if (cmdOrCtrl && e.key.toLowerCase() === "l") {
        if (selectedElement) {
          toggleElementLock();
        }
        return;
      }
      // Toggle Visibility (Hide/Show)
      if (cmdOrCtrl && e.key.toLowerCase() === "h") {
        if (selectedElement) {
          toggleElementVisibility();
        }
        return;
      }

      // === CANVAS OPERATIONS ===
      // Toggle Preview Mode
      if (cmdOrCtrl && e.key.toLowerCase() === "r") {
        e.preventDefault();
        togglePreviewMode();
        return;
      }
      // Reset Canvas View
      if (cmdOrCtrl && e.key.toLowerCase() === "0") {
        e.preventDefault();
        resetCanvasView();
        return;
      }
      // Zoom In
      if (cmdOrCtrl && e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }
      // Zoom Out
      if (cmdOrCtrl && e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }

      // === MOVEMENT OPERATIONS ===
      // Arrow key movement
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const distance = e.shiftKey ? 10 : 1; // Hold Shift for larger movements
        const direction = e.key.replace("Arrow", "").toLowerCase() as
          | "up"
          | "down"
          | "left"
          | "right";

        if (selectedGroup) {
          let deltaX = 0,
            deltaY = 0;
          switch (direction) {
            case "up":
              deltaY = -distance;
              break;
            case "down":
              deltaY = distance;
              break;
            case "left":
              deltaX = -distance;
              break;
            case "right":
              deltaX = distance;
              break;
          }
          moveGroup(selectedGroup.id, deltaX, deltaY);
        } else {
          moveSelectedElements(direction, distance);
        }
        return;
      }

      // === CANVAS MODE ===
      // Space to cycle through canvas modes
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setCanvasMode((prev) => {
          if (prev === "select") return "pan";
          if (prev === "pan") return "text";
          return "select";
        });
        return;
      }

      // === PAGE OPERATIONS ===
      // Number keys to switch pages
      if (e.key >= "1" && e.key <= "9") {
        const pageIndex = Number.parseInt(e.key) - 1;
        if (pageIndex < pages.length) {
          switchToPage(pages[pageIndex].id);
        }
        return;
      }

      // === SEARCH/FILTER ===
      // Find elements (focus search)
      if (cmdOrCtrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        // You could implement a search/filter functionality here
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Reset pan mode when space is released
      if (e.key === " ") {
        setCanvasMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Handle paste events for file uploads
    const handlePaste = async (e: ClipboardEvent) => {
      if (!canvasRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Get canvas center position
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const x =
              canvasRect.width / 2 / canvasTransform.scale -
              canvasTransform.x / canvasTransform.scale;
            const y =
              canvasRect.height / 2 / canvasTransform.scale -
              canvasTransform.y / canvasTransform.scale;

            // Upload file at canvas center
            await handleFileUpload(file, Math.max(0, x), Math.max(0, y));
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    undo,
    redo,
    copyElements,
    cutElements,
    pasteElements,
    selectAllElements,
    duplicateSelectedElements,
    deleteSelectedElements,
    moveSelectedElements,
    createGroup,
    ungroupElements,
    selectedGroup,
    duplicateGroup,
    moveGroup,
    pages,
    switchToPage,
    selectedElements,
    selectedElement,
    clipboard,
    history,
    historyIndex,
    currentPageId,
    canvasTransform,
  ]);

  useEffect(() => {
    if (pages.length > 0 && history.length === 0) {
      // Initialize history with current state
      setHistory([{ pages: JSON.parse(JSON.stringify(pages)), currentPageId }]);
      setHistoryIndex(0);
    }
  }, [pages, currentPageId, history.length]);

  useEffect(() => {
    const initializeCanvas = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlAppId = urlParams.get("appId");
        const templateId = urlParams.get("templateId");

        // Use context appId if available (for workflow split-screen), otherwise use URL appId
        const appId = contextAppId || urlAppId;

        console.log("🎯 Canvas initialization:", {
          urlAppId,
          contextAppId,
          finalAppId: appId,
          templateId,
        });
        console.log("🔍 Full URL:", window.location.href);
        console.log("🔍 Search params:", window.location.search);

        if (!appId) {
          console.warn("⚠️ No appId provided");
          toast({
            title: "Error",
            description: "No app ID provided. Redirecting to dashboard.",
            variant: "destructive",
          });
          router.push("/dashboard");
          return;
        }

        // Load app data first
        console.log("📱 Loading app:", appId);
        const appResponse = await authenticatedFetch(`/api/apps/${appId}`);
        const appData = await appResponse.json();

        if (!appData.success) {
          throw new Error("Failed to load app data");
        }

        const app = appData.data.app;
        setAppName(app.name);
        setCurrentAppId(app.id);
        console.log("✅ App loaded:", app.name);

        // If templateId is provided, load template structure FIRST
        if (templateId) {
          console.log("🎨 Loading template structure:", templateId);

          // Add visual indicator that template is loading
          if (typeof window !== "undefined") {
            const loadingDiv = document.createElement("div");
            loadingDiv.id = "template-loading";
            loadingDiv.style.cssText =
              "position: fixed; top: 50px; right: 10px; background: #ff6600; color: #fff; padding: 10px; z-index: 9999; font-size: 12px; border-radius: 5px;";
            loadingDiv.innerHTML = "🎨 Loading Template...";
            document.body.appendChild(loadingDiv);
          }

          try {
            console.log(
              "🔑 About to call authenticatedFetch for template:",
              templateId
            );
            const templateResponse = await authenticatedFetch(
              `/api/templates/${templateId}`
            );
            console.log(
              "📡 Template response status:",
              templateResponse.status
            );

            if (!templateResponse.ok) {
              throw new Error(
                `Template API call failed with status: ${templateResponse.status}`
              );
            }

            const templateData = await templateResponse.json();
            console.log("📊 Template response:", templateData);

            if (templateData.success && templateData.data.template.structure) {
              console.log("✅ Template data loaded, applying structure");

              const templateStructure = templateData.data.template.structure;
              console.log(
                "📋 Template structure keys:",
                Object.keys(templateStructure)
              );

              let elementsToApply = [];
              let pageToCreate = null;

              // Handle new format (pages structure)
              if (
                templateStructure.pages &&
                templateStructure.pages.length > 0
              ) {
                console.log("📄 Using new pages format");
                const elementsCount =
                  templateStructure.pages[0].elements.length;
                console.log(
                  `🎨 Found ${elementsCount} template elements in pages format`
                );

                // Apply template structure directly
                setPages(templateStructure.pages);
                setCurrentPageId(templateStructure.pages[0].id);
                setExpandedPages(new Set([templateStructure.pages[0].id]));
                elementsToApply = templateStructure.pages[0].elements;
              }
              // Handle old format (direct elements)
              else if (
                templateStructure.elements &&
                templateStructure.elements.length > 0
              ) {
                console.log("📄 Using old direct elements format");
                const elementsCount = templateStructure.elements.length;
                console.log(
                  `🎨 Found ${elementsCount} template elements in direct format`
                );

                // Create a page structure from the old format
                pageToCreate = {
                  id: "page-1",
                  name: templateStructure.name || "Page 1",
                  elements: templateStructure.elements,
                  groups: [],
                  visible: true,
                  canvasBackground: {
                    type: "color" as const,
                    color: templateStructure.background?.color || "#ffffff",
                  },
                  canvasWidth: templateStructure.width || 1200,
                  canvasHeight: templateStructure.height || 800,
                };

                setPages([pageToCreate]);
                setCurrentPageId("page-1");
                setExpandedPages(new Set(["page-1"]));
                elementsToApply = templateStructure.elements;
              }

              if (elementsToApply.length > 0) {
                // Update visual indicator
                if (typeof window !== "undefined") {
                  const loadingDiv =
                    document.getElementById("template-loading");
                  if (loadingDiv) {
                    loadingDiv.innerHTML = `✅ Applied ${elementsToApply.length} elements!`;
                    loadingDiv.style.background = "#00aa00";
                    setTimeout(() => loadingDiv.remove(), 3000);
                  }
                }

                console.log("✅ Template structure applied successfully");
                console.log(
                  "📋 Applied elements:",
                  elementsToApply.map(
                    (el: any) =>
                      `${el.type}: ${
                        el.properties?.text ||
                        el.properties?.placeholder ||
                        "No text"
                      }`
                  )
                );

                // Still try to load canvas from backend to get any saved changes
                console.log(
                  "📄 Loading canvas from backend to merge with template"
                );
                const canvasLoaded = await loadCanvasFromBackend(appId);

                if (canvasLoaded) {
                  console.log("✅ Canvas data merged with template");
                } else {
                  console.log("ℹ️ No additional canvas data to merge");
                }
                return;
              } else {
                console.warn("⚠️ Template structure has no elements");
              }
            } else {
              console.warn("⚠️ Template data invalid or missing structure");
            }
          } catch (templateError) {
            console.error("❌ Failed to load template:", templateError);

            // Update visual indicator for error
            if (typeof window !== "undefined") {
              const loadingDiv = document.getElementById("template-loading");
              if (loadingDiv) {
                loadingDiv.innerHTML = "❌ Template loading failed!";
                loadingDiv.style.background = "#aa0000";
                setTimeout(() => loadingDiv.remove(), 3000);
              }
            }
          }
        }

        // Load canvas from backend only if no template was applied
        console.log("📄 Loading canvas from backend");
        const canvasLoaded = await loadCanvasFromBackend(appId);

        if (!canvasLoaded) {
          console.log("⚠️ No canvas data found, creating default page");
          const defaultPage = {
            id: "page-1",
            name: "Page 1",
            elements: [],
            groups: [],
            visible: true,
            canvasBackground: {
              type: "color" as const,
              color: "#ffffff",
            },
            canvasWidth: 1200,
            canvasHeight: 800,
          };
          setPages([defaultPage]);
          setCurrentPageId("page-1");
          setExpandedPages(new Set(["page-1"]));
        }
      } catch (error) {
        console.error("❌ Canvas initialization failed:", error);
        toast({
          title: "Error",
          description: "Failed to load app. Redirecting to dashboard.",
          variant: "destructive",
        });
        router.push("/dashboard");
      }
    };

    initializeCanvas();
  }, [contextAppId]); // Re-run when context appId changes (for workflow split-screen)

  // Detect split-screen mode based on URL pathname
  useEffect(() => {
    const isSplitView = pathname === "/split-view";

    setIsSplitScreenMode(isSplitView);

    if (isSplitView) {
      setIsLeftPanelHidden(true);
      setIsRightPanelHidden(true);
    } else {
      setIsLeftPanelHidden(false);
      setIsRightPanelHidden(false);
    }
  }, [pathname]); // ✅ only depend on pathname

  const updateCanvasBackground = (
    background: Partial<Page["canvasBackground"]>
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? {
              ...page,
              canvasBackground: { ...page.canvasBackground, ...background },
            }
          : page
      )
    );

    // Trigger auto-save after canvas background changes
    debouncedAutoSave();
  };

  const updateCanvasDimensions = (width: number, height: number) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? { ...page, canvasWidth: width, canvasHeight: height }
          : page
      )
    );
    saveToHistory();

    // Trigger auto-save after canvas dimensions change
    debouncedAutoSave();
  };

  const getCanvasBackgroundStyle = (): React.CSSProperties => {
    if (!currentPage) return {};

    const bg = currentPage.canvasBackground;

    switch (bg.type) {
      case "color":
        return { backgroundColor: bg.color || "#ffffff" };
      case "gradient":
        if (bg.gradient) {
          const colors = bg.gradient.colors.join(", ");
          if (bg.gradient.type === "linear") {
            return {
              background: `linear-gradient(${
                bg.gradient.direction || "45deg"
              }, ${colors})`,
            };
          } else {
            return {
              background: `radial-gradient(circle, ${colors})`,
            };
          }
        }
        return { backgroundColor: "#ffffff" };
      case "image":
        if (bg.image) {
          return {
            backgroundImage: `url(${bg.image.url})`,
            backgroundSize: bg.image.size,
            backgroundPosition: bg.image.position,
            backgroundRepeat:
              bg.image.size === "repeat" ? "repeat" : "no-repeat",
          };
        }
        return { backgroundColor: "#ffffff" };
      default:
        return { backgroundColor: "#ffffff" };
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setSelectedElement(null);
        setSelectedElements([]);
        setSelectedGroup(null); // Deselect group on canvas click
        setShowCanvasProperties(true);
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    if (!selectedElement || canvasMode === "pan") return;

    e.stopPropagation();
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x =
      (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const y =
      (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x,
      y,
      width: selectedElement.width,
      height: selectedElement.height,
    });
  };

  const handleElementMouseDown = (
    e: React.MouseEvent,
    element: CanvasElement
  ) => {
    console.log("🔍 CLICK: Element mouse down for:", element.id, element.type);
    console.log(
      "🔍 CLICK: Canvas mode:",
      canvasMode,
      "Locked:",
      element.properties.locked
    );

    if (element.properties.locked || canvasMode === "pan") return;

    e.stopPropagation();
    console.log("🔍 CLICK: Event propagation stopped");

    if (element.groupId) {
      // If clicking on a grouped element, select the entire group
      const group = currentGroups.find((g) => g.id === element.groupId);
      if (group) {
        const groupElements = canvasElements.filter(
          (el) => el.groupId === element.groupId
        );
        setSelectedElements(groupElements);
        setSelectedElement(element);
        setSelectedGroup(group);
        setShowCanvasProperties(false);

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x =
            (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
          const y =
            (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

          setDragOffset({
            x: x - element.x,
            y: y - element.y,
          });
          setIsDragging(true);
        }
        return;
      }
    }

    // Multi-selection logic for individual elements
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selectedElements.includes(element)) {
        setSelectedElements((prev) =>
          prev.filter((el) => el.id !== element.id)
        );
        if (selectedElement?.id === element.id) {
          setSelectedElement(
            selectedElements.find((el) => el.id !== element.id) || null
          );
        }
      } else {
        setSelectedElements((prev) => [...prev, element]);
        setSelectedElement(element);
      }
      setSelectedGroup(null); // Deselect group when multi-selecting individual elements
    } else {
      setSelectedElement(element);
      setSelectedElements([element]);
      setSelectedGroup(null); // Deselect group when selecting a single element

      // Handle preview mode vs edit mode
      if (isPreviewMode && element.type === "BUTTON") {
        console.log(
          "🎯 Preview mode: Button clicked, executing workflow:",
          element.id
        );

        // Try to execute workflow from context first
        executeWorkflow(element.properties?.workflowTriggerId || element.id);

        // Also try to fetch and execute workflow from backend
        handleElementClickWorkflow(element.id);

        return; // Don't select element in preview mode
      }

      // Edit mode: Sync with Canvas-Workflow context
      setSelectedElementId(element.id);
      console.log(
        "🔗 CLICK: Canvas element selected for workflow integration:",
        element.id
      );
      console.log("🔗 CLICK: Canvas element type:", element.type);
      console.log("🔗 CLICK: Canvas element name:", element.name || "Unnamed");
      console.log(
        "🔗 CLICK: Document activeElement after selection:",
        document.activeElement?.tagName
      );
    }

    setShowCanvasProperties(false);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x =
        (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
      const y =
        (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

      setDragOffset({
        x: x - element.x,
        y: y - element.y,
      });
      setIsDragging(true);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (
      e.button === 1 ||
      canvasMode === "pan" ||
      (e.button === 0 && e.altKey)
    ) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - canvasTransform.x,
        y: e.clientY - canvasTransform.y,
      });
      e.preventDefault();
    } else if (e.target === canvasRef.current && canvasMode === "select") {
      // Start selection box
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x =
          (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
        const y =
          (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
      }
    } else if (e.target === canvasRef.current && canvasMode === "text") {
      // Add text element at click position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x =
          (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
        const y =
          (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

        saveToHistory();
        const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);

        const newTextElement: CanvasElement = {
          id: `text-${Date.now()}`,
          type: "TEXT_FIELD",
          name: "Click to edit text",
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: 200,
          height: 40,
          properties: {
            text: "Click to edit text",
            fontSize: 16,
            fontWeight: "normal",
            color: "#000000",
            backgroundColor: "transparent",
            textAlign: "left",
          },
          rotation: 0,
          opacity: 100,
          pageId: currentPageId,
          zIndex: maxZIndex + 1,
        };

        updatePageElements(currentPageId, (prev) => [...prev, newTextElement]);
        setSelectedElement(newTextElement);
        setSelectedElements([newTextElement]);
        setSelectedGroup(null);
        setShowCanvasProperties(false);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x =
      (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const y =
      (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

    // Selection box logic
    if (isSelecting && selectionBox) {
      const newWidth = x - selectionStart.x;
      const newHeight = y - selectionStart.y;

      setSelectionBox({
        x: newWidth < 0 ? x : selectionStart.x,
        y: newHeight < 0 ? y : selectionStart.y,
        width: Math.abs(newWidth),
        height: Math.abs(newHeight),
      });
    }

    if (
      isDragging &&
      selectedGroup &&
      selectedElement &&
      canvasMode === "select"
    ) {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      const deltaX = newX - selectedElement.x;
      const deltaY = newY - selectedElement.y;

      moveGroup(selectedGroup.id, deltaX, deltaY);
    }
    // Multi-element dragging
    else if (
      isDragging &&
      selectedElements.length > 1 &&
      canvasMode === "select"
    ) {
      const deltaX = x - dragOffset.x - (selectedElement?.x || 0);
      const deltaY = y - dragOffset.y - (selectedElement?.y || 0);

      const updatedElements = selectedElements.map((el) => ({
        ...el,
        x: el.x + deltaX,
        y: el.y + deltaY,
      }));

      setSelectedElements(updatedElements);
      if (selectedElement) {
        const updatedSelected = updatedElements.find(
          (el) => el.id === selectedElement.id
        );
        if (updatedSelected) setSelectedElement(updatedSelected);
      }

      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => {
          const updated = updatedElements.find(
            (updated) => updated.id === el.id
          );
          return updated || el;
        })
      );
    } else if (isDragging && selectedElement && canvasMode === "select") {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;

      const updatedElement = { ...selectedElement, x: newX, y: newY };
      setSelectedElement(updatedElement);
      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => (el.id === selectedElement.id ? updatedElement : el))
      );
    }

    // Resize logic: update only width and height (do not change x/y)
    if (isResizing && selectedElement) {
      const deltaX = x - resizeStart.x;
      const deltaY = y - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      const newX = selectedElement.x; // keep unchanged
      const newY = selectedElement.y; // keep unchanged

      switch (resizeHandle) {
        case "nw":
          newWidth = Math.max(20, resizeStart.width - deltaX);
          newHeight = Math.max(20, resizeStart.height - deltaY);
          break;
        case "ne":
          newWidth = Math.max(20, resizeStart.width + deltaX);
          newHeight = Math.max(20, resizeStart.height - deltaY);
          break;
        case "sw":
          newWidth = Math.max(20, resizeStart.width - deltaX);
          newHeight = Math.max(20, resizeStart.height + deltaY);
          break;
        case "se":
          newWidth = Math.max(20, resizeStart.width + deltaX);
          newHeight = Math.max(20, resizeStart.height + deltaY);
          break;
        case "n":
          newHeight = Math.max(20, resizeStart.height - deltaY);
          break;
        case "s":
          newHeight = Math.max(20, resizeStart.height + deltaY);
          break;
        case "w":
          newWidth = Math.max(20, resizeStart.width - deltaX);
          break;
        case "e":
          newWidth = Math.max(20, resizeStart.width + deltaX);
          break;
      }

      const updatedElement = {
        ...selectedElement,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
      setSelectedElement(updatedElement);
      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => (el.id === selectedElement.id ? updatedElement : el))
      );
    }
  };

  const handleCanvasMouseUp = () => {
    if (isSelecting && selectionBox) {
      // Find elements within selection box
      const selectedInBox = canvasElements.filter((element) => {
        const elementRight = element.x + element.width;
        const elementBottom = element.y + element.height;
        const boxRight = selectionBox.x + selectionBox.width;
        const boxBottom = selectionBox.y + selectionBox.height;

        return (
          element.x < boxRight &&
          elementRight > selectionBox.x &&
          element.y < boxBottom &&
          elementBottom > selectionBox.y
        );
      });

      if (selectedInBox.length > 0) {
        setSelectedElements(selectedInBox);
        setSelectedElement(selectedInBox[0]);
        // If a group is selected, deselect it when selecting individual elements
        if (!selectedInBox.some((el) => el.groupId === selectedGroup?.id)) {
          setSelectedGroup(null);
        }
        setShowCanvasProperties(false);
      } else {
        // If no elements are selected, deselect group if it's not selected
        if (
          selectedGroup &&
          !selectedElements.some((el) => el.groupId === selectedGroup.id)
        ) {
          setSelectedGroup(null);
        }
      }

      setIsSelecting(false);
      setSelectionBox(null);
    }

    setIsPanning(false);

    // Removed auto-save - elements stay in local state until Save button is clicked

    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle("");
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        0.1,
        Math.min(3, canvasTransform.scale * delta)
      );

      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleChange = newScale / canvasTransform.scale;
        const newX = mouseX - (mouseX - canvasTransform.x) * scaleChange;
        const newY = mouseY - (mouseY - canvasTransform.y) * scaleChange;

        setCanvasTransform({
          x: newX,
          y: newY,
          scale: newScale,
        });
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Group elements with Ctrl+G
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "g" &&
        selectedElements.length > 1
      ) {
        e.preventDefault();
        createGroup();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedElements.length, createGroup]);

  const updatePageElements = (
    pageId: string,
    updater: (elements: CanvasElement[]) => CanvasElement[]
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? { ...page, elements: updater(page.elements) }
          : page
      )
    );

    // Trigger auto-save after element changes
    debouncedAutoSave();
  };

  const updateElementProperty = (property: string, value: any) => {
    if (!selectedElement) return;

    saveToHistory();
    const updatedElement = {
      ...selectedElement,
      properties: { ...selectedElement.properties, [property]: value },
    };
    setSelectedElement(updatedElement);
    updatePageElements(currentPageId, (prev) =>
      prev.map((el) => (el.id === selectedElement.id ? updatedElement : el))
    );
  };

  const updateElementTransform = (property: string, value: number) => {
    if (!selectedElement) return;

    saveToHistory();
    const updatedElement = { ...selectedElement, [property]: value };
    setSelectedElement(updatedElement);
    updatePageElements(currentPageId, (prev) =>
      prev.map((el) => (el.id === selectedElement.id ? updatedElement : el))
    );
  };

  const deleteElement = () => {
    if (!selectedElement) return;

    saveToHistory();
    updatePageElements(currentPageId, (prev) =>
      prev.filter((el) => el.id !== selectedElement.id)
    );
    setSelectedElement(null);
    setSelectedElements([]);
  };

  const duplicateElement = () => {
    if (!selectedElement) return;

    saveToHistory();
    const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);
    const duplicatedElement: CanvasElement = {
      ...selectedElement,
      id: `${selectedElement.type}-${Date.now()}`,
      x: selectedElement.x + 20,
      y: selectedElement.y + 20,
      zIndex: maxZIndex + 1,
    };

    updatePageElements(currentPageId, (prev) => [...prev, duplicatedElement]);
    setSelectedElement(duplicatedElement);
    setSelectedElements([duplicatedElement]);
  };

  const toggleElementVisibility = () => {
    if (!selectedElement) return;
    updateElementProperty("hidden", !selectedElement.properties.hidden);
  };

  const toggleElementLock = () => {
    if (!selectedElement) return;
    updateElementProperty("locked", !selectedElement.properties.locked);
  };

  const moveElementLayer = (direction: "up" | "down") => {
    if (!selectedElement) return;

    // Persist to history for undo/redo
    saveToHistory();

    // Only consider elements on the current page
    const elementsOnPage = canvasElements
      .filter((el) => el.pageId === currentPageId)
      .sort((a, b) => a.zIndex - b.zIndex);

    const currentIdx = elementsOnPage.findIndex(
      (el) => el.id === selectedElement.id
    );
    if (currentIdx === -1) return;

    const swapWithIdx = direction === "up" ? currentIdx + 1 : currentIdx - 1;

    // Nothing to do if already at front/back
    if (swapWithIdx < 0 || swapWithIdx >= elementsOnPage.length) return;

    const a = elementsOnPage[currentIdx];
    const b = elementsOnPage[swapWithIdx];

    updatePageElements(currentPageId, (prev) =>
      prev.map((el) => {
        if (el.id === a.id) return { ...el, zIndex: b.zIndex };
        if (el.id === b.id) return { ...el, zIndex: a.zIndex };
        return el;
      })
    );

    setSelectedElement((prev) => (prev ? { ...prev, zIndex: b.zIndex } : null));
  };

  // Enhanced workflow execution logic with proper navigation
  const executeWorkflow = useCallback(
    (elementId: string) => {
      console.log("🚀 EXECUTE: Starting workflow for element:", elementId);

      // Try to find workflow by elementId first, then by workflowKey
      let workflow = workflows.get(elementId);
      if (!workflow) {
        // Fallback: try to find by selectedElementId (for workflow storage)
        const element = canvasElements.find(
          (el) =>
            el.id === elementId ||
            el.properties?.workflowTriggerId === elementId
        );
        if (element) {
          workflow = workflows.get(element.id);
          console.log(
            "🔍 EXECUTE: Found workflow using element lookup:",
            element.id
          );
        }
      }

      if (!workflow || !workflow.nodes || !workflow.edges) {
        console.log("⚠️ EXECUTE: No workflow found for element:", elementId);
        console.log(
          "📋 EXECUTE: Available workflows:",
          Array.from(workflows.keys())
        );
        return;
      }

      console.log("📋 EXECUTE: Found workflow:", {
        nodes: workflow.nodes.length,
        edges: workflow.edges.length,
      });

      // Start with trigger node
      let currentNode = workflow.nodes.find(
        (n: any) => n.data.category === "Triggers"
      );
      if (!currentNode) {
        console.log("⚠️ EXECUTE: No trigger node found in workflow");
        return;
      }

      console.log("✅ EXECUTE: Found trigger node:", currentNode.data.label);

      // Process workflow chain
      while (currentNode) {
        console.log(
          "🔄 EXECUTE: Processing node:",
          currentNode.data.label,
          currentNode.data.category
        );

        // Find next edge
        const edge = workflow.edges.find(
          (e: any) => e.source === currentNode.id
        );
        if (!edge) {
          console.log("🔚 EXECUTE: No more edges, workflow complete");
          break;
        }

        // Find next node
        const nextNode = workflow.nodes.find((n: any) => n.id === edge.target);
        if (!nextNode) {
          console.log("⚠️ EXECUTE: Next node not found");
          break;
        }

        // Handle different node types
        if (nextNode.data.category === "Conditions") {
          console.log(
            "✅ EXECUTE: Condition node found:",
            nextNode.data.label,
            "- assuming it passes"
          );
          // For now, assume all conditions pass
          // In a full implementation, you'd evaluate the condition here
        } else if (
          nextNode.data.category === "Actions" &&
          nextNode.data.label === "page.redirect"
        ) {
          // Check for direct URL first, then targetPageId, then PageRedirectDropdown.value
          let directUrl = nextNode.data.url;
          const targetPageId = nextNode.data.targetPageId;

          // Handle dynamic URL from PageRedirectDropdown
          if (
            directUrl === "PageRedirectDropdown.value" ||
            directUrl === "${PageRedirectDropdown.value}"
          ) {
            const dropdown = document.getElementById(
              "PageRedirectDropdown"
            ) as HTMLSelectElement;
            if (dropdown && dropdown.value) {
              directUrl = dropdown.value;
              console.log(
                "🔄 EXECUTE: Using PageRedirectDropdown value:",
                directUrl
              );
            } else {
              console.log(
                "⚠️ EXECUTE: PageRedirectDropdown not found or has no value, using fallback"
              );
              directUrl = "/home"; // Fallback URL
            }
          }

          if (directUrl) {
            console.log("✅ EXECUTE: Redirecting to URL:", directUrl);

            // Handle both relative and absolute URLs
            if (
              directUrl.startsWith("http://") ||
              directUrl.startsWith("https://")
            ) {
              // External URL
              window.location.href = directUrl;
            } else {
              // Internal URL - use Next.js router
              nextRouter.push(directUrl);
            }

            toast({
              title: "Page Redirect",
              description: `Navigating to ${directUrl}`,
            });

            return; // Exit workflow after redirect
          } else if (targetPageId) {
            console.log("✅ EXECUTE: Redirecting to page:", targetPageId);

            // Use Next.js router for proper navigation
            const currentAppId = searchParams.get("appId") || "1";
            const redirectUrl = `/canvas?appId=${currentAppId}&pageId=${targetPageId}`;

            nextRouter.push(redirectUrl);

            toast({
              title: "Page Redirect",
              description: `Navigated to page ${targetPageId}`,
            });

            return; // Exit workflow after redirect
          } else {
            // Check if there's a pageId in the node data for multi-page apps
            const pageId = nextNode.data.pageId;
            if (pageId) {
              console.log("✅ EXECUTE: Redirecting to pageId:", pageId);

              const currentAppId = searchParams.get("appId") || "1";
              const redirectUrl = `/canvas?appId=${currentAppId}&pageId=${pageId}`;

              // Use window.location.href for same-tab redirect in preview mode
              if (isPreviewMode) {
                console.log(
                  `✅ EXECUTE: Preview mode - redirecting to ${redirectUrl} in same tab`
                );
                window.location.href = redirectUrl;
              } else {
                nextRouter.push(redirectUrl);
              }

              toast({
                title: "Page Redirect",
                description: `Navigated to page ${pageId}`,
              });

              return; // Exit workflow after redirect
            } else {
              console.log(
                "⚠️ EXECUTE: No target URL, page, or pageId selected for redirect"
              );
            }
          }
        }

        currentNode = nextNode;
      }
    },
    [workflows, canvasElements, nextRouter, searchParams, toast]
  );

  // Handle element click workflow execution for preview mode
  const handleElementClickWorkflow = useCallback(
    async (elementId: string) => {
      const token = localStorage.getItem("authToken");
      const currentAppId = searchParams.get("appId") || "2";

      try {
        console.log("🔍 CLICK: Fetching workflow for element:", elementId);
        const response = await fetch(
          `/api/canvas/workflows/${currentAppId}?elementId=${elementId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("authToken");
          window.location.href = "/login";
          return;
        }

        const data = await response.json();
        console.log("📡 CLICK: Workflow response:", data);

        if (data.success && data.data) {
          const workflow = data.data;
          const nodes = workflow.nodes || [];
          const edges = workflow.edges || [];

          console.log("🔗 CLICK: Workflow structure:", {
            nodes: nodes.length,
            edges: edges.length,
          });

          // Find trigger node (onClick)
          const triggerNode = nodes.find(
            (n: any) =>
              n.data?.category === "Triggers" && n.data?.label === "onClick"
          );
          if (!triggerNode) {
            console.log("⚠️ CLICK: No onClick trigger found");
            return;
          }

          console.log("✅ CLICK: Found trigger node:", triggerNode.id);

          // Follow connector (edge) to find target action
          const edge = edges.find((e: any) => e.source === triggerNode.id);
          if (!edge) {
            console.log("⚠️ CLICK: No connector found from trigger");
            return;
          }

          console.log(
            "🔗 CLICK: Following connector:",
            edge.source,
            "→",
            edge.target
          );

          // Find target action node
          const actionNode = nodes.find((n: any) => n.id === edge.target);
          if (!actionNode) {
            console.log("⚠️ CLICK: No action node found");
            return;
          }

          console.log("🎯 CLICK: Found action node:", actionNode.data.label);

          // Execute page.redirect action
          if (
            actionNode.data?.category === "Actions" &&
            actionNode.data?.label === "page.redirect"
          ) {
            const redirectPageId = actionNode.data.pageId || 2; // Default to Page 2
            const redirectUrl = `/canvas?appId=${currentAppId}&pageId=${redirectPageId}`;

            console.log(
              `✅ CLICK: Redirecting to ${redirectUrl} via connector`
            );
            window.location.href = redirectUrl; // Same tab redirect

            toast({
              title: "Page Redirect",
              description: `Navigated to page ${redirectPageId}`,
            });
          } else {
            console.log("⚠️ CLICK: Action node is not page.redirect");
          }
        } else {
          console.log("⚠️ CLICK: No workflow found for element:", elementId);
        }
      } catch (error) {
        console.error("❌ CLICK: Workflow execution failed:", error);
      }
    },
    [searchParams, toast]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, elementType: string) => {
      e.dataTransfer.setData("elementType", elementType);
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const elementType = e.dataTransfer.getData("elementType");
      const canvasRect = canvasRef.current?.getBoundingClientRect();

      if (!canvasRect) return;

      // Calculate drop position
      const x =
        (e.clientX - canvasRect.left - canvasTransform.x) /
        canvasTransform.scale;
      const y =
        (e.clientY - canvasRect.top - canvasTransform.y) /
        canvasTransform.scale;

      // Handle file drops from file explorer
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        files.forEach((file, index) => {
          // Upload each file with offset position
          handleFileUpload(file, x + index * 20, y + index * 20);
        });
        return;
      }

      // Handle element drops from toolbar
      if (elementType) {
        saveToHistory();
        const maxZIndex = Math.max(...canvasElements.map((el) => el.zIndex), 0);

        // Generate workflow trigger ID for interactive elements
        const workflowTriggerId = [
          "BUTTON",
          "INPUT",
          "FORM",
          "CHECKBOX",
          "RADIO",
          "SELECT",
        ].includes(elementType)
          ? `${elementType}-onEvent-${Date.now()}`
          : undefined;

        const newElement: CanvasElement = {
          id: `${elementType}-${Date.now()}`,
          type: elementType,
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: getDefaultSize(elementType).width,
          height: getDefaultSize(elementType).height,
          properties: {
            ...getDefaultProperties(elementType),
            workflowTriggerId, // Add workflow trigger ID to properties
          },
          rotation: 0,
          opacity: 100,
          pageId: currentPageId,
          zIndex: maxZIndex + 1,
        };

        updatePageElements(currentPageId, (prev) => [...prev, newElement]);
        setSelectedElement(newElement);
        setSelectedElements([newElement]);
        setSelectedGroup(null); // Deselect group when adding new element
        setShowCanvasProperties(false);
      }
    },
    [canvasTransform, currentPageId, canvasElements, saveToHistory]
  );

  // File upload helper functions
  const handleFileUpload = useCallback(
    async (
      file: File,
      x: number = 100,
      y: number = 100,
      elementId?: string
    ) => {
      try {
        if (!currentAppId) {
          toast({
            title: "Error",
            description: "No app ID available for file upload.",
            variant: "destructive",
          });
          return;
        }

        // Show loading toast
        const loadingToast = toast({
          title: "Uploading file...",
          description: `Uploading ${file.name}`,
        });

        // Upload file to backend
        const uploadedFiles = await uploadFile(file, parseInt(currentAppId));

        if (uploadedFiles && uploadedFiles.length > 0) {
          const uploadedFile = uploadedFiles[0];

          // If elementId is provided, update the existing element instead of creating a new one
          if (elementId) {
            // Determine the correct element type based on file type
            const isImage = uploadedFile.mimeType.startsWith("image/");
            const isVideo = uploadedFile.mimeType.startsWith("video/");
            const isAudio = uploadedFile.mimeType.startsWith("audio/");

            let newType = "media"; // Default to media
            if (isImage) newType = "image";
            else if (isVideo) newType = "video";
            else if (isAudio) newType = "audio";

            updatePageElements(currentPageId, (prev) =>
              prev.map((el) =>
                el.id === elementId
                  ? {
                      ...el,
                      type: newType, // Update element type based on file type
                      properties: {
                        ...el.properties,
                        fileName: uploadedFile.originalName,
                        fileSize: uploadedFile.size,
                        mimeType: uploadedFile.mimeType,
                        src: uploadedFile.url,
                        mediaId: uploadedFile.id,
                        thumbnail: uploadedFile.thumbnail,
                        alt: uploadedFile.originalName,
                      },
                    }
                  : el
              )
            );
            setSelectedElement(null);
            setSelectedElements([]);
          } else {
            // Create media element on canvas
            const mediaElement = createMediaElement(uploadedFile, x, y);

            // Add element to canvas
            const maxZIndex = Math.max(
              0,
              ...canvasElements.map((el) => el.zIndex || 0)
            );
            const newElement: CanvasElement = {
              ...mediaElement,
              zIndex: maxZIndex + 1,
            };

            updatePageElements(currentPageId, (prev) => [...prev, newElement]);
            setSelectedElement(newElement);
            setSelectedElements([newElement]);
            setSelectedGroup(null);
            setShowCanvasProperties(false);
          }

          // Success toast
          toast({
            title: "File uploaded successfully",
            description: `${file.name} has been added to the canvas.`,
          });
        }
      } catch (error: any) {
        console.error("File upload error:", error);
        toast({
          title: "Upload failed",
          description:
            error.message || "Failed to upload file. Please try again.",
          variant: "destructive",
        });
      }
    },
    [currentAppId, currentPageId, canvasElements, toast, updatePageElements]
  );

  const createMediaElement = useCallback(
    (uploadedFile: any, x: number, y: number): CanvasElement => {
      const isImage = uploadedFile.mimeType.startsWith("image/");
      const isVideo = uploadedFile.mimeType.startsWith("video/");
      const isAudio = uploadedFile.mimeType.startsWith("audio/");
      const isPDF = uploadedFile.mimeType === "application/pdf";
      const isDocument =
        uploadedFile.mimeType.includes("document") ||
        uploadedFile.mimeType.includes("word") ||
        uploadedFile.mimeType.includes("sheet") ||
        uploadedFile.mimeType.includes("presentation");

      // Determine element type and size based on file type
      let elementType = "media";
      let width = 200;
      let height = 150;

      if (isImage) {
        elementType = "image";
        // Use image dimensions if available
        if (uploadedFile.metadata?.dimensions) {
          const { width: imgWidth, height: imgHeight } =
            uploadedFile.metadata.dimensions;
          const maxWidth = 400;
          const maxHeight = 300;
          const aspectRatio = imgWidth / imgHeight;

          if (imgWidth > maxWidth || imgHeight > maxHeight) {
            if (aspectRatio > 1) {
              width = maxWidth;
              height = maxWidth / aspectRatio;
            } else {
              height = maxHeight;
              width = maxHeight * aspectRatio;
            }
          } else {
            width = imgWidth;
            height = imgHeight;
          }
        }
      } else if (isVideo) {
        elementType = "video";
        width = 320;
        height = 240;
      } else if (isAudio) {
        elementType = "audio";
        width = 300;
        height = 60;
      } else if (isPDF || isDocument) {
        // For PDFs and documents, create a file display element
        elementType = "media";
        width = 200;
        height = 150;
      } else {
        // For all other file types, create a generic file element
        elementType = "media";
        width = 200;
        height = 150;
      }

      return {
        id: `${elementType}-${Date.now()}`,
        type: elementType,
        x: Math.max(0, x),
        y: Math.max(0, y),
        width,
        height,
        properties: {
          src: uploadedFile.url,
          alt: uploadedFile.originalName,
          fileName: uploadedFile.originalName,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.mimeType,
          mediaId: uploadedFile.id,
          thumbnail: uploadedFile.thumbnail,
        },
        rotation: 0,
        opacity: 100,
        pageId: currentPageId,
        zIndex: 1, // Will be overridden when added to canvas
      };
    },
    [currentPageId]
  );

  const getDefaultSize = (elementType: string) => {
    const sizes: Record<string, { width: number; height: number }> = {
      textfield: { width: 200, height: 40 },
      text: { width: 200, height: 40 },
      textarea: { width: 200, height: 100 },
      button: { width: 120, height: 40 },
      checkbox: { width: 150, height: 30 },
      radiobutton: { width: 150, height: 30 },
      dropdown: { width: 200, height: 40 },
      toggle: { width: 150, height: 30 },
      phone: { width: 200, height: 40 },
      password: { width: 200, height: 40 },
      calendar: { width: 200, height: 40 },
      upload: { width: 200, height: 120 },
      addfile: { width: 200, height: 120 },
      media: { width: 200, height: 150 },
      image: { width: 200, height: 150 },
      video: { width: 320, height: 240 },
      audio: { width: 300, height: 60 },
      rectangle: { width: 100, height: 100 },
      circle: { width: 100, height: 100 },
      triangle: { width: 100, height: 100 },
      line: { width: 100, height: 2 },
      arrow: { width: 100, height: 20 },
      star: { width: 80, height: 80 },
      heart: { width: 80, height: 80 },
      frame: { width: 300, height: 200 },
      divider: { width: 200, height: 2 },
      // Icon elements - all icons have the same default size
      "icon-minimize": { width: 32, height: 32 },
      "icon-maximize": { width: 32, height: 32 },
      "icon-close": { width: 32, height: 32 },
      "icon-settings": { width: 32, height: 32 },
      "icon-refresh": { width: 32, height: 32 },
      "icon-info": { width: 32, height: 32 },
      "icon-help": { width: 32, height: 32 },
      "icon-search": { width: 32, height: 32 },
      "icon-add": { width: 32, height: 32 },
      "icon-edit": { width: 32, height: 32 },
      "icon-delete": { width: 32, height: 32 },
      "icon-save": { width: 32, height: 32 },
      "icon-download": { width: 32, height: 32 },
      "icon-upload": { width: 32, height: 32 },
      "icon-home": { width: 32, height: 32 },
      "icon-back": { width: 32, height: 32 },
      "icon-forward": { width: 32, height: 32 },
      "chart-bar": { width: 360, height: 240 },
      "chart-line": { width: 360, height: 240 },
      "chart-pie": { width: 320, height: 240 },
      "chart-donut": { width: 320, height: 240 },
      "kpi-card": { width: 280, height: 160 },
      "table": { width: 400, height: 300 },
      "matrix-chart": { width: 400, height: 300 },
    };
    return sizes[elementType] || { width: 100, height: 100 };
  };

  const getDefaultProperties = (elementType: string) => {
    const defaults: Record<string, any> = {
      textfield: {
        placeholder: "Enter text",
        value: "",
        backgroundColor: "#ffffff",
        color: "#000000",
        borderColor: "#d1d5db",
        borderWidth: 1,
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 14,
        fontFamily: "Poppins, system-ui, sans-serif",
      },
      text: {
        text: "Click to edit text",
        fontSize: 16,
        fontWeight: "normal",
        color: "#000000",
        backgroundColor: "transparent",
        textAlign: "left",
      },
      textarea: {
        placeholder: "Enter text",
        value: "",
        rows: 4,
        backgroundColor: "#ffffff",
        color: "#000000",
      },
      button: {
        text: "Button",
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        borderRadius: 6,
        isSubmitButton: false,
        formGroupId: null,
      },
      checkbox: { label: "Checkbox", checked: false },
      radiobutton: { label: "Radio Button", checked: false },
      dropdown: {
        placeholder: "Select option",
        options: ["Option 1", "Option 2", "Option 3"],
        value: "",
      },
      toggle: { label: "Toggle", checked: false },
      phone: {
        placeholder: "Phone number",
        value: "",
      },
      password: {
        placeholder: "Password",
        value: "",
      },
      calendar: {
        placeholder: "Select date",
        value: "",
      },
      upload: {
        placeholder: "Upload file",
      },
      addfile: {
        placeholder: "Drop files here",
      },
      media: {
        src: "",
        alt: "Media",
      },
      image: {
        src: "",
        alt: "Image",
      },
      video: {
        src: "",
      },
      audio: {
        src: "",
      },
      rectangle: {
        backgroundColor: "#f3f4f6",
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      circle: {
        backgroundColor: "#f3f4f6",
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      triangle: {
        backgroundColor: "#f3f4f6",
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      line: {
        strokeColor: "#1f2937",
        strokeWidth: 2,
        strokeStyle: "solid",
      },
      arrow: {
        strokeColor: "#1f2937",
        strokeWidth: 2,
        strokeStyle: "solid",
      },
      star: {
        backgroundColor: "#facc15",
        borderColor: "#f59e0b",
        borderWidth: 1,
      },
      heart: {
        backgroundColor: "#f472b6",
        borderColor: "#f43f5e",
        borderWidth: 1,
      },
      frame: {
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      divider: {
        strokeColor: "#d1d5db",
        strokeWidth: 1,
      },
      "chart-bar": {
        title: "Monthly Revenue",
        description: "Example dataset for drag & drop preview",
        chartType: "bar",
        xKey: "month",
        legend: true,
        showGrid: true,
        showAxis: true,
        series: [
          { dataKey: "desktop", label: "Desktop" },
          { dataKey: "mobile", label: "Mobile" },
        ],
        colors: ["#2563eb", "#7c3aed", "#22c55e"],
        data: [
          { month: "Jan", desktop: 186, mobile: 80 },
          { month: "Feb", desktop: 305, mobile: 200 },
          { month: "Mar", desktop: 237, mobile: 120 },
          { month: "Apr", desktop: 173, mobile: 190 },
          { month: "May", desktop: 209, mobile: 130 },
          { month: "Jun", desktop: 214, mobile: 140 },
        ],
      },
      "chart-line": {
        title: "Active Users",
        description: "Example trend line",
        chartType: "line",
        xKey: "month",
        legend: true,
        showGrid: true,
        showAxis: true,
        strokeCurve: "monotone",
        series: [
          { dataKey: "desktop", label: "Desktop", strokeWidth: 3 },
          { dataKey: "mobile", label: "Mobile", strokeWidth: 3 },
        ],
        colors: ["#2563eb", "#7c3aed", "#f97316"],
        data: [
          { month: "Jan", desktop: 120, mobile: 80 },
          { month: "Feb", desktop: 160, mobile: 110 },
          { month: "Mar", desktop: 200, mobile: 140 },
          { month: "Apr", desktop: 180, mobile: 150 },
          { month: "May", desktop: 220, mobile: 170 },
          { month: "Jun", desktop: 260, mobile: 210 },
        ],
      },
      "chart-pie": {
        title: "Traffic Sources",
        description: "Distribution example",
        chartType: "pie",
        nameKey: "category",
        valueKey: "value",
        legend: true,
        donut: false,
        colors: ["#2563eb", "#7c3aed", "#22c55e", "#f97316", "#eab308"],
        data: [
          { category: "Organic", value: 45 },
          { category: "Paid", value: 25 },
          { category: "Referral", value: 15 },
          { category: "Social", value: 10 },
          { category: "Email", value: 5 },
        ],
      },
      "chart-donut": {
        title: "Plan Usage",
        description: "Relative share of plans",
        chartType: "donut",
        nameKey: "plan",
        valueKey: "value",
        legend: true,
        donut: true,
        innerRadius: "55%",
        outerRadius: "80%",
        colors: ["#2563eb", "#7c3aed", "#22c55e", "#f97316"],
        data: [
          { plan: "Free", value: 40 },
          { plan: "Starter", value: 25 },
          { plan: "Pro", value: 22 },
          { plan: "Enterprise", value: 13 },
        ],
      },
      "kpi-card": {
        title: "Revenue",
        description: "Monthly performance",
        kpiData: {
          label: "Total Revenue",
          value: "$45,231",
          unit: "",
          trend: 12.5,
          target: 50000,
          description: "vs last month",
        },
      },
      "table": {
        title: "Sales Report",
        description: "Recent transactions",
        columns: [
          { key: "id", label: "ID", align: "left" },
          { key: "product", label: "Product", align: "left" },
          { key: "quantity", label: "Qty", align: "center" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        data: [
          { id: "001", product: "Laptop", quantity: 2, amount: "$2,400" },
          { id: "002", product: "Mouse", quantity: 5, amount: "$125" },
          { id: "003", product: "Keyboard", quantity: 3, amount: "$210" },
          { id: "004", product: "Monitor", quantity: 1, amount: "$450" },
        ],
        showHeader: true,
        striped: true,
      },
      "matrix-chart": {
        title: "Performance Matrix",
        description: "Cross-category analysis",
        matrixRows: ["Q1", "Q2", "Q3", "Q4"],
        matrixCols: ["Sales", "Marketing", "Support", "Dev"],
        data: [
          { row: "Q1", col: "Sales", value: 85 },
          { row: "Q1", col: "Marketing", value: 72 },
          { row: "Q1", col: "Support", value: 68 },
          { row: "Q1", col: "Dev", value: 90 },
          { row: "Q2", col: "Sales", value: 78 },
          { row: "Q2", col: "Marketing", value: 88 },
          { row: "Q2", col: "Support", value: 75 },
          { row: "Q2", col: "Dev", value: 82 },
          { row: "Q3", col: "Sales", value: 92 },
          { row: "Q3", col: "Marketing", value: 80 },
          { row: "Q3", col: "Support", value: 85 },
          { row: "Q3", col: "Dev", value: 88 },
          { row: "Q4", col: "Sales", value: 88 },
          { row: "Q4", col: "Marketing", value: 95 },
          { row: "Q4", col: "Support", value: 90 },
          { row: "Q4", col: "Dev", value: 93 },
        ],
        cellColors: ["#fee2e2", "#fef3c7", "#dcfce7", "#d1fae5", "#86efac"],
      },
    };
    return defaults[elementType] || {};
  };

  // Helper function to render icon elements with consistent styling
  const renderIconElement = (
    element: CanvasElement,
    IconComponent: React.ComponentType<any>,
    style: React.CSSProperties
  ) => {
    const iconSize = element.properties.iconSize || 16;
    const iconColor = element.properties.iconColor || "#6b7280";
    const iconOpacity = element.properties.iconOpacity || 1;
    const iconRotation = element.properties.iconRotation || 0;

    return (
      <div
        style={{
          ...style,
          backgroundColor: element.properties.backgroundColor || "transparent",
          borderRadius: `${element.properties.borderRadius || 0}px`,
          padding: `${element.properties.padding || 0}px`,
          border: element.properties.borderWidth
            ? `${element.properties.borderWidth}px solid ${
                element.properties.borderColor || "#d1d5db"
              }`
            : "none",
        }}
        className="w-full h-full flex items-center justify-center"
      >
        <IconComponent
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            color: iconColor,
            opacity: iconOpacity,
            transform: `rotate(${iconRotation}deg)`,
          }}
        />
      </div>
    );
  };

  const renderElement = (element: CanvasElement) => {
    const isSelected = selectedElement?.id === element.id;
    const isMultiSelected = selectedElements.some((el) => el.id === element.id);
    const isGrouped = !!element.groupId;
    const isGroupSelected = selectedGroup?.id === element.groupId;
    const isLocked = element.properties.locked;
    const isHidden = element.properties.hidden;

    if (isHidden) return null;

    const style: React.CSSProperties = {
      backgroundColor: element.properties.backgroundColor || "#ffffff",
      color: element.properties.color || "#000000",
      fontSize: `${element.properties.fontSize || 14}px`,
      fontWeight: element.properties.fontWeight || "normal",
      textAlign: element.properties.textAlign || "left",
      borderRadius: `${element.properties.borderRadius || 0}px`,
      opacity: element.opacity / 100,
      border:
        typeof element.properties.borderWidth === "number" &&
        element.properties.borderWidth > 0
          ? `${element.properties.borderWidth}px solid ${
              element.properties.borderColor || "#d1d5db"
            }`
          : undefined,
      boxShadow: element.properties.shadow
        ? "0 6px 18px rgba(0,0,0,0.15)"
        : undefined,
      backdropFilter: element.properties.backgroundBlur
        ? "blur(8px)"
        : undefined,
      WebkitBackdropFilter: element.properties.backgroundBlur
        ? "blur(8px)"
        : undefined,
    };

    const elementContent = (() => {
      switch (element.type) {
        case "textfield":
          return (
            <input
              style={{ ...style, outline: "none" }}
              className="px-3 py-2 w-full h-full"
              placeholder={element.properties.placeholder}
              value={element.properties.value}
                  readOnly={!isPreviewMode}
            />
          );
        case "text":
        case "TEXT_FIELD":
        case "SHAPE":
          // Handle text elements that might have been saved as SHAPE type
          if (
            element.properties.text !== undefined ||
            element.name === "Click to edit text" ||
            element.id.startsWith("text-")
          ) {
            return (
              <div
                style={{
                  ...style,
                  fontFamily:
                    element.properties.fontFamily ||
                    "Poppins, system-ui, sans-serif",
                  fontSize: `${element.properties.fontSize || 16}px`,
                  fontWeight: element.properties.fontWeight || "normal",
                  fontStyle: element.properties.fontStyle || "normal",
                  textDecoration: element.properties.textDecoration || "none",
                  textAlign: element.properties.textAlign || "left",
                  color: element.properties.color || "#000000",
                  lineHeight: element.properties.lineHeight || 1.5,
                  letterSpacing: `${element.properties.letterSpacing || 0}px`,
                  backgroundColor:
                    element.properties.backgroundColor || "transparent",
                  padding: "4px 8px",
                  cursor: "text",
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent:
                    element.properties.textAlign === "center"
                      ? "center"
                      : element.properties.textAlign === "right"
                      ? "flex-end"
                      : "flex-start",
                  boxSizing: "border-box",
                  position: "relative",
                }}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  const newText = e.currentTarget.textContent || "";
                  // Update the element directly in the page elements
                  updatePageElements(currentPageId, (prev) =>
                    prev.map((el) =>
                      el.id === element.id
                        ? {
                            ...el,
                            properties: { ...el.properties, text: newText },
                            name: newText || "Click to edit text",
                          }
                        : el
                    )
                  );
                  // Update selected element if this is the selected one
                  if (selectedElement?.id === element.id) {
                    setSelectedElement({
                      ...selectedElement,
                      properties: {
                        ...selectedElement.properties,
                        text: newText,
                      },
                    });
                  }
                  // Removed auto-save - text changes stay in local state until Save button is clicked
                }}
                onKeyDown={(e) => {
                  // Prevent global canvas hotkeys (like Backspace/Delete to delete element)
                  e.stopPropagation();

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                    return;
                  }

                  // Just prevent global delete when backspace is pressed in text
                  if (e.key === "Backspace") {
                    e.stopPropagation();
                    return;
                  }

                  // If Delete is pressed while editing, prevent deleting the element
                  if (e.key === "Delete") {
                    e.preventDefault();
                    return;
                  }
                }}
                onFocus={(e) => {
                  // Stop propagation only when actively editing
                  e.stopPropagation();
                  // Clear the non-breaking space when user starts editing
                  if (e.currentTarget.textContent === "\u00A0") {
                    e.currentTarget.textContent = "";
                  }
                }}
                // Remove onInput to prevent cursor jumping - only update on blur
              >
                {element.properties.text !== undefined
                  ? element.properties.text || "\u00A0"
                  : "Click to edit text"}
              </div>
            );
          }
          // Fall through to default shape rendering for non-text SHAPE elements
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "#e5e7eb",
                border: `2px solid ${
                  element.properties.borderColor || "#9ca3af"
                }`,
                borderRadius: `${element.properties.borderRadius || 4}px`,
              }}
              className="w-full h-full flex items-center justify-center text-gray-600"
            >
              Shape
            </div>
          );
        case "textarea":
          return (
            <textarea
              style={{ ...style, outline: "none" }}
              className="px-3 py-2 resize-none w-full h-full"
              placeholder={element.properties.placeholder}
              value={element.properties.value}
              rows={element.properties.rows}
              readOnly={!isPreviewMode}
            />
          );
        case "button":
          return (
            <button
              style={style}
              className="px-4 py-2 w-full h-full font-medium"
            >
              {element.properties.text || "Button"}
            </button>
          );
        case "checkbox":
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <input
                type="checkbox"
                checked={element.properties.checked}
                style={{
                  width: `${element.properties.size || 16}px`,
                  height: `${element.properties.size || 16}px`,
                  borderColor: element.properties.borderColor || "#d1d5db",
                  borderRadius: `${element.properties.borderRadius || 4}px`,
                  accentColor: element.properties.checkedColor || "#3b82f6",
                }}
                readOnly
              />
              <label style={style}>
                {element.properties.label || "Checkbox"}
              </label>
            </div>
          );
        case "radiobutton":
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <input
                type="radio"
                checked={element.properties.checked}
                style={{
                  width: `${element.properties.size || 16}px`,
                  height: `${element.properties.size || 16}px`,
                  borderColor: element.properties.borderColor || "#d1d5db",
                  accentColor: element.properties.selectedColor || "#3b82f6",
                }}
                readOnly
              />
              <label style={style}>
                {element.properties.label || "Radio Button"}
              </label>
            </div>
          );
        case "dropdown":
          return (
            <select
              style={{
                ...style,
                fontFamily:
                  element.properties.fontFamily ||
                  "Poppins, system-ui, sans-serif",
                fontSize: `${element.properties.fontSize || 14}px`,
                fontWeight: element.properties.fontWeight || "normal",
                color: element.properties.color || "#000000",
                backgroundColor:
                  element.properties.backgroundColor || "#ffffff",
                borderColor: element.properties.borderColor || "#d1d5db",
                borderWidth: `${element.properties.borderWidth || 1}px`,
                borderRadius: `${element.properties.borderRadius || 6}px`,
                padding: `${element.properties.padding || 8}px`,
                outline: "none",
              }}
              className="w-full h-full"
              value={element.properties.value}
              disabled
            >
              <option>
                {element.properties.placeholder || "Select option"}
              </option>
              {element.properties.options?.map(
                (option: string, index: number) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                )
              )}
            </select>
          );
        case "toggle":
          const toggleSize = element.properties.size || 20;
          const toggleWidth = toggleSize * 2.4;
          const toggleHeight = toggleSize * 1.2;
          const toggleBallSize = toggleSize * 0.8;
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <div
                style={{
                  width: `${toggleWidth}px`,
                  height: `${toggleHeight}px`,
                  backgroundColor: element.properties.checked
                    ? element.properties.backgroundColorOn || "#3b82f6"
                    : element.properties.backgroundColorOff || "#d1d5db",
                  borderRadius: `${element.properties.borderRadius || 12}px`,
                  padding: "2px",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: `${toggleBallSize}px`,
                    height: `${toggleBallSize}px`,
                    backgroundColor:
                      element.properties.toggleColor || "#ffffff",
                    borderRadius: "50%",
                    transition: "transform 0.2s",
                    transform: element.properties.checked
                      ? `translateX(${toggleWidth - toggleBallSize - 4}px)`
                      : "translateX(0px)",
                  }}
                />
              </div>
              <label style={style}>
                {element.properties.label || "Toggle"}
              </label>
            </div>
          );
        case "phone":
          return (
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              style={{
                ...style,
                fontFamily:
                  element.properties.fontFamily ||
                  "Poppins, system-ui, sans-serif",
                fontSize: `${element.properties.fontSize || 14}px`,
                fontWeight: element.properties.fontWeight || "normal",
                color: element.properties.color || "#000000",
                backgroundColor:
                  element.properties.backgroundColor || "#ffffff",
                borderColor: element.properties.borderColor || "#d1d5db",
                borderWidth: `${element.properties.borderWidth || 1}px`,
                borderStyle: "solid",
                borderRadius: `${element.properties.borderRadius || 6}px`,
                padding: `${element.properties.padding || 8}px`,
                outline: "none",
              }}
              className="w-full h-full"
              placeholder={element.properties.placeholder || "Phone number"}
              defaultValue={element.properties.value}
              // Allow editing in both preview and run mode so runtime matches preview validation
              readOnly={false}
              onChange={(e) => {
                const raw = e.target.value || "";
                // Strip any non-digit characters
                const digits = raw.replace(/\D+/g, "");

                if (raw !== digits) {
                  // Notify user about invalid characters using the inline prompt
                  try {
                    showPrompt("Not a valid phone number. Please enter digits only.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }

                // Enforce max length of 10
                let normalized = digits;
                if (normalized.length > 10) {
                  normalized = normalized.slice(0, 10);
                  try {
                    showPrompt("Phone number must be 10 digits. Extra digits were removed.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }

                const updatedElement = {
                  ...element,
                  properties: { ...element.properties, value: normalized },
                };
                updatePageElements(currentPageId, (prev) =>
                  prev.map((el) => (el.id === element.id ? updatedElement : el))
                );

                // If the input is uncontrolled in the DOM, also set the displayed value
                // (helps when defaultValue was used).
                try {
                  const input = e.target as HTMLInputElement;
                  if (input && input.value !== normalized) input.value = normalized;
                } catch (err) {
                  /* ignore DOM write errors */
                }
              }}
              onBlur={(e) => {
                const value = (e.target as HTMLInputElement).value || "";
                if (value.length !== 10) {
                  try {
                    showPrompt("Not a valid phone number. Phone number must be exactly 10 digits.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }
              }}
            />
          );
        case "password":
        case "PASSWORD_FIELD":
          return (
            <div
              style={{
                ...style,
                position: "relative",
                // ensure the input has room for the toggle
                paddingRight: `${(element.properties.padding || 8) + 28}px`,
              }}
            >
              <input
                type={showPasswordMap[element.id] ? "text" : "password"}
                style={{
                  width: "100%",
                  height: "100%",
                  fontFamily:
                    element.properties.fontFamily ||
                    "Poppins, system-ui, sans-serif",
                  fontSize: `${element.properties.fontSize || 14}px`,
                  fontWeight: element.properties.fontWeight || "normal",
                  color: element.properties.color || "#000000",
                  backgroundColor:
                    element.properties.backgroundColor || "#ffffff",
                  borderColor: element.properties.borderColor || "#d1d5db",
                  borderWidth: `${element.properties.borderWidth || 1}px`,
                  borderStyle: "solid",
                  borderRadius: `${element.properties.borderRadius || 6}px`,
                  padding: `${element.properties.padding || 8}px`,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                className="w-full h-full"
                placeholder={element.properties.placeholder || "Enter password"}
                defaultValue={element.properties.value}
                readOnly={!isPreviewMode}
                onChange={(e) => {
                  if (!isPreviewMode) return;
                  const updatedElement = {
                    ...element,
                    properties: { ...element.properties, value: e.target.value },
                  };
                  updatePageElements(currentPageId, (prev) =>
                    prev.map((el) => (el.id === element.id ? updatedElement : el))
                  );
                }}
              />

              <button
                type="button"
                onClick={() => toggleShowPassword(element.id)}
                aria-label={showPasswordMap[element.id] ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 8,
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.6)",
                  border: "none",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  // place toggle above input which may have high zIndex
                  zIndex: (element.zIndex ?? 1) + 1200,
                  pointerEvents: "auto",
                  cursor: "pointer",
                }}
              >
                {showPasswordMap[element.id] ? (
                  <EyeOff size={16} color={element.properties.iconColor || "#6b7280"} />
                ) : (
                  <Eye size={16} color={element.properties.iconColor || "#6b7280"} />
                )}
              </button>
            </div>
          );
        case "calendar":
          return (
            <input
              type="date"
              style={{
                ...style,
                fontFamily:
                  element.properties.fontFamily ||
                  "Poppins, system-ui, sans-serif",
                fontSize: `${element.properties.fontSize || 14}px`,
                fontWeight: element.properties.fontWeight || "normal",
                color: element.properties.color || "#000000",
                backgroundColor:
                  element.properties.backgroundColor || "#ffffff",
                borderColor: element.properties.borderColor || "#d1d5db",
                borderWidth: `${element.properties.borderWidth || 1}px`,
                borderStyle: "solid",
                borderRadius: `${element.properties.borderRadius || 6}px`,
                padding: `${element.properties.padding || 8}px`,
                outline: "none",
              }}
              className="w-full h-full"
              value={element.properties.value}
              readOnly
            />
          );
        case "upload":
          return (
            <div className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
              <svg
                className="w-8 h-8 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-gray-500">Upload File</span>
            </div>
          );
        case "addfile":
          // If file has been uploaded and it's an image, show the image
          if (
            element.properties?.src &&
            element.properties?.mimeType?.startsWith("image/")
          ) {
            return (
              <div className="w-full h-full overflow-hidden rounded-md border border-gray-300">
                <img
                  src={element.properties.src}
                  alt={element.properties?.alt || "Uploaded image"}
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover" }}
                />
              </div>
            );
          }
          // Otherwise show upload UI
          return (
            <div className="relative flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Check file size before upload
                    const maxSize = 50 * 1024 * 1024; // 50MB
                    if (file.size > maxSize) {
                      toast({
                        title: "File too large",
                        description: `File size exceeds 50MB limit. File size: ${(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)}MB`,
                        variant: "destructive",
                      });
                      return;
                    }

                    // Update the existing element with the uploaded file
                    await handleFileUpload(
                      file,
                      element.x,
                      element.y,
                      element.id
                    );
                  }
                }}
              />
              <svg
                className="w-8 h-8 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-gray-500">
                {element.properties?.fileName || "Add File"}
              </span>
              {element.properties?.fileName && (
                <span className="text-xs text-gray-400 mt-1">
                  {(element.properties.fileSize / 1024 / 1024).toFixed(2)}MB
                </span>
              )}
            </div>
          );
        case "rectangle":
          return <div style={style} className="w-full h-full" />;
        case "circle":
          return (
            <div
              style={{ ...style, borderRadius: "50%" }}
              className="w-full h-full"
            />
          );
        case "triangle": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${element.width} ${element.height}`}
            >
              <polygon
                points={`${element.width / 2},0 0,${element.height} ${
                  element.width
                },${element.height}`}
                fill={element.properties.backgroundColor || "#ffffff"}
                stroke={strokeWidth > 0 ? strokeColor : "none"}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        case "line":
          const lineStrokeWidth = element.properties.strokeWidth || 2;
          const lineStrokeColor = element.properties.strokeColor || "#000000";
          const lineStrokeStyle = element.properties.strokeStyle || "solid";
          const lineOpacity = element.properties.strokeOpacity || 1;
          return (
            <div
              style={{
                ...style,
                width: "100%",
                height: `${lineStrokeWidth}px`,
                opacity: lineOpacity,
                borderStyle:
                  lineStrokeStyle === "dashed"
                    ? "dashed"
                    : lineStrokeStyle === "dotted"
                    ? "dotted"
                    : "solid",
                borderWidth:
                  lineStrokeStyle !== "solid"
                    ? `${lineStrokeWidth}px 0 0 0`
                    : "0",
                borderColor:
                  lineStrokeStyle !== "solid" ? lineStrokeColor : "transparent",
                backgroundColor:
                  lineStrokeStyle === "solid" ? lineStrokeColor : "transparent",
              }}
            />
          );
        case "arrow":
          const arrowStrokeWidth = element.properties.strokeWidth || 2;
          const arrowStrokeColor = element.properties.strokeColor || "#000000";
          const arrowStrokeStyle = element.properties.strokeStyle || "solid";
          const arrowOpacity = element.properties.strokeOpacity || 1;
          const arrowHeadSize = element.properties.arrowHeadSize || 8;
          return (
            <div
              className="flex items-center w-full h-full"
              style={{ opacity: arrowOpacity }}
            >
              <div
                style={{
                  ...style,
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
        case "star": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <div className="flex items-center justify-center w-full h-full">
              <svg width="100%" height="100%" viewBox="0 0 24 24">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={element.properties.backgroundColor || "#fbbf24"}
                  stroke={strokeWidth > 0 ? strokeColor : "none"}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        }
        case "heart": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <div className="flex items-center justify-center w-full h-full">
              <svg width="100%" height="100%" viewBox="0 0 24 24">
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 17.77l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  fill={element.properties.backgroundColor || "#ef4444"}
                  stroke={strokeWidth > 0 ? strokeColor : "none"}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        }
        case "frame":
          return (
            <div
              style={style}
              className="w-full h-full border-2 border-dashed border-gray-300"
            />
          );
        case "divider":
          return <div style={{ ...style, width: "100%", height: "1px" }} />;

        // Icon Elements - Window Controls
        case "icon-minimize":
          const minimizeIconSize = element.properties.iconSize || 16;
          const minimizeIconColor = element.properties.iconColor || "#6b7280";
          const minimizeIconOpacity = element.properties.iconOpacity || 1;
          const minimizeIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <Minimize2
                style={{
                  width: `${minimizeIconSize}px`,
                  height: `${minimizeIconSize}px`,
                  color: minimizeIconColor,
                  opacity: minimizeIconOpacity,
                  transform: `rotate(${minimizeIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-maximize":
          const maximizeIconSize = element.properties.iconSize || 16;
          const maximizeIconColor = element.properties.iconColor || "#6b7280";
          const maximizeIconOpacity = element.properties.iconOpacity || 1;
          const maximizeIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <Maximize2
                style={{
                  width: `${maximizeIconSize}px`,
                  height: `${maximizeIconSize}px`,
                  color: maximizeIconColor,
                  opacity: maximizeIconOpacity,
                  transform: `rotate(${maximizeIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-close":
          const closeIconSize = element.properties.iconSize || 16;
          const closeIconColor = element.properties.iconColor || "#6b7280";
          const closeIconOpacity = element.properties.iconOpacity || 1;
          const closeIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <X
                style={{
                  width: `${closeIconSize}px`,
                  height: `${closeIconSize}px`,
                  color: closeIconColor,
                  opacity: closeIconOpacity,
                  transform: `rotate(${closeIconRotation}deg)`,
                }}
              />
            </div>
          );

        // Icon Elements - App Utilities
        case "icon-settings":
          const settingsIconSize = element.properties.iconSize || 16;
          const settingsIconColor = element.properties.iconColor || "#6b7280";
          const settingsIconOpacity = element.properties.iconOpacity || 1;
          const settingsIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <Settings
                style={{
                  width: `${settingsIconSize}px`,
                  height: `${settingsIconSize}px`,
                  color: settingsIconColor,
                  opacity: settingsIconOpacity,
                  transform: `rotate(${settingsIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-refresh":
          const refreshIconSize = element.properties.iconSize || 16;
          const refreshIconColor = element.properties.iconColor || "#6b7280";
          const refreshIconOpacity = element.properties.iconOpacity || 1;
          const refreshIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <RefreshCw
                style={{
                  width: `${refreshIconSize}px`,
                  height: `${refreshIconSize}px`,
                  color: refreshIconColor,
                  opacity: refreshIconOpacity,
                  transform: `rotate(${refreshIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-info":
          const infoIconSize = element.properties.iconSize || 16;
          const infoIconColor = element.properties.iconColor || "#6b7280";
          const infoIconOpacity = element.properties.iconOpacity || 1;
          const infoIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <Info
                style={{
                  width: `${infoIconSize}px`,
                  height: `${infoIconSize}px`,
                  color: infoIconColor,
                  opacity: infoIconOpacity,
                  transform: `rotate(${infoIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-help":
          const helpIconSize = element.properties.iconSize || 16;
          const helpIconColor = element.properties.iconColor || "#6b7280";
          const helpIconOpacity = element.properties.iconOpacity || 1;
          const helpIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <HelpCircle
                style={{
                  width: `${helpIconSize}px`,
                  height: `${helpIconSize}px`,
                  color: helpIconColor,
                  opacity: helpIconOpacity,
                  transform: `rotate(${helpIconRotation}deg)`,
                }}
              />
            </div>
          );
        case "icon-search":
          const searchIconSize = element.properties.iconSize || 16;
          const searchIconColor = element.properties.iconColor || "#6b7280";
          const searchIconOpacity = element.properties.iconOpacity || 1;
          const searchIconRotation = element.properties.iconRotation || 0;
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "transparent",
                borderRadius: `${element.properties.borderRadius || 0}px`,
                padding: `${element.properties.padding || 0}px`,
                border: element.properties.borderWidth
                  ? `${element.properties.borderWidth}px solid ${
                      element.properties.borderColor || "#d1d5db"
                    }`
                  : "none",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              <Search
                style={{
                  width: `${searchIconSize}px`,
                  height: `${searchIconSize}px`,
                  color: searchIconColor,
                  opacity: searchIconOpacity,
                  transform: `rotate(${searchIconRotation}deg)`,
                }}
              />
            </div>
          );

        // Icon Elements - Data Actions
        case "icon-add":
          return renderIconElement(element, Plus, style);
        case "icon-edit":
          return renderIconElement(element, Edit, style);
        case "icon-delete":
          return renderIconElement(element, Trash2, style);
        case "icon-save":
          return renderIconElement(element, Save, style);
        case "icon-download":
          return renderIconElement(element, Download, style);
        case "icon-upload":
          return renderIconElement(element, Upload, style);

        // Icon Elements - Navigation
        case "icon-home":
          return renderIconElement(element, Home, style);
        case "icon-back":
          return renderIconElement(element, ArrowLeft, style);
        case "icon-forward":
          return renderIconElement(element, ArrowRight, style);

        // Media Elements
        case "image":
          return (
            <div className="w-full h-full overflow-hidden rounded-md">
              {element.properties?.src ? (
                <img
                  src={element.properties.src}
                  alt={element.properties?.alt || "Uploaded image"}
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover", pointerEvents: "none" }}
                />
              ) : (
                <div
                  style={style}
                  className="w-full h-full bg-gray-100 flex items-center justify-center border border-gray-300"
                >
                  <span className="text-xs text-gray-400">No image</span>
                </div>
              )}
            </div>
          );
        case "video":
          return (
            <div className="w-full h-full overflow-hidden rounded-md">
              {element.properties?.src ? (
                <video
                  src={element.properties.src}
                  controls
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover" }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div
                  style={style}
                  className="w-full h-full bg-gray-100 flex items-center justify-center border border-gray-300"
                >
                  <span className="text-xs text-gray-400">No video</span>
                </div>
              )}
            </div>
          );
        case "audio":
          return (
            <div className="w-full h-full flex items-center justify-center p-2">
              {element.properties?.src ? (
                <audio src={element.properties.src} controls className="w-full">
                  Your browser does not support the audio tag.
                </audio>
              ) : (
                <div
                  style={style}
                  className="w-full h-full bg-gray-100 flex items-center justify-center border border-gray-300"
                >
                  <span className="text-xs text-gray-400">No audio</span>
                </div>
              )}
            </div>
          );
        case "media":
          return (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-50 border border-gray-300 rounded-md">
              {element.properties?.src ? (
                <>
                  <svg
                    className="w-10 h-10 text-gray-400 mb-2"
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
                  <span className="text-xs text-gray-600 text-center truncate w-full px-2">
                    {element.properties.fileName || "File"}
                  </span>
                  {element.properties.fileSize && (
                    <span className="text-xs text-gray-400 mt-1">
                      {(element.properties.fileSize / 1024 / 1024).toFixed(2)}MB
                    </span>
                  )}
                </>
              ) : (
                <div
                  style={style}
                  className="w-full h-full bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-xs text-gray-400">No file</span>
                </div>
              )}
            </div>
          );

        case "TEXT_DISPLAY":
        case "text_display":
          // Render TEXT_DISPLAY using the TextDisplay component
          // Import at top: import { TextDisplay } from "@/components/canvas/elements/TextDisplay";
          const TextDisplayComponent =
            require("@/components/canvas/elements/TextDisplay").TextDisplay;
          return (
            <div
              style={{ width: "100%", height: "100%", position: "relative" }}
            >
              <TextDisplayComponent
                element={element}
                context={{}}
                isPreviewMode={false}
              />
            </div>
          );

        case "button":
          return (
            <button
              style={style}
              className="px-4 py-2 w-full h-full font-medium"
            >
              {element.properties.text || "Button"}
            </button>
          );
        case "chart-bar":
        case "chart-line":
        case "chart-pie":
        case "chart-donut":
        case "kpi-card":
        case "table":
        case "matrix-chart":
          return (
            <ChartElement
              type={element.type}
              properties={element.properties}
              showHeader={element.properties?.showHeader ?? true}
            />
          );
        default:
          return (
            <div
              style={style}
              className="w-full h-full bg-gray-200 flex items-center justify-center"
            >
              <span className="text-xs text-gray-500">{element.type}</span>
            </div>
          );
      }
    })();

    return (
      <div
        key={element.id}
        // Enhanced selection indicators for multi-selection
        className={`absolute select-none ${
          isLocked ? "pointer-events-none" : "cursor-move"
        }`}
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: `rotate(${element.rotation}deg)`,
          opacity: element.opacity / 100,
          zIndex: element.zIndex,
        }}
        onMouseDown={(e) => {
          // Handle test button click
          if (element.id.startsWith("test-button-")) {
            console.log("🧪 Test button clicked - manually loading template");
            loadTemplateStructure("1"); // Manually load template ID 1
            return;
          }
          handleElementMouseDown(e, element);
        }}
      >
        {elementContent}

        {(isSelected || isMultiSelected || isGroupSelected) && !isLocked && (
          <>
            {/* Resize handles - only show for single selection */}
            {isSelected &&
              selectedElements.length === 1 &&
              !selectedGroup && ( // Only show resize handles for single element selection, not group selection
                <>
                  {/* Corner handles */}
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nw-resize hover:bg-blue-600 transition-colors"
                    style={{ left: -6, top: -6 }}
                    onMouseDown={(e) => handleResizeStart(e, "nw")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-ne-resize hover:bg-blue-600 transition-colors"
                    style={{ right: -6, top: -6 }}
                    onMouseDown={(e) => handleResizeStart(e, "ne")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-sw-resize hover:bg-blue-600 transition-colors"
                    style={{ left: -6, bottom: -6 }}
                    onMouseDown={(e) => handleResizeStart(e, "sw")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize hover:bg-blue-600 transition-colors"
                    style={{ right: -6, bottom: -6 }}
                    onMouseDown={(e) => handleResizeStart(e, "se")}
                  />
                  {/* Edge handles */}
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-n-resize hover:bg-blue-600 transition-colors"
                    style={{
                      left: "50%",
                      top: -6,
                      transform: "translateX(-50%)",
                    }}
                    onMouseDown={(e) => handleResizeStart(e, "n")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-s-resize hover:bg-blue-600 transition-colors"
                    style={{
                      left: "50%",
                      bottom: -6,
                      transform: "translateX(-50%)",
                    }}
                    onMouseDown={(e) => handleResizeStart(e, "s")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-w-resize hover:bg-blue-600 transition-colors"
                    style={{
                      left: -6,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    onMouseDown={(e) => handleResizeStart(e, "w")}
                  />
                  <div
                    className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-e-resize hover:bg-blue-600 transition-colors"
                    style={{
                      right: -6,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    onMouseDown={(e) => handleResizeStart(e, "e")}
                  />
                </>
              )}

            {/* Selection outline - different colors for single vs multi-selection */}
            <div
              className={`absolute inset-0 border-2 pointer-events-none rounded-sm ${
                isGroupSelected
                  ? "border-green-500"
                  : isSelected && selectedElements.length === 1
                  ? "border-blue-500"
                  : "border-purple-500"
              }`}
            />

            {/* Group indicator - Enhanced for form groups */}
            {isGrouped &&
              (() => {
                const elementGroup = currentGroups.find(
                  (g) => g.id === element.groupId
                );
                const isFormGroup = elementGroup?.type === "form";

                return (
                  <div
                    className={`absolute -top-6 -left-1 text-white text-xs px-1 py-0.5 rounded shadow-lg pointer-events-none ${
                      isFormGroup
                        ? "bg-blue-600" // Form groups get blue background
                        : "bg-green-600" // Regular groups get green background
                    }`}
                  >
                    {isFormGroup ? "📝" : "G"}
                  </div>
                );
              })()}

            {/* Element info tooltip - only for single selection */}
            {isSelected &&
              selectedElements.length === 1 &&
              !selectedGroup && ( // Only show tooltip for single element selection
                <div className="absolute -top-8 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none">
                  {element.type} ({Math.round(element.width)}×
                  {Math.round(element.height)})
                </div>
              )}
          </>
        )}

        {/* Lock indicator */}
        {isLocked && (
          <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1">
            <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  // Helper function for clean icon rendering (for preview mode)
  const renderIconElementClean = (
    element: CanvasElement,
    IconComponent: React.ComponentType<any>,
    style: React.CSSProperties
  ) => {
    const iconSize = element.properties.iconSize || 16;
    const iconColor = element.properties.iconColor || "#6b7280";
    const iconOpacity = element.properties.iconOpacity || 1;
    const iconRotation = element.properties.iconRotation || 0;

    return (
      <div
        style={{
          ...style,
          backgroundColor: element.properties.backgroundColor || "transparent",
          borderRadius: `${element.properties.borderRadius || 0}px`,
          padding: `${element.properties.padding || 0}px`,
          border: element.properties.borderWidth
            ? `${element.properties.borderWidth}px solid ${
                element.properties.borderColor || "#d1d5db"
              }`
            : "none",
        }}
        className="w-full h-full flex items-center justify-center"
      >
        <IconComponent
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            color: iconColor,
            opacity: iconOpacity,
            transform: `rotate(${iconRotation}deg)`,
          }}
        />
      </div>
    );
  };

  const renderElementClean = (element: CanvasElement) => {
    const isHidden = element.properties.hidden;
    if (isHidden) return null;

    const style: React.CSSProperties = {
      backgroundColor: element.properties.backgroundColor || "#ffffff",
      color: element.properties.color || "#000000",
      fontSize: `${element.properties.fontSize || 14}px`,
      fontWeight: element.properties.fontWeight || "normal",
      textAlign: element.properties.textAlign || "left",
      borderRadius: `${element.properties.borderRadius || 0}px`,
      opacity: element.opacity / 100,
      border:
        typeof element.properties.borderWidth === "number" &&
        element.properties.borderWidth > 0
          ? `${element.properties.borderWidth}px solid ${
              element.properties.borderColor || "#d1d5db"
            }`
          : undefined,
      boxShadow: element.properties.shadow
        ? "0 6px 18px rgba(0,0,0,0.15)"
        : undefined,
      backdropFilter: element.properties.backgroundBlur
        ? "blur(8px)"
        : undefined,
      WebkitBackdropFilter: element.properties.backgroundBlur
        ? "blur(8px)"
        : undefined,
    };

    // Helper function to update element properties in preview mode
    const updatePreviewElementProperty = (property: string, value: any) => {
      const updatedElement = {
        ...element,
        properties: { ...element.properties, [property]: value },
      };
      updatePageElements(currentPageId, (prev) =>
        prev.map((el) => (el.id === element.id ? updatedElement : el))
      );
    };

    const elementContent = (() => {
      switch (element.type) {
        case "textfield":
          return (
            <input
              style={{ ...style, outline: "none" }}
              className="px-3 py-2 w-full h-full"
              placeholder={element.properties.placeholder}
              defaultValue={element.properties.value}
              onChange={(e) => {
                // Update the element's value property
                updatePreviewElementProperty("value", e.target.value);
              }}
            />
          );
        case "text":
        case "TEXT_FIELD":
        case "SHAPE":
          // Handle text elements that might have been saved as SHAPE type
          if (
            element.properties.text !== undefined ||
            element.id.startsWith("text-")
          ) {
            return (
              <div
                style={{
                  ...style,
                  fontFamily:
                    element.properties.fontFamily ||
                    "Poppins, system-ui, sans-serif",
                  fontSize: `${element.properties.fontSize || 16}px`,
                  fontWeight: element.properties.fontWeight || "normal",
                  fontStyle: element.properties.fontStyle || "normal",
                  textDecoration: element.properties.textDecoration || "none",
                  textAlign: element.properties.textAlign || "left",
                  color: element.properties.color || "#000000",
                  lineHeight: element.properties.lineHeight || 1.5,
                  letterSpacing: `${element.properties.letterSpacing || 0}px`,
                  backgroundColor:
                    element.properties.backgroundColor || "transparent",
                  padding: "4px 8px",
                  cursor: "default", // Read-only cursor in preview mode
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent:
                    element.properties.textAlign === "center"
                      ? "center"
                      : element.properties.textAlign === "right"
                      ? "flex-end"
                      : "flex-start",
                  boxSizing: "border-box",
                  position: "relative",
                  userSelect: "none", // Prevent text selection in preview mode
                }}
                className="w-full h-full"
                contentEditable={false} // Read-only in preview mode
                suppressContentEditableWarning={true}
                // No event handlers in preview mode - text is read-only
              >
                {element.properties.text || ""}
              </div>
            );
          }
          // Fall through to default shape rendering for non-text SHAPE elements
          return (
            <div
              style={{
                ...style,
                backgroundColor:
                  element.properties.backgroundColor || "#e5e7eb",
                border: `2px solid ${
                  element.properties.borderColor || "#9ca3af"
                }`,
                borderRadius: `${element.properties.borderRadius || 4}px`,
              }}
              className="w-full h-full flex items-center justify-center text-gray-600"
            >
              Shape
            </div>
          );
        case "textarea":
          return (
            <textarea
              style={{ ...style, outline: "none" }}
              className="px-3 py-2 resize-none w-full h-full"
              placeholder={element.properties.placeholder}
              defaultValue={element.properties.value}
              rows={element.properties.rows}
              onChange={(e) => {
                updatePreviewElementProperty("value", e.target.value);
              }}
            />
          );
        case "button":
          return (
            <button
              style={style}
              className="px-4 py-2 w-full h-full font-medium hover:opacity-80 transition-opacity"
              onClick={() => {
                // You can add custom button functionality here
                console.log("Button clicked:", element.properties.text);
              }}
            >
              {element.properties.text || "Button"}
            </button>
          );
        case "checkbox":
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <input
                type="checkbox"
                defaultChecked={element.properties.checked}
                className="w-4 h-4"
                onChange={(e) => {
                  updatePreviewElementProperty("checked", e.target.checked);
                }}
              />
              <label style={style}>
                {element.properties.label || "Checkbox"}
              </label>
            </div>
          );
        case "radiobutton":
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <input
                type="radio"
                name={`radio-${element.id}`}
                defaultChecked={element.properties.checked}
                className="w-4 h-4"
                onChange={(e) => {
                  updatePreviewElementProperty("checked", e.target.checked);
                }}
              />
              <label style={style}>
                {element.properties.label || "Radio Button"}
              </label>
            </div>
          );
        case "dropdown":
          return (
            <select
              style={style}
              className="px-3 py-2 w-full h-full"
              defaultValue={element.properties.value}
              onChange={(e) => {
                updatePreviewElementProperty("value", e.target.value);
              }}
            >
              <option value="">
                {element.properties.placeholder || "Select option"}
              </option>
              {element.properties.options?.map(
                (option: string, index: number) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                )
              )}
            </select>
          );
        case "toggle":
          return (
            <div className="flex items-center space-x-2 w-full h-full px-2">
              <div
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                  element.properties.checked ? "bg-blue-500" : "bg-gray-300"
                }`}
                onClick={() => {
                  updatePreviewElementProperty(
                    "checked",
                    !element.properties.checked
                  );
                }}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    element.properties.checked
                      ? "translate-x-6"
                      : "translate-x-0"
                  }`}
                />
              </div>
              <label style={style} className="cursor-pointer">
                {element.properties.label || "Toggle"}
              </label>
            </div>
          );
        case "phone":
          return (
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              style={{ ...style, border: "1px solid #d1d5db", outline: "none" }}
              className="px-3 py-2 w-full h-full"
              placeholder={element.properties.placeholder || "Phone number"}
              defaultValue={element.properties.value}
              onChange={(e) => {
                // Only allow digits in preview mode input
                const raw = (e.target as HTMLInputElement).value || "";
                const digits = raw.replace(/\D+/g, "");

                if (raw !== digits) {
                  try {
                    showPrompt("Not a valid phone number. Please enter digits only.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }

                let normalized = digits;
                if (normalized.length > 10) {
                  normalized = normalized.slice(0, 10);
                  try {
                    showPrompt("Phone number must be 10 digits. Extra digits were removed.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }

                updatePreviewElementProperty("value", normalized);

                // reflect normalized value in the input if necessary
                try {
                  const input = e.target as HTMLInputElement;
                  if (input && input.value !== normalized) input.value = normalized;
                } catch (err) {
                  /* ignore DOM write errors */
                }
              }}
              onBlur={(e) => {
                const value = (e.target as HTMLInputElement).value || "";
                if (value.length !== 10) {
                  try {
                    showPrompt("Not a valid phone number. Phone number must be exactly 10 digits.");
                  } catch (err) {
                    console.warn("Prompt failed:", err);
                  }
                }
              }}
            />
          );
        case "password":
        case "PASSWORD_FIELD":
          return (
            <div style={{ ...style, position: "relative", paddingRight: 36 }}>
              <input
                type={showPasswordMap[element.id] ? "text" : "password"}
                style={{ ...{ border: "1px solid #d1d5db", outline: "none" }, boxSizing: "border-box", width: "100%", height: "100%" }}
                className="px-3 py-2 w-full h-full"
                placeholder={element.properties.placeholder || "Enter password"}
                defaultValue={element.properties.value}
                onChange={(e) => {
                  updatePreviewElementProperty("value", e.target.value);
                }}
              />

              <button
                type="button"
                onClick={() => toggleShowPassword(element.id)}
                aria-label={showPasswordMap[element.id] ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 8,
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.6)",
                  border: "none",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  zIndex: 999,
                  pointerEvents: "auto",
                  cursor: "pointer",
                }}
              >
                {showPasswordMap[element.id] ? (
                  <EyeOff size={16} color={element.properties.iconColor || "#6b7280"} />
                ) : (
                  <Eye size={16} color={element.properties.iconColor || "#6b7280"} />
                )}
              </button>
            </div>
          );
        case "calendar":
          return (
            <input
              type="date"
              style={{ ...style, border: "1px solid #d1d5db", outline: "none" }}
              className="px-3 py-2 w-full h-full"
              defaultValue={element.properties.value}
              onChange={(e) => {
                updatePreviewElementProperty("value", e.target.value);
              }}
            />
          );
        case "upload":
          // If file has been uploaded and it's an image, show the image
          if (
            element.properties?.src &&
            element.properties?.mimeType?.startsWith("image/")
          ) {
            return (
              <div className="w-full h-full overflow-hidden rounded-md border border-gray-300">
                <img
                  src={element.properties.src}
                  alt={element.properties?.alt || "Uploaded image"}
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover" }}
                />
              </div>
            );
          }
          // Otherwise show upload UI
          return (
            <div className="relative flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Check file size before upload
                    const maxSize = 50 * 1024 * 1024; // 50MB
                    if (file.size > maxSize) {
                      toast({
                        title: "File too large",
                        description: `File size exceeds 50MB limit. File size: ${(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)}MB`,
                        variant: "destructive",
                      });
                      return;
                    }

                    // Update the existing element with the uploaded file
                    await handleFileUpload(
                      file,
                      element.x,
                      element.y,
                      element.id
                    );
                  }
                }}
              />
              <svg
                className="w-8 h-8 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-gray-500">
                {element.properties?.fileName || "Upload File"}
              </span>
              {element.properties?.fileName && (
                <span className="text-xs text-gray-400 mt-1">
                  {(element.properties.fileSize / 1024 / 1024).toFixed(2)}MB
                </span>
              )}
            </div>
          );
        case "media":
          return (
            <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 transition-colors cursor-pointer">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          );
        case "image":
          return (
            <div className="w-full h-full overflow-hidden rounded-md border border-gray-300">
              {element.properties?.src ? (
                <img
                  src={element.properties.src}
                  alt={element.properties?.alt || "Uploaded image"}
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-100">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        case "video":
          return (
            <div className="w-full h-full overflow-hidden rounded-md border border-gray-300">
              {element.properties?.src ? (
                <video
                  src={element.properties.src}
                  controls
                  className="w-full h-full object-cover"
                  style={{ objectFit: "cover" }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-100">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        case "audio":
          return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md border border-gray-300">
              {element.properties?.src ? (
                <audio src={element.properties.src} controls className="w-full">
                  Your browser does not support the audio tag.
                </audio>
              ) : (
                <div className="flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                  <span className="text-sm text-gray-500">Audio File</span>
                </div>
              )}
            </div>
          );
        case "rectangle":
          return <div style={style} className="w-full h-full" />;
        case "circle":
          return (
            <div
              style={{ ...style, borderRadius: "50%" }}
              className="w-full h-full"
            />
          );
        case "triangle": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${element.width} ${element.height}`}
            >
              <polygon
                points={`${element.width / 2},0 0,${element.height} ${
                  element.width
                },${element.height}`}
                fill={element.properties.backgroundColor || "#ffffff"}
                stroke={strokeWidth > 0 ? strokeColor : "none"}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        case "line":
          const lineStrokeWidth = element.properties.strokeWidth || 2;
          const lineStrokeColor = element.properties.strokeColor || "#000000";
          const lineStrokeStyle = element.properties.strokeStyle || "solid";
          const lineOpacity = element.properties.strokeOpacity || 1;
          return (
            <div
              style={{
                ...style,
                width: "100%",
                height: `${lineStrokeWidth}px`,
                opacity: lineOpacity,
                borderStyle:
                  lineStrokeStyle === "dashed"
                    ? "dashed"
                    : lineStrokeStyle === "dotted"
                    ? "dotted"
                    : "solid",
                borderWidth:
                  lineStrokeStyle !== "solid"
                    ? `${lineStrokeWidth}px 0 0 0`
                    : "0",
                borderColor:
                  lineStrokeStyle !== "solid" ? lineStrokeColor : "transparent",
                backgroundColor:
                  lineStrokeStyle === "solid" ? lineStrokeColor : "transparent",
              }}
            />
          );
        case "arrow":
          const arrowStrokeWidth = element.properties.strokeWidth || 2;
          const arrowStrokeColor = element.properties.strokeColor || "#000000";
          const arrowStrokeStyle = element.properties.strokeStyle || "solid";
          const arrowOpacity = element.properties.strokeOpacity || 1;
          const arrowHeadSize = element.properties.arrowHeadSize || 8;
          return (
            <div
              className="flex items-center w-full h-full"
              style={{ opacity: arrowOpacity }}
            >
              <div
                style={{
                  ...style,
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
        case "star": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <div className="flex items-center justify-center w-full h-full">
              <svg width="100%" height="100%" viewBox="0 0 24 24">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={element.properties.backgroundColor || "#fbbf24"}
                  stroke={strokeWidth > 0 ? strokeColor : "none"}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        }
        case "heart": {
          const strokeColor = element.properties.borderColor || "transparent";
          const strokeWidth = element.properties.borderWidth || 0;
          return (
            <div className="flex items-center justify-center w-full h-full">
              <svg width="100%" height="100%" viewBox="0 0 24 24">
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 17.77l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  fill={element.properties.backgroundColor || "#ef4444"}
                  stroke={strokeWidth > 0 ? strokeColor : "none"}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        }

        case "chart-bar":
        case "chart-line":
        case "chart-pie":
        case "chart-donut":
        case "kpi-card":
        case "table":
        case "matrix-chart":
          return (
            <ChartElement
              type={element.type}
              properties={element.properties}
              showHeader={element.properties?.showHeader ?? true}
            />
          );

        case "frame":
          return (
            <div
              style={style}
              className="w-full h-full border border-gray-200 flex items-center justify-center"
            >
              <span className="text-gray-400 text-sm">Frame</span>
            </div>
          );
        case "divider":
          return <div style={{ ...style, width: "100%", height: "1px" }} />;

        // Icon Elements - Window Controls
        case "icon-minimize":
          return renderIconElementClean(element, Minimize2, style);
        case "icon-maximize":
          return renderIconElementClean(element, Maximize2, style);
        case "icon-close":
          return renderIconElementClean(element, X, style);

        // Icon Elements - App Utilities
        case "icon-settings":
          return renderIconElementClean(element, Settings, style);
        case "icon-refresh":
          return renderIconElementClean(element, RefreshCw, style);
        case "icon-info":
          return renderIconElementClean(element, Info, style);
        case "icon-help":
          return renderIconElementClean(element, HelpCircle, style);
        case "icon-search":
          return renderIconElementClean(element, Search, style);

        // Icon Elements - Data Actions
        case "icon-add":
          return renderIconElementClean(element, Plus, style);
        case "icon-edit":
          return renderIconElementClean(element, Edit, style);
        case "icon-delete":
          return renderIconElementClean(element, Trash2, style);
        case "icon-save":
          return renderIconElementClean(element, Save, style);
        case "icon-download":
          return renderIconElementClean(element, Download, style);
        case "icon-upload":
          return renderIconElementClean(element, Upload, style);

        // Icon Elements - Navigation
        case "icon-home":
          return renderIconElementClean(element, Home, style);
        case "icon-back":
          return renderIconElementClean(element, ArrowLeft, style);
        case "icon-forward":
          return renderIconElementClean(element, ArrowRight, style);

        case "TEXT_DISPLAY":
        case "text_display":
          // Render TEXT_DISPLAY using the TextDisplay component in preview mode
          const TextDisplayComponentPreview =
            require("@/components/canvas/elements/TextDisplay").TextDisplay;
          return (
            <div
              style={{ width: "100%", height: "100%", position: "relative" }}
            >
              <TextDisplayComponentPreview
                element={element}
                context={{}}
                isPreviewMode={true}
              />
            </div>
          );

        default:
          return (
            <div
              style={style}
              className="w-full h-full bg-gray-200 flex items-center justify-center"
            >
              <span className="text-xs text-gray-500">{element.type}</span>
            </div>
          );
      }
    })();

    return (
      <div
        key={element.id}
        className="absolute"
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: `rotate(${element.rotation}deg)`,
          opacity: element.opacity / 100,
          zIndex: element.zIndex,
        }}
      >
        {elementContent}
      </div>
    );
  };

  const saveApp = async () => {
    try {
      if (!currentAppId) {
        console.warn("⚠️ No app ID available for saving");
        toast({
          title: "Error",
          description: "No app ID available for saving.",
          variant: "destructive",
        });
        return;
      }

      // Manual save to backend when Save button is clicked
      manualSave();
      console.log("✅ Manual save triggered successfully");
      toast({
        title: "Success",
        description: "App saved successfully!",
      });

      // Show success feedback
      const button = document.querySelector(
        "[data-save-button]"
      ) as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Saved!";
        button.classList.add("bg-green-500");
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("bg-green-500");
        }, 2000);
      }
    } catch (error) {
      console.error("Error saving app:", error);
      try {
        showPrompt("Error saving app. Please try again.");
      } catch (err) {
        console.warn("Prompt failed:", err);
      }
    }
  };

  const addNewPage = () => {
    const newPageId = `page-${Date.now()}`;
    const newPage: Page = {
      id: newPageId,
      name: `Page ${pages.length + 1}`,
      elements: [],
      groups: [], // Initialize groups for new page
      visible: true,
      canvasBackground: {
        type: "color",
        color: "#ffffff",
      },
      canvasWidth: 1200, // Default canvas width
      canvasHeight: 800, // Default canvas height
    };
    saveToHistory();
    setPages((prev) => [...prev, newPage]);
    setCurrentPageId(newPageId);
    setExpandedPages((prev) => new Set([...prev, newPageId]));
    setSelectedElement(null);
    setSelectedElements([]);
    setSelectedGroup(null); // Deselect group when adding new page
    setShowCanvasProperties(true);
  };

  const startPageRename = (pageId: string, currentName: string) => {
    setEditingPageId(pageId);
    setEditingPageName(currentName);
  };

  const finishPageRename = () => {
    if (editingPageId && editingPageName.trim()) {
      saveToHistory();
      setPages((prev) =>
        prev.map((page) =>
          page.id === editingPageId
            ? { ...page, name: editingPageName.trim() }
            : page
        )
      );
    }
    setEditingPageId(null);
    setEditingPageName("");
  };

  const cancelPageRename = () => {
    setEditingPageId(null);
    setEditingPageName("");
  };

  const deletePage = (pageId: string) => {
    if (pages.length <= 1) return; // Don't delete the last page

    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) return;

    saveToHistory();
    setPages((prev) => prev.filter((page) => page.id !== pageId));

    // Switch to another page if we deleted the current one
    if (currentPageId === pageId) {
      const remainingPages = pages.filter((p) => p.id !== pageId);
      const newCurrentPage = remainingPages[Math.max(0, pageIndex - 1)];
      setCurrentPageId(newCurrentPage.id);
    }

    setSelectedElement(null);
    setSelectedElements([]);
    setSelectedGroup(null); // Deselect group when deleting page
  };

  const duplicatePage = (pageId: string) => {
    const pageToClone = pages.find((p) => p.id === pageId);
    if (!pageToClone) return;

    const newPageId = `page-${Date.now()}`;
    const clonedPage: Page = {
      ...pageToClone,
      id: newPageId,
      name: `${pageToClone.name} Copy`,
      elements: pageToClone.elements.map((el) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        pageId: newPageId,
      })),
      groups: pageToClone.groups.map((group) => ({
        // Duplicate groups
        ...group,
        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        elementIds: group.elementIds.map((elId) => {
          // Find the corresponding duplicated element ID
          const originalElement = pageToClone.elements.find(
            (el) => el.id === elId
          );
          if (originalElement) {
            const duplicatedElementId = `${
              originalElement.type
            }-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // This is a bit tricky, we need to map original element IDs to new ones.
            // For simplicity here, we'll just generate new IDs, assuming the order is preserved.
            // A more robust solution would involve a mapping.
            return duplicatedElementId;
          }
          return elId; // Fallback
        }),
      })),
      canvasWidth: pageToClone.canvasWidth, // Duplicate canvas dimensions
      canvasHeight: pageToClone.canvasHeight,
    };
    saveToHistory();
    setPages((prev) => [...prev, clonedPage]);
    setCurrentPageId(newPageId);
    setExpandedPages((prev) => new Set([...prev, newPageId]));
    setSelectedElement(null);
    setSelectedElements([]);
    setSelectedGroup(null); // Deselect group when duplicating page
  };

  // const switchToPage = (pageId: string) => {
  //   setCurrentPageId(pageId)
  //   setSelectedElement(null)
  //   setSelectedElements([])
  //   setSelectedGroup(null) // Deselect group when switching page
  //   setShowCanvasProperties(true)
  // }

  const resetCanvasView = () => {
    setCanvasTransform({ x: 0, y: 0, scale: 1 });
  };

  const zoomIn = () => {
    setCanvasTransform((prev) => ({
      ...prev,
      scale: Math.min(3, prev.scale * 1.2),
    }));
  };

  const zoomOut = () => {
    setCanvasTransform((prev) => ({
      ...prev,
      scale: Math.max(0.1, prev.scale * 0.8),
    }));
  };

  // Function to load all workflows from backend
  const loadWorkflowsFromBackend = async (appId: string) => {
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️  No auth token found");
        return;
      }

      console.log(
        "📖 PREVIEW: Loading all workflows from backend for app:",
        appId
      );

      const response = await fetch(`/api/canvas/workflows/${appId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        const workflowsArray = data.data;
        console.log(
          `✅ PREVIEW: Loaded ${workflowsArray.length} workflows from backend`
        );

        // Build workflows map by elementId
        const workflowsMap = new Map();
        workflowsArray.forEach((workflow: any) => {
          if (workflow.elementId) {
            workflowsMap.set(workflow.elementId, {
              nodes: workflow.nodes,
              edges: workflow.edges,
            });
            console.log(
              `  - PREVIEW: Workflow for element ${workflow.elementId}: ${workflow.nodes.length} nodes, ${workflow.edges.length} edges`
            );
          }
        });

        setWorkflows(workflowsMap);
        console.log(
          "✅ PREVIEW: Workflows loaded into context:",
          workflowsMap.size
        );
      } else {
        console.log("ℹ️  PREVIEW: No workflows found for app:", appId);
      }
    } catch (error) {
      console.error("❌ PREVIEW: Error loading workflows from backend:", error);
    }
  };

  const togglePreviewMode = async () => {
    const newPreviewMode = !isPreviewMode;
    setIsPreviewMode(newPreviewMode);
    setSelectedElement(null);
    setSelectedElements([]);
    setSelectedGroup(null); // Deselect group when toggling preview

    // Load workflows from backend when entering preview mode
    if (newPreviewMode && currentAppId) {
      await loadWorkflowsFromBackend(currentAppId);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}

      <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-90 text-white text-xs p-4 rounded-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none max-w-md">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="font-semibold text-blue-300 mb-1">
            File Operations
          </div>
          <div></div>
          <div>Ctrl+S: Save</div>
          <div>Ctrl+N: New Page</div>
          <div></div>
          <div></div>

          <div className="font-semibold text-green-300 mb-1">History</div>
          <div></div>
          <div>Ctrl+Z: Undo</div>
          <div>Ctrl+Y: Redo</div>
          <div></div>
          <div></div>

          <div className="font-semibold text-yellow-300 mb-1">Selection</div>
          <div></div>
          <div>Ctrl+A: Select All</div>
          <div>Esc: Deselect</div>
          <div></div>
          <div></div>

          <div className="font-semibold text-purple-300 mb-1">Clipboard</div>
          <div></div>
          <div>Ctrl+C: Copy</div>
          <div>Ctrl+V: Paste</div>
          <div>Ctrl+X: Cut</div>
          <div>Ctrl+D: Duplicate</div>

          <div className="font-semibold text-red-300 mb-1">Elements</div>
          <div></div>
          <div>Del/Backspace: Delete</div>
          <div>Ctrl+G: Group</div>
          <div>Ctrl+Shift+G: Ungroup</div>
          <div></div>

          <div className="font-semibold text-cyan-300 mb-1">Layers</div>
          <div></div>
          <div>Ctrl+]: Bring Forward</div>
          <div>Ctrl+[: Send Backward</div>
          <div>Ctrl+Shift+]: Bring to Front</div>
          <div>Ctrl+Shift+[: Send to Back</div>

          <div className="font-semibold text-orange-300 mb-1">Properties</div>
          <div></div>
          <div>Ctrl+L: Toggle Lock</div>
          <div>Ctrl+H: Toggle Hide</div>
          <div></div>
          <div></div>

          <div className="font-semibold text-pink-300 mb-1">Canvas</div>
          <div></div>
          <div>Space: Pan Mode</div>
          <div>Ctrl+R: Preview</div>
          <div>Ctrl+0: Reset View</div>
          <div>Ctrl+=: Zoom In</div>
          <div>Ctrl+-: Zoom Out</div>
          <div></div>

          <div className="font-semibold text-indigo-300 mb-1">Movement</div>
          <div></div>
          <div>Arrows: Move 1px</div>
          <div>Shift+Arrows: Move 10px</div>
          <div></div>
          <div></div>

          <div className="font-semibold text-teal-300 mb-1">Navigation</div>
          <div></div>
          <div>1-9: Switch Pages</div>
          <div>Ctrl+F: Find</div>
          <div></div>
          <div></div>
        </div>
      </div>

      {isPreviewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl max-h-[95vh] w-full mx-4 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                Preview - {currentPage?.name}
              </h2>
              <div className="flex items-center space-x-2">
                {pages.map((page, index) => (
                  <Button
                    key={page.id}
                    size="sm"
                    variant={currentPageId === page.id ? "default" : "ghost"}
                    onClick={() => switchToPage(page.id)}
                  >
                    {index + 1}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={togglePreviewMode}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div
                className="relative border rounded-lg mx-auto"
                style={{
                  ...getCanvasBackgroundStyle(),
                  width: `${currentPage?.canvasWidth || 1200}px`,
                  height: `${currentPage?.canvasHeight || 800}px`,
                  minHeight: "600px",
                }}
              >
                {canvasElements.map((element) => renderElementClean(element))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isPreviewMode && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Element toolbar */}
          {currentView === "canvas" && !isLeftPanelHidden && (
            <ElementToolbar
              onDragStart={handleDragStart}
              canvasElements={canvasElements}
              selectedElement={selectedElement}
              onSelectElement={(element) => {
                setSelectedElement(element);
                setSelectedElements([element]);
                setSelectedGroup(null);
                setShowCanvasProperties(false);
              }}
              onUpdateElementProperty={updateElementProperty}
              onCreateGroup={
                selectedElements.length >= 2 ? createGroup : undefined
              }
              onUngroupElements={ungroupElements}
              selectedGroup={selectedGroup}
            />
          )}

          {/* Canvas area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden ">
            {/* VIEW SWITCHER - placed inside canvas column so it doesn't steal horizontal space */}
            <header className="sticky top-0 z-40 w-full border-b border-gray-200/70 bg-gradient-to-r from-gray-50 to-gray-100 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4">
                {/* Left: Brand + Segmented Switch */}
                <div className="flex min-w-0 items-center gap-3">
                  {/* Segmented control (Canvas / Database) */}
                  <div className="hidden sm:flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                    <button
                      onClick={() => setCurrentView("canvas")}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        currentView === "canvas"
                          ? "bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/50 dark:text-blue-300"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/60"
                      }`}
                      aria-pressed={currentView === "canvas"}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>Canvas</span>
                    </button>
                    <button
                      onClick={() => setCurrentView("database")}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        currentView === "database"
                          ? "bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/50 dark:text-blue-300"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/60"
                      }`}
                      aria-pressed={currentView === "database"}
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span>Database</span>
                    </button>
                  </div>
                  {/* Auto-save status */}
                  {autoSaveStatus !== "idle" && (
                    <div className="ml-1 hidden items-center gap-1 text-xs md:flex">
                      {autoSaveStatus === "saving" && (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                          <span className="text-blue-600 dark:text-blue-400">
                            Saving…
                          </span>
                        </>
                      )}
                      {autoSaveStatus === "saved" && (
                        <>
                          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                          <span className="text-green-600 dark:text-green-400">
                            Saved
                          </span>
                        </>
                      )}
                      {autoSaveStatus === "error" && (
                        <>
                          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                          <span
                            className="text-red-600 dark:text-red-400"
                            title={autoSaveError || "Auto-save failed"}
                          >
                            Save failed
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions + Status */}
                <div className="flex items-center gap-2">
                  {/* Preview toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={togglePreviewMode}
                    className="hidden md:inline-flex"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    {isPreviewMode ? "Exit Preview" : "Preview"}
                  </Button>

                  {/* Save */}
                  <Button
                    size="sm"
                    onClick={saveApp}
                    data-save-button
                    className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/90 text-white dark:text-white"
                  >
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Save
                  </Button>

                  {/* View Options */}
                  <div className="flex items-center space-x-1">
                    <Button
                      disabled={isSplitScreenMode}
                      className={
                        isSplitScreenMode ? "cursor-not-allowed opacity-50" : ""
                      }
                      size="sm"
                      variant={isLeftPanelHidden ? "default" : "outline"}
                      title="Hide Elements Panel"
                      onClick={() => setIsLeftPanelHidden(!isLeftPanelHidden)}
                    >
                      <Eye
                        className={`w-3 h-3 ${
                          isLeftPanelHidden ? "hidden" : ""
                        }`}
                      />
                      <EyeOff
                        className={`w-3 h-3 ${
                          isLeftPanelHidden ? "" : "hidden"
                        }`}
                      />
                    </Button>
                    <Button
                      disabled={isSplitScreenMode}
                      className={
                        isSplitScreenMode ? "cursor-not-allowed opacity-50" : ""
                      }
                      size="sm"
                      variant={isRightPanelHidden ? "default" : "outline"}
                      title="Hide Properties Panel"
                      onClick={() => setIsRightPanelHidden(!isRightPanelHidden)}
                    >
                      <Eye
                        className={`w-3 h-3 ${
                          isRightPanelHidden ? "hidden" : ""
                        }`}
                      />
                      <EyeOff
                        className={`w-3 h-3 ${
                          isRightPanelHidden ? "" : "hidden"
                        }`}
                      />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile segmented control */}
              <div className="sm:hidden border-t border-gray-200/70 bg-white/70 px-3 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentView("canvas")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      currentView === "canvas"
                        ? "bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/50 dark:text-blue-300"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/70"
                    }`}
                    aria-pressed={currentView === "canvas"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span>Canvas</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("database")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      currentView === "database"
                        ? "bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/50 dark:text-blue-300"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/70"
                    }`}
                    aria-pressed={currentView === "database"}
                  >
                    <Database className="h-4 w-4" />
                    <span>Database</span>
                  </button>
                </div>
              </div>
            </header>
            {currentView === "database" ? (
              <div className="flex-1 overflow-hidden">
                <DatabaseTab />
              </div>
            ) : null}
            {currentView === "canvas" && (
              <>
                {/* Page tabs */}
                <div className="flex items-center px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="flex items-center space-x-2 overflow-x-auto ">
                    {pages.map((page, index) => (
                      <div
                        key={page.id}
                        className="flex items-center space-x-1 group"
                      >
                        <div className="relative">
                          <Button
                            size="sm"
                            variant={
                              currentPageId === page.id ? "default" : "ghost"
                            }
                            onClick={() => switchToPage(page.id)}
                            onDoubleClick={() =>
                              startPageRename(page.id, page.name)
                            }
                            className={`flex items-center gap-2 h-8 pr-8 ${
                              currentPageId === page.id
                                ? "bg-[var(--brand-blue)] text-white dark:text-white"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span className="text-xs">{index + 1}</span>
                            {editingPageId === page.id ? (
                              <input
                                type="text"
                                value={editingPageName}
                                onChange={(e) =>
                                  setEditingPageName(e.target.value)
                                }
                                onBlur={finishPageRename}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") finishPageRename();
                                  if (e.key === "Escape") cancelPageRename();
                                }}
                                className="text-xs bg-transparent border-none outline-none w-20 text-gray-900 dark:text-white"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="text-xs">{page.name}</span>
                            )}
                            {!page.visible && <EyeOff className="w-3 h-3" />}
                          </Button>

                          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ">
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startPageRename(page.id, page.name);
                                }}
                                className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center"
                                title="Rename page"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicatePage(page.id);
                                }}
                                className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center"
                                title="Duplicate page"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                              {pages.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        `Are you sure you want to delete "${page.name}"?`
                                      )
                                    ) {
                                      deletePage(page.id);
                                    }
                                  }}
                                  className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-[var(--brand-pink)] dark:hover:text-[var(--brand-pink)] flex items-center justify-center"
                                  title="Delete page"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {index < pages.length - 1 && (
                          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 flex min-h-0 overflow-hidden  relative custom-scrollbar">
                  <div
                    ref={canvasContainerRef}
                    className="flex-1 overflow-auto relative bg-gray-100 dark:bg-gray-900"
                    onWheel={handleWheel}
                    style={{
                      minHeight: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      paddingTop: "2rem",
                      paddingBottom: "2rem",
                    }}
                  >
                    {/* Grid background - positioned behind the canvas */}
                    <div
                      className="absolute opacity-20 dark:opacity-10 pointer-events-none"
                      style={{
                        left: "50%",
                        top: "2rem",
                        width: `${
                          (currentPage?.canvasWidth || 1200) *
                          canvasTransform.scale
                        }px`,
                        height: `${
                          (currentPage?.canvasHeight || 800) *
                          canvasTransform.scale
                        }px`,
                        transform: `translateX(-50%) translate(${canvasTransform.x}px, ${canvasTransform.y}px)`,
                        backgroundImage: `
                      linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                    `,
                        backgroundSize: `${20 * canvasTransform.scale}px ${
                          20 * canvasTransform.scale
                        }px`,
                      }}
                    />

                    {/* Canvas */}
                    <div
                      ref={canvasRef}
                      className="relative mx-auto"
                      style={{
                        width: `${currentPage?.canvasWidth || 1200}px`,
                        height: `${currentPage?.canvasHeight || 800}px`,
                        transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
                        transformOrigin: "0 0",
                        cursor: isPanning
                          ? "grabbing"
                          : canvasMode === "pan"
                          ? "grab"
                          : canvasMode === "text"
                          ? "text"
                          : "default",
                        border: isDragOverCanvas
                          ? "2px dashed #3b82f6"
                          : "1px solid #e5e7eb",
                        boxShadow: isDragOverCanvas
                          ? "0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                          : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                        backgroundColor: isDragOverCanvas
                          ? "rgba(59, 130, 246, 0.02)"
                          : undefined,
                        transition: "all 0.2s ease",
                        ...getCanvasBackgroundStyle(),
                      }}
                      onDrop={handleDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setIsDragOverCanvas(true);
                      }}
                      onDragLeave={() => setIsDragOverCanvas(false)}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onClick={handleCanvasClick}
                    >
                      {canvasElements
                        .sort((a, b) => a.zIndex - b.zIndex)
                        .map((element) => {
                          const elementComponent = renderElement(element);
                          // Add selection indicator for multi-selection
                          if (
                            selectedElements.length > 1 &&
                            selectedElements.includes(element)
                          ) {
                            return (
                              <div key={element.id} className="relative">
                                {elementComponent}
                                {/* Multi-selection indicator */}
                                <div className="absolute inset-0 border-2 border-blue-400 bg-blue-100 bg-opacity-20 pointer-events-none rounded" />
                              </div>
                            );
                          }
                          return elementComponent;
                        })}

                      {selectionBox && (
                        <div
                          className="absolute border-2 border-blue-400 bg-blue-100 bg-opacity-20 pointer-events-none"
                          style={{
                            left: selectionBox.x,
                            top: selectionBox.y,
                            width: selectionBox.width,
                            height: selectionBox.height,
                          }}
                        />
                      )}

                      {/* Floating Group Buttons */}
                      {selectedElements.length > 1 && (
                        <div
                          className="absolute pointer-events-auto z-50 flex gap-2"
                          style={{
                            left:
                              Math.min(...selectedElements.map((el) => el.x)) +
                              (Math.max(
                                ...selectedElements.map((el) => el.x + el.width)
                              ) -
                                Math.min(
                                  ...selectedElements.map((el) => el.x)
                                )) /
                                2 -
                              80,
                            top:
                              Math.min(...selectedElements.map((el) => el.y)) -
                              60,
                          }}
                        >
                          <Button
                            onClick={createGroup}
                            className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/90 text-white dark:text-white shadow-xl rounded-full w-24 h-10 flex items-center justify-center gap-2 text-sm font-medium border-2 border-[var(--brand-blue)] transition-all duration-200 hover:scale-105"
                            title="Group selected elements (Ctrl+G)"
                          >
                            <Layers className="w-4 h-4" />
                            Group
                          </Button>

                          {/* Create Form Button - only show if selection includes form elements (NOT buttons) */}
                          {(() => {
                            const hasFormElements = selectedElements.some(
                              (el) =>
                                [
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
                                  "FILE_UPLOAD",
                                  "UPLOAD",
                                  "ADDFILE",
                                ].includes(el.type)
                            );
                            console.log("🔍 Form button check:", {
                              selectedElements: selectedElements.map((el) => ({
                                id: el.id,
                                type: el.type,
                                name: el.name,
                              })),
                              hasFormElements,
                            });
                            return hasFormElements;
                          })() && (
                            <Button
                              onClick={createFormGroup}
                              className="bg-blue-600 hover:bg-blue-700 text-white dark:text-white shadow-xl rounded-full w-28 h-10 flex items-center justify-center gap-2 text-sm font-medium border-2 border-blue-600 transition-all duration-200 hover:scale-105"
                              title="Create form group from selected elements"
                            >
                              📝 Form
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Floating Ungroup Button */}
                      {selectedGroup && (
                        <div
                          className="absolute pointer-events-auto z-50"
                          style={{
                            left:
                              Math.min(
                                ...canvasElements
                                  .filter(
                                    (el) => el.groupId === selectedGroup.id
                                  )
                                  .map((el) => el.x)
                              ) +
                              (Math.max(
                                ...canvasElements
                                  .filter(
                                    (el) => el.groupId === selectedGroup.id
                                  )
                                  .map((el) => el.x + el.width)
                              ) -
                                Math.min(
                                  ...canvasElements
                                    .filter(
                                      (el) => el.groupId === selectedGroup.id
                                    )
                                    .map((el) => el.x)
                                )) /
                                2 -
                              60,
                            top:
                              Math.min(
                                ...canvasElements
                                  .filter(
                                    (el) => el.groupId === selectedGroup.id
                                  )
                                  .map((el) => el.y)
                              ) - 60,
                          }}
                        >
                          <Button
                            onClick={() => ungroupElements(selectedGroup.id)}
                            className="bg-orange-500 hover:bg-orange-600 text-white dark:text-white shadow-xl rounded-full w-28 h-10 flex items-center justify-center gap-2 text-sm font-medium border-2 border-orange-500 transition-all duration-200 hover:scale-105"
                            title="Ungroup elements (Ctrl+Shift+G)"
                          >
                            <Layers className="w-4 h-4" />
                            Ungroup
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute max-w-280 flex items-center justify-center bottom-6 left-4 right-4 z-50 pointer-events-none">
                    <div className="flex items-center w-fit overflow-x-auto no-scrollbar space-x-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-2 shadow-2xl border border-gray-200/50 dark:border-gray-700/50 pointer-events-auto">
                      {/* Canvas tools */}
                      <div className="flex items-center flex-nowrap space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <Button
                          size="sm"
                          variant={
                            canvasMode === "select" ? "default" : "ghost"
                          }
                          onClick={() => setCanvasMode("select")}
                          className="h-8 px-3"
                          title="Select Tool"
                        >
                          <MousePointer className="w-3 h-3 mr-1" />
                          Select
                        </Button>
                        <Button
                          size="sm"
                          variant={canvasMode === "pan" ? "default" : "ghost"}
                          onClick={() => setCanvasMode("pan")}
                          className="h-8 px-3"
                          title="Pan Tool"
                        >
                          <Hand className="w-3 h-3 mr-1" />
                          Pan
                        </Button>
                        <Button
                          size="sm"
                          variant={canvasMode === "text" ? "default" : "ghost"}
                          onClick={() => setCanvasMode("text")}
                          className="h-8 px-3"
                          title="Text Tool"
                        >
                          <Type className="w-3 h-3 mr-1" />
                          Text
                        </Button>
                      </div>

                      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={undo}
                          disabled={historyIndex <= 0}
                          title="Undo (Ctrl+Z)"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                            />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={redo}
                          disabled={historyIndex >= history.length - 1}
                          title="Redo (Ctrl+Y)"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                            />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={deleteSelectedElements}
                          disabled={selectedElements.length === 0}
                          title="Delete Selected (Del)"
                          className="text-[var(--brand-pink)] hover:text-[var(--brand-pink)] hover:bg-[var(--brand-pink)]/10 dark:text-[var(--brand-pink)] dark:hover:bg-[var(--brand-pink)]/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                      {/* Zoom controls */}
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={zoomOut}
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[3rem] text-center">
                          {Math.round(canvasTransform.scale * 100)}%
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={zoomIn}
                          title="Zoom In"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resetCanvasView}
                          title="Reset View"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                      {/* Action buttons */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addNewPage}
                        title="Add Page"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Page
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setShowCanvasProperties(!showCanvasProperties)
                        }
                        className={
                          showCanvasProperties
                            ? "bg-[var(--brand-blue)]/10 border-[var(--brand-blue)] text-[var(--brand-blue)] dark:bg-[var(--brand-blue)]/20 dark:border-[var(--brand-blue)] dark:text-[var(--brand-blue)]"
                            : ""
                        }
                        title="Canvas Settings"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Canvas
                      </Button>
                    </div>
                  </div>

                  {/* Text Formatting Toolbar - Fixed to canvas container */}
                  {selectedElement &&
                    (selectedElement.type === "TEXT_FIELD" ||
                      selectedElement.type === "text" ||
                      (selectedElement.type === "SHAPE" &&
                        selectedElement.properties.text !== undefined)) && (
                      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                        <div className="flex items-center space-x-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-gray-200/50 dark:border-gray-700/50 pointer-events-auto">
                          {/* Font Size Control */}
                          <div className="flex items-center space-x-1">
                            <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                              Size:
                            </label>
                            <input
                              type="number"
                              value={selectedElement.properties.fontSize || 16}
                              onChange={(e) =>
                                updateElementProperty(
                                  "fontSize",
                                  Number.parseInt(e.target.value) || 16
                                )
                              }
                              className="w-16 h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              min={8}
                              max={72}
                            />
                          </div>

                          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                          {/* Font Weight Controls */}
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.fontWeight === "bold"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty(
                                  "fontWeight",
                                  selectedElement.properties.fontWeight ===
                                    "bold"
                                    ? "normal"
                                    : "bold"
                                )
                              }
                              className="h-8 px-2"
                              title="Bold"
                            >
                              <strong className="text-sm">B</strong>
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.fontStyle ===
                                "italic"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty(
                                  "fontStyle",
                                  selectedElement.properties.fontStyle ===
                                    "italic"
                                    ? "normal"
                                    : "italic"
                                )
                              }
                              className="h-8 px-2"
                              title="Italic"
                            >
                              <em className="text-sm">I</em>
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.textDecoration ===
                                "underline"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty(
                                  "textDecoration",
                                  selectedElement.properties.textDecoration ===
                                    "underline"
                                    ? "none"
                                    : "underline"
                                )
                              }
                              className="h-8 px-2"
                              title="Underline"
                            >
                              <span className="text-sm underline">U</span>
                            </Button>
                          </div>

                          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                          {/* Text Alignment Controls */}
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.textAlign === "left"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty("textAlign", "left")
                              }
                              className="h-8 px-2"
                              title="Align Left"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.textAlign ===
                                "center"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty("textAlign", "center")
                              }
                              className="h-8 px-2"
                              title="Align Center"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-2 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectedElement.properties.textAlign === "right"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateElementProperty("textAlign", "right")
                              }
                              className="h-8 px-2"
                              title="Align Right"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1zm-6 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </Button>
                          </div>

                          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                          {/* Text Color Control */}
                          <div className="flex items-center space-x-1">
                            <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                              Color:
                            </label>
                            <input
                              type="color"
                              value={
                                selectedElement.properties.color || "#000000"
                              }
                              onChange={(e) =>
                                updateElementProperty("color", e.target.value)
                              }
                              className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                              title="Text Color"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>

          {/* Properties panel */}
          {currentView === "canvas" && !isRightPanelHidden && (
            <PropertiesPanel
              selectedElement={selectedElement}
              currentPage={currentPage || null}
              showCanvasProperties={showCanvasProperties}
              onUpdateElement={updateElementProperty}
              onUpdateElementTransform={updateElementTransform}
              onUpdateCanvasBackground={updateCanvasBackground}
              onDeleteElement={deleteElement}
              onDuplicateElement={duplicateElement}
              onToggleElementVisibility={toggleElementVisibility}
              onToggleElementLock={toggleElementLock}
              onMoveElementLayer={moveElementLayer}
            />
          )}
        </div>
      )}

      {/* Publish Modal */}
      {/* Inline dismissible prompt (shows only one at a time). Click to dismiss. */}
      {inlinePrompt && (
        <div
          onClick={() => setInlinePrompt(null)}
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            zIndex: 99999,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {inlinePrompt}
        </div>
      )}

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        appId={currentAppId || searchParams.get("appId") || "1"}
        currentAppName={appName}
      />
    </div>
  );
}

export default function CanvasPage() {
  return <CanvasPageContent />;
}
