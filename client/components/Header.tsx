// components/workflow-builder/workflow-header.tsx
"use client";

import {
  ArrowLeft,
  Database,
  Eye,
  Play,
  Settings,
  Upload,
  Workflow,
} from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import { PublishModal } from "./publish-modal";

interface WorkflowHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCanvasWorkflowSplit: boolean;
  onSplitScreenToggle: () => void;
}

export function WorkflowHeader({
}: WorkflowHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [appName, setAppName] = useState("Untitled App");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [splitButtonName, setSplitButtonName] = useState("Split Screen");

  const currentAppId = searchParams.get("appId") || "1";
  const urlData = searchParams.get("split-view") || "canvas";

  const { saveCanvasWorkflow } = useCanvasWorkflow();

  const getSplitScreenIcon = () => {
    return (
      <div className="w-4 h-4 mr-2 flex">
        <div className="w-2 h-4 border border-r-0 rounded-l"></div>
        <div className="w-2 h-4 border rounded-r"></div>
      </div>
    );
  };

  useEffect(() => {
    if (pathname.includes("split-view")) {
      setCurrentPage("split-view");
    } else if (pathname.includes("canvas")) {
      setCurrentPage("canvas");
    } else {
      setCurrentPage(null);
    }
  }, [urlData, searchParams]);

  const handleClick = () => {
    if(splitButtonName === "Split Screen") {
      router.push(`/split-view?appId=${currentAppId}`);
      setSplitButtonName("Exit Split");
    }else{
        router.back();
        setSplitButtonName("Split Screen");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border bg-background">
        <div className="flex items-center space-x-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center space-x-2">
            <Image
              src="/floneo-profile-logo.png"
              alt="Floneo"
              width={24}
              height={24}
            />
            {isEditingName ? (
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                className="text-lg font-semibold bg-transparent border-none outline-none dark:text-gray-100"
                autoFocus
              />
            ) : (
              <h1
                className="text-lg font-semibold cursor-pointer dark:text-gray-100"
                onClick={() => setIsEditingName(true)}
              >
                {appName}
              </h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* <div className="flex items-center gap-1 mr-4">
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
        </div> */}

          <ThemeToggle />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const appId = currentAppId || searchParams.get("appId") || "1";

              // Save current state before publishing
              try {
                if (saveCanvasWorkflow) {
                  const success = await saveCanvasWorkflow(appId);
                  if (success) {
                    console.log(
                      "✅ PUBLISH: Canvas saved before opening publish modal"
                    );
                  } else {
                    console.warn(
                      "⚠️ PUBLISH: Canvas save returned false, but continuing..."
                    );
                  }
                } else {
                  console.warn(
                    "⚠️ PUBLISH: saveCanvasWorkflow is not available. Canvas may not be saved. Please ensure Canvas is loaded."
                  );
                }
              } catch (error) {
                console.error("❌ PUBLISH: Failed to save canvas:", error);
              }

              // Open publish modal
              setIsPublishModalOpen(true);
            }}
          >
            <Upload className="w-3 h-3 mr-1" />
            Publish
          </Button>
          <Button variant="outline" size="sm" onClick={handleClick}>
            {getSplitScreenIcon()}
            {splitButtonName}
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button
            size="sm"
            onClick={() => {
              const appId = searchParams.get("appId") || "2";
              window.open(`/run?appId=${appId}`, "_blank");
            }}
          >
            <Play className="w-4 h-4 mr-2" />
            Run App
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Workflow"
            className="px-2"
            onClick={() => {
              const appId = currentAppId || searchParams.get("appId") || "1";
              router.push(`/workflow?appId=${appId}`);
            }}
          >
            <Workflow className="w-3 h-3" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            title="Database"
            className="px-2"
            onClick={() => {
              const appId = currentAppId || searchParams.get("appId") || "1";
              router.push(`/database?appId=${appId}`);
            }}
          >
            <Database className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {/* Publish Modal */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        appId={currentAppId || searchParams.get("appId") || "1"}
        currentAppName={appName}
      />
    </>
  );
}
