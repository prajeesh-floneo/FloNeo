// components/workflow-builder/workflow-parent.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
// import { WorkflowHeader } from "./workflow-header";
// import { WorkflowBuilderContent } from "./index";
// import { DataScreen } from "./data-screen";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import dynamic from "next/dynamic";
import { WorkflowHeader } from "@/components/Header";
import { DataScreen } from "@/workflow-builder/components/data-screen";
import { WorkflowBuilderSample } from "@/workflow-builder/components/workflow-builder-sample";
// import { WorkflowBuilder } from "@/workflow-builder/components/workflow-builder";

// Import Canvas dynamically
const CanvasPage = dynamic(() => import("../canvas/page"), {
  ssr: false,
});

export default function WorkflowParent() {
  const searchParams = useSearchParams();
  const { selectedElementId, setPages, setCurrentAppId } = useCanvasWorkflow();

  const [activeTab, setActiveTab] = useState("canvas");
  const [isCanvasWorkflowSplit, setIsCanvasWorkflowSplit] = useState(true);

  const appId = searchParams.get("appId") || "1";

  // Initialize app context
  useEffect(() => {
    if (appId) {
      setCurrentAppId(appId);
      console.log("🔄 Set current app ID:", appId);
    }
  }, [appId, setCurrentAppId]);

  const toggleSplitScreen = () => {
    setIsCanvasWorkflowSplit(!isCanvasWorkflowSplit);
  };

  const renderContent = () => {
    // Show Data Screen
    if (activeTab === "data") {
      return <DataScreen />;
    }

    // Split Screen Mode: Canvas + Workflow side by side
    if (isCanvasWorkflowSplit && activeTab === "canvas") {
      return (
        <div className="flex h-full">
          {/* Canvas - Left Half */}
          <div className="w-1/2 border-r border-border">
            <CanvasPage />
          </div>

          {/* Workflow - Right Half */}
          <div className="w-1/2">
            <WorkflowBuilderSample />
          </div>
        </div>
      );
    }

    // Normal Mode: Full Width Workflow
    // Always mount CanvasPage (hidden) to ensure saveCanvasWorkflow is available
    return (
      <>
        <div className="hidden">
          <CanvasPage />
        </div>
        <WorkflowBuilderSample />
      </>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  );
}
