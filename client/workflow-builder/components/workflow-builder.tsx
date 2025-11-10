"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Settings,
  Play,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkflowCanvas } from "./workflow-canvas";
import { BlockLibrary } from "./block-library";
import { FilterPanel } from "./filter-panel";
import { TemplateLibrary } from "./template-library";
import { DataScreen } from "./data-screen";
import {
  useCanvasWorkflow,
  CanvasWorkflowProvider,
} from "@/lib/canvas-workflow-context";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

// Dynamically import Canvas component to avoid circular dependencies
const CanvasPage = dynamic(() => import("../../app/canvas/page"), {
  ssr: false,
});

function WorkflowBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedElementId, setPages, pages, setCurrentAppId } =
    useCanvasWorkflow();

  // Ref to store the save handler from WorkflowCanvas
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  // Get appId from URL parameters and set it in context
  const appId = searchParams.get("appId") || "3"; // Default to app 3 for testing

  // Handler for Save button click - Enhanced for JSON Blueprint Serialization
  const handleSaveWorkflow = async () => {
    console.log("🔵 Save Workflow button clicked in workflow builder");
    console.log("🔍 Selected Element ID:", selectedElementId);
    console.log("🔍 App ID:", appId);

    try {
      // Validate element is selected
      if (!selectedElementId) {
        console.error("❌ No element selected");
        toast({
          title: "No Element Selected",
          description: "Please select an element before saving the workflow.",
          variant: "destructive",
        });
        return;
      }

      // Call the save handler from WorkflowCanvas via ref
      if (saveHandlerRef.current) {
        console.log(
          "✅ Calling workflow save handler for element:",
          selectedElementId
        );
        await saveHandlerRef.current();
      } else {
        console.error("❌ Workflow save handler not available");
        toast({
          title: "Save Handler Not Ready",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error saving workflow:", error);
      toast({
        title: "Save Failed",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while saving the workflow.",
        variant: "destructive",
      });
    }
  };

  // Debug: Track selectedElementId changes from canvas-workflow-context
  useEffect(() => {
    console.log(
      "🔍 WORKFLOW BUILDER: selectedElementId changed:",
      selectedElementId
    );
    console.log("🔍 WORKFLOW BUILDER: Current appId:", appId);

    // When element selection changes, the WorkflowCanvas will automatically load the workflow
    // via its own useEffect that watches selectedElementId
    if (selectedElementId) {
      console.log(
        "✅ WORKFLOW BUILDER: Element selected, WorkflowCanvas will load workflow for:",
        selectedElementId
      );
    } else {
      console.log("ℹ️ WORKFLOW BUILDER: No element selected");
    }
  }, [selectedElementId, appId]);

  // Set the current app ID in context so Canvas can use it
  useEffect(() => {
    if (appId) {
      setCurrentAppId(appId);
      console.log("🔄 WORKFLOW BUILDER: Set current app ID in context:", appId);

      // If no pages are available yet, provide mock data for testing
      if (pages.length === 0) {
        console.log(
          "⚠️ WORKFLOW BUILDER: No pages available, providing mock data for app",
          appId
        );
        const mockPages = [
          {
            id: "page-1",
            name: "Page 1",
            elements: [],
            groups: [],
            canvasWidth: 1200,
            canvasHeight: 800,
          },
          {
            id: "page-1759124711668",
            name: "login",
            elements: [],
            groups: [],
            canvasWidth: 1200,
            canvasHeight: 800,
          },
          {
            id: "page-3",
            name: "Page 3",
            elements: [],
            groups: [],
            canvasWidth: 1200,
            canvasHeight: 800,
          },
        ];
        setPages(mockPages);
        console.log(
          "✅ WORKFLOW BUILDER: Set mock pages for testing:",
          mockPages.map((p) => p.name)
        );
      }
    }
  }, [appId, setCurrentAppId, pages.length, setPages]);
  const [activeTab, setActiveTab] = useState("canvas");
  const [rightPanelTab, setRightPanelTab] = useState("blocks");
  const [splitScreenMode, setSplitScreenMode] = useState("sidebar"); // "sidebar", "horizontal", "vertical"
  const [isCanvasWorkflowSplit, setIsCanvasWorkflowSplit] = useState(false);
  const [filters, setFilters] = useState({
    searchQuery: "",
    detailedFilters: {
      trigger: false,
      action: false,
      condition: false,
      moreFilters: false,
    },
    categoryFilters: {
      versions: false,
      access: true,
      data: false,
      security: true,
    },
  });

  const toggleSplitScreen = () => {
    setIsCanvasWorkflowSplit(!isCanvasWorkflowSplit);
  };

  // Debug: Log pages from Canvas context
  useEffect(() => {
    console.log(
      "🔄 WORKFLOW BUILDER: Pages from Canvas context:",
      pages.length,
      "pages:",
      pages.map((p) => ({ id: p.id, name: p.name }))
    );
    if (pages.length > 0) {
      console.log(
        "✅ WORKFLOW BUILDER: Canvas pages are available for page.redirect dropdown!"
      );
    } else {
      console.log(
        "⚠️ WORKFLOW BUILDER: No Canvas pages available yet - waiting for Canvas sync..."
      );
    }
  }, [pages]);

  const getSplitScreenIcon = () => {
    return (
      <div className="w-4 h-4 mr-2 flex">
        <div className="w-2 h-4 border border-r-0 rounded-l"></div>
        <div className="w-2 h-4 border rounded-r"></div>
      </div>
    );
  };

  const renderLayout = () => {
    const statusBar = (
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 border-b border-border min-h-[60px] font-poppins">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Alerts: 1</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 rounded-md border border-yellow-200 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Warnings: 0</span>
          </div>
        </div>

        {/* Workflow Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleSaveWorkflow}
          >
            <Save className="w-3 h-3 mr-1" />
            Save Workflow
          </Button>
        </div>
      </div>
    );

    const canvasSection = (
      <div className="flex-1 flex flex-col">
        {statusBar}
        {/* Canvas-Workflow Integration Header */}
        {selectedElementId && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700">
                Workflow for Element:{" "}
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                  {selectedElementId}
                </code>
              </span>
            </div>
          </div>
        )}
        <div className="flex-1 p-6">
          <WorkflowCanvas
            selectedElementId={selectedElementId}
            onSaveRequest={handleSaveWorkflow}
            saveHandlerRef={saveHandlerRef}
          />
        </div>
      </div>
    );

    const rightPanel = (
      <div
        className={`${
          splitScreenMode === "sidebar" ? "w-96" : "flex-1"
        } flex flex-col bg-card/30 ${
          splitScreenMode !== "sidebar" ? "border-l border-border" : ""
        }`}
      >
        {rightPanelTab === "blocks" && (
          <div className="p-4 border-b border-border">
            <FilterPanel filters={filters} onFiltersChange={setFilters} />
          </div>
        )}

        <div className="border-b border-border">
          <div className="flex">
            <button
              onClick={() => setRightPanelTab("blocks")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                rightPanelTab === "blocks"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Block Library
            </button>
            <button
              onClick={() => setRightPanelTab("templates")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                rightPanelTab === "templates"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Templates
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {rightPanelTab === "blocks" ? (
            <BlockLibrary filters={filters} />
          ) : (
            <TemplateLibrary />
          )}
        </div>
      </div>
    );

    switch (splitScreenMode) {
      case "sidebar":
        return (
          <div className="flex h-full">
            <div className="flex-1 flex flex-col border-r border-border">
              {canvasSection}
            </div>
            {rightPanel}
          </div>
        );
      case "horizontal":
        return (
          <div className="flex flex-col h-full">
            <div className="flex-1 border-b border-border">{canvasSection}</div>
            <div className="h-80">{rightPanel}</div>
          </div>
        );
      case "vertical":
        return (
          <div className="flex h-full">
            <div className="w-2/3 flex flex-col border-r border-border">
              {canvasSection}
            </div>
            <div className="w-1/3">{rightPanel}</div>
          </div>
        );
      default:
        return (
          <div className="flex h-full">
            <div className="flex-1 flex flex-col border-r border-border">
              {canvasSection}
            </div>
            {rightPanel}
          </div>
        );
    }
  };

  const renderMainContent = () => {
    if (isCanvasWorkflowSplit && activeTab === "canvas") {
      return (
        <div className="flex h-full w-screen">
          <div className="w-1/2 border-r border-border">
            {/* Pass appId to Canvas component via URL context */}
            <div style={{ width: "100%", height: "100%" }}>
              <CanvasPage />
            </div>
          </div>
          <div className="w-1/2">{renderLayout()}</div>
        </div>
      );
    }

    switch (activeTab) {
      case "canvas":
        return renderLayout();
      case "data":
        return <DataScreen />;
      default:
        return renderLayout();
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Workflow Builder</h1>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant={activeTab === "canvas" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("canvas")}
              >
                Workflow
              </Button>
              <Button
                variant={activeTab === "data" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("data")}
              >
                Data
              </Button>
            </div>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const appId = searchParams.get("appId");
                router.push(`/canvas${appId ? `?appId=${appId}` : ""}`);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Canvas
            </Button>
            {activeTab === "canvas" && (
              <Button variant="outline" size="sm" onClick={toggleSplitScreen}>
                {getSplitScreenIcon()}
                Split Screen
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const appId = searchParams.get("appId") || "2";
                window.open(`/run?appId=${appId}`, "_blank"); // New tab
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Run App
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">{renderMainContent()}</div>
      </div>
    </div>
  );
}

export function WorkflowBuilder() {
  return (
    <CanvasWorkflowProvider>
      <WorkflowBuilderContent />
    </CanvasWorkflowProvider>
  );
}
