"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Save, AlertTriangle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "./workflow-canvas";
import { BlockLibrary } from "./block-library";
import { FilterPanel } from "./filter-panel";
import { TemplateLibrary } from "./template-library";
import {
  useCanvasWorkflow,
  CanvasWorkflowProvider,
} from "@/lib/canvas-workflow-context";
import { toast } from "@/components/ui/use-toast";

export function WorkflowBuilderContent() {
  const searchParams = useSearchParams();
  const { selectedElementId, setPages, pages } = useCanvasWorkflow();
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const appId = searchParams.get("appId") || "3";
  const [rightPanelTab, setRightPanelTab] = useState("blocks");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // NEW
  
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

  useEffect(() => {
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
      ];
      setPages(mockPages);
    }
  }, [pages.length, setPages]);

  const handleSaveWorkflow = async () => {
    console.log("🔵 Save Workflow clicked");

    try {
      if (!selectedElementId) {
        toast({
          title: "No Element Selected",
          description: "Please select an element before saving.",
          variant: "destructive",
        });
        return;
      }

      if (saveHandlerRef.current) {
        await saveHandlerRef.current();
      } else {
        toast({
          title: "Save Handler Not Ready",
          description: "Please wait and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description:
          error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Workflow Area */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Status Bar - Compact & Responsive */}
        <div className="flex items-center justify-between gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3 bg-muted/30 border-b border-border">
          {/* Alerts section */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Alerts badge */}
            <div className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900 text-xs font-medium">
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Alerts:</span>
              <span>1</span>
            </div>

            {/* Warnings badge - hide on very small screens */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 rounded-md border border-yellow-200 dark:border-yellow-900 text-xs font-medium">
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Warnings:</span>
              <span>0</span>
            </div>
          </div>

          {/* NEW: Buttons group */}
          <div className="flex items-center gap-2">
            {/* Toggle button */}
            <Button
              size="sm"
              variant="outline"
              className="px-2 py-1"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </Button>

            {/* Save button - compact on mobile */}
            <Button
              size="sm"
              variant="default"
              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 sm:px-3 sm:py-1.5"
              onClick={handleSaveWorkflow}
            >
              <Save className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>

        {/* Element Info - Compact */}
        {selectedElementId && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 px-2 py-1.5 sm:px-4 sm:py-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-blue-500 rounded-full shrink-0"></div>
              <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                <span className="hidden sm:inline">Workflow for Element: </span>
                <code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-xs">
                  {selectedElementId}
                </code>
              </span>
            </div>
          </div>
        )}

        {/* Workflow Canvas - Responsive padding */}
        <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-auto">
          <WorkflowCanvas
            selectedElementId={selectedElementId}
            onSaveRequest={handleSaveWorkflow}
            saveHandlerRef={saveHandlerRef}
          />
        </div>
      </div>

      {/* Right Panel - Block Library - MODIFIED: Conditional width */}
      <div 
        className={`flex flex-col bg-card/30 transition-all duration-200 ${
          isSidebarOpen ? "w-96" : "w-0 overflow-hidden"
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
    </div>
  );
}

export function WorkflowBuilderSample() {
  return (
    // <CanvasWorkflowProvider>
      <WorkflowBuilderContent />
    // </CanvasWorkflowProvider>
  );
}
