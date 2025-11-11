"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Settings,
  Play,
  AlertTriangle,
  ArrowLeft,
  Save,
  ArrowRightIcon,
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
import { toast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

// Lazy canvas page for split view
const CanvasPage = dynamic(() => import("../../app/(app)/canvas/page"), {
  ssr: false,
});

// util
const cx = (...cls: (string | false | null | undefined)[]) =>
  cls.filter(Boolean).join(" ");

function RightPanel({
  isOpen,
  onToggle,
  mode, // "sidebar" | "horizontal" | "vertical"
  rightPanelTab,
  setRightPanelTab,
  filters,
  setFilters,
}: {
  isOpen: boolean;
  onToggle: () => void;
  mode: "sidebar" | "horizontal" | "vertical";
  rightPanelTab: "blocks" | "templates";
  setRightPanelTab: (t: "blocks" | "templates") => void;
  filters: any;
  setFilters: (f: any) => void;
}) {
  const isHorizontal = mode === "horizontal";
  const expandedSize = isHorizontal ? "h-80" : "w-96";
  const collapsedRail = isHorizontal ? "h-8" : "w-3";

  return (
    <div
      className={cx(
        "relative flex shrink-0 bg-card/30",
        isHorizontal ? "w-full" : "min-h-full",
        !isHorizontal && "border-l border-border"
      )}
      style={{ transition: "all 200ms ease" }}
    >
      {/* Collapsed rail (stays visible) */}
      {!isOpen && (
        <div
          className={cx(
            "flex items-center justify-center bg-muted/40 hover:bg-muted/60 transition-colors",
            collapsedRail,
            isHorizontal ? "w-full border-t border-border" : "h-full"
          )}
        >
          <button
            onClick={onToggle}
            className="group inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Expand panel"
            title="Expand"
          >
            <ArrowRightIcon
              className={cx(
                "h-4 w-4 transition-transform",
                !isHorizontal && "rotate-180 group-hover:translate-x-0.5"
              )}
            />
          </button>
        </div>
      )}

      {/* Panel with animated size */}
      <div
        className={cx(
          "overflow-hidden transition-all duration-200 ease",
          isOpen ? expandedSize : isHorizontal ? "h-0" : "w-0"
        )}
      >
        <div
          className={cx(
            "flex h-full w-full flex-col",
            isHorizontal ? "" : "min-w-[16rem]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex rounded-md bg-muted p-1">
              <button
                onClick={() => setRightPanelTab("blocks")}
                className={cx(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  rightPanelTab === "blocks"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Blocks
              </button>
              <button
                onClick={() => setRightPanelTab("templates")}
                className={cx(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  rightPanelTab === "templates"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Templates
              </button>
            </div>

            <button
              onClick={onToggle}
              className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label="Collapse panel"
              title="Collapse"
            >
              <ArrowRightIcon className="h-4 w-4 rotate-180" />
            </button>
          </div>

          {/* Filters */}
          {rightPanelTab === "blocks" && (
            <div className="border-b border-border p-3">
              <FilterPanel filters={filters} onFiltersChange={setFilters} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto">
              {rightPanelTab === "blocks" ? (
                <BlockLibrary filters={filters} />
              ) : (
                <TemplateLibrary />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedElementId, setPages, pages, setCurrentAppId } =
    useCanvasWorkflow();

  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const appId = searchParams.get("appId") || "3";

  const handleSaveWorkflow = async () => {
    try {
      if (!selectedElementId) {
        toast({
          title: "No Element Selected",
          description: "Please select an element before saving the workflow.",
          variant: "destructive",
        });
        return;
      }
      if (saveHandlerRef.current) {
        await saveHandlerRef.current();
        toast({ title: "Workflow saved", description: "All changes stored." });
      } else {
        toast({
          title: "Save Handler Not Ready",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
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

  useEffect(() => {
    if (appId) setCurrentAppId(appId);
    if (pages.length === 0) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const [activeTab, setActiveTab] = useState<"canvas" | "data">("canvas");
  const [rightPanelTab, setRightPanelTab] = useState<"blocks" | "templates">(
    "blocks"
  );
  const [splitScreenMode, setSplitScreenMode] =
    useState<"sidebar" | "horizontal" | "vertical">("sidebar");
  const [isCanvasWorkflowSplit, setIsCanvasWorkflowSplit] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  const toggleSplitScreen = () =>
    setIsCanvasWorkflowSplit((prev) => !prev);
  const handleSideBar = () => setIsSidebarOpen((v) => !v);

  const statusBar = (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Alerts: 1
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Warnings: 0
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const id = searchParams.get("appId");
            router.push(`/canvas${id ? `?appId=${id}` : ""}`);
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Always-visible sidebar toggle */}
        <Button variant="outline" size="sm" onClick={handleSideBar}>
          <ArrowRightIcon
            className={cx(
              "h-4 w-4 transition-transform",
              isSidebarOpen ? "rotate-180" : ""
            )}
          />
          <span className="ml-1 text-xs">
            {isSidebarOpen ? "Hide Panel" : "Show Panel"}
          </span>
        </Button>

        <ThemeToggle />

        <Button
          size="sm"
          onClick={() => {
            const id = searchParams.get("appId") || "2";
            window.open(`/run?appId=${id}`, "_blank");
          }}
        >
          <Play className="mr-2 h-4 w-4" />
          Run App
        </Button>

        <Button
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={handleSaveWorkflow}
        >
          <Save className="mr-1 h-3.5 w-3.5" />
          Save Workflow
        </Button>
      </div>
    </div>
  );

  const canvasSection = (
    <div className="flex flex-1 flex-col">
      {statusBar}
      {selectedElementId && (
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-blue-700">
              Workflow for Element:{" "}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">
                {selectedElementId}
              </code>
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 p-4">
        <WorkflowCanvas
          selectedElementId={selectedElementId}
          onSaveRequest={handleSaveWorkflow}
          saveHandlerRef={saveHandlerRef}
        />
      </div>
    </div>
  );

  const panel = (
    <RightPanel
      isOpen={isSidebarOpen}
      onToggle={handleSideBar}
      mode={splitScreenMode}
      rightPanelTab={rightPanelTab}
      setRightPanelTab={setRightPanelTab}
      filters={filters}
      setFilters={setFilters}
    />
  );

  const renderLayout = () => {
    switch (splitScreenMode) {
      case "sidebar":
        return (
          <div className="flex h-full">
            <div className="flex flex-1 flex-col border-r border-border">
              {canvasSection}
            </div>
            {panel}
          </div>
        );
      case "horizontal":
        return (
          <div className="flex h-full flex-col">
            <div className="flex-1 border-b border-border">{canvasSection}</div>
            {panel}
          </div>
        );
      case "vertical":
        return (
          <div className="flex h-full">
            <div className="flex w-2/3 flex-col border-r border-border">
              {canvasSection}
            </div>
            <div className="w-1/3">{panel}</div>
          </div>
        );
      default:
        return (
          <div className="flex h-full">
            <div className="flex flex-1 flex-col border-r border-border">
              {canvasSection}
            </div>
            {panel}
          </div>
        );
    }
  };

  const renderMainContent = () => {
    if (isCanvasWorkflowSplit && activeTab === "canvas") {
      return (
        <div className="flex h-full w-screen">
          <div className="w-1/2 border-r border-border">
            <div className="h-full w-full">
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
      <div className="flex flex-1 flex-col">
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
