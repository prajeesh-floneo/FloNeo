// components/workflow-builder/index.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "./workflow-canvas";
import { BlockLibrary } from "./block-library";
import { FilterPanel } from "./filter-panel";
import { TemplateLibrary } from "./template-library";
import { useCanvasWorkflow, CanvasWorkflowProvider } from "@/lib/canvas-workflow-context";
import { toast } from "@/components/ui/use-toast";
// import { WorkflowParent } from "./workflow-parent";

// This is your existing workflow layout - just the content, no header
export function WorkflowBuilderContent() {
  const searchParams = useSearchParams();
  const { selectedElementId, setPages, pages } = useCanvasWorkflow();
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const appId = searchParams.get("appId") || "3";
  const [rightPanelTab, setRightPanelTab] = useState("blocks");
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

  // Mock pages if needed
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
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full ">
      {/* Main Workflow Area */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Status Bar */}
        <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 border-b border-border">
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

        {/* Element Info */}
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

        {/* Workflow Canvas */}
        <div className="flex-1 p-6">
          <WorkflowCanvas
            selectedElementId={selectedElementId}
            onSaveRequest={handleSaveWorkflow}
            saveHandlerRef={saveHandlerRef}
          />
        </div>
      </div>

      {/* Right Panel - Block Library */}
      <div className="w-96 flex flex-col bg-card/30">
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

// Main export with Provider
export function WorkflowBuilderSample() {
  return (
    <CanvasWorkflowProvider>
      <WorkflowBuilderContent />
    </CanvasWorkflowProvider>
  );
}
