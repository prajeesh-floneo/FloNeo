"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CanvasRenderer } from "@/components/canvas/CanvasRenderer";
import { CanvasElement } from "@/components/canvas/ElementManager";
// import { getPreviewSnapshot, PreviewSnapshot } from "@/lib/utils"; // Unused import
import { mapPageStyle, getPageStyleHash } from "@/runtime/pageStyle";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { AiSummaryPopup } from "@/workflow-builder/components/ai-summary-popup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import TestDisplayElement from "@/components/test-display-element";
import {
  isAuthenticated,
  validateAndRefreshAuth,
  handleApiError,
  authenticatedFetch,
} from "@/lib/auth";
import { deriveMediaRuntime, normalizeMediaUrl } from "@/lib/utils";

// Type mapping function to convert canvas element types to renderer types
function normalizeElementType(type: string): string {
  const typeMap: Record<string, string> = {
    textfield: "TEXT_FIELD",
    textarea: "TEXT_AREA",
    button: "BUTTON",
    checkbox: "CHECKBOX",
    radiobutton: "RADIO_BUTTON",
    dropdown: "DROPDOWN",
    toggle: "TOGGLE",
    phone: "PHONE_FIELD",
    password: "PASSWORD_FIELD",
    email: "EMAIL_FIELD",
    number: "NUMBER_FIELD",
    calendar: "DATE_FIELD",
    upload: "FILE_UPLOAD",
    addfile: "FILE_UPLOAD",
    rectangle: "SHAPE",
    text: "TEXT_FIELD",
  };

  return typeMap[type.toLowerCase()] || type.toUpperCase();
}

// Function to normalize element structure for CanvasRenderer
function normalizeElement(element: any): CanvasElement {
  const props = { ...(element.properties || {}) };

  const normalizedSrc = normalizeMediaUrl(
    props.src || props.url || props.path
  );
  if (normalizedSrc) {
    props.src = normalizedSrc;
  }

  const normalizedThumb = normalizeMediaUrl(props.thumbnail);
  if (normalizedThumb) {
    props.thumbnail = normalizedThumb;
  }

  return {
    id: element.id,
    type: normalizeElementType(element.type),
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation || 0,
    opacity: element.opacity || 100,
    zIndex: element.zIndex || 1,
    pageId: element.pageId,
    properties: props,
    runtime: deriveMediaRuntime(props),
  };
}

// Force no caching
export const dynamic = "force-dynamic";

interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
  groups?: FormGroup[];
  canvasBackground: any;
  canvasWidth?: number;
  canvasHeight?: number;
}

interface FormGroup {
  id?: string | number;
  submitButtonId?: string;
  properties?: {
    submitButtonId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type WorkflowEvent =
  | "click"
  | "change"
  | "submit"
  | "drop"
  | "hover"
  | "focus"
  | "pageLoad"
  | "login";

type WorkflowNodeData = {
  label?: string;
  category?: string;
  isTrigger?: boolean;
  selectedFormGroup?: string;
  triggerType?: WorkflowEvent;
  targetPageId?: string | number;
  [key: string]: unknown;
};

type WorkflowNode = {
  id: string | number;
  type?: string;
  data?: WorkflowNodeData;
  [key: string]: unknown;
};

type WorkflowEdge = {
  id?: string | number;
  source?: string;
  target?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

interface Workflow {
  id?: string | number;
  elementId?: string | number | null;
  pageId?: string | number | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Trigger key type for workflow indexing
type TriggerKey =
  | `${string}:${
      | "click"
      | "change"
      | "submit"
      | "drop"
      | "hover"
      | "focus"
      | "pageLoad"
      | "login"}`
  | `formGroup:${string}:submit`
  | `page:${string}:pageLoad`
  | `app:${string}:login`;

function RunAppContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string>("");
  const [workflows, setWorkflows] = useState<Map<string, Workflow>>(
    () => new Map<string, Workflow>()
  );
  const [loading, setLoading] = useState(true);
  const [pageStack, setPageStack] = useState<string[]>([]); // For goBack() navigation
  const [workflowContext, setWorkflowContext] = useState<Record<string, any>>(
    {}
  ); // Workflow execution context

  // Runtime modal state for ui.openModal actions
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false);
  const [runtimeModalPayload, setRuntimeModalPayload] = useState<any>(null);

  // AI Summary popup state
  const [summaryPopupOpen, setSummaryPopupOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    fileName?: string;
    metadata?: {
      originalLength?: number;
      summaryLength?: number;
      compressionRatio?: number;
    };
  } | null>(null);

  const appId = searchParams.get("appId") || "1";
  const pageId = searchParams.get("pageId") || "page-1";

  // Enhanced authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const isValid = await validateAndRefreshAuth();
      if (!isValid) {
        console.log("🔒 RUN: Authentication validation failed");
        return;
      }
    };

    checkAuth();
  }, [router]);

  // Load app data and workflows
  useEffect(() => {
    const loadAppData = async () => {
      const token = localStorage.getItem("authToken") || "";
      console.log("🎥 RUN: ===== STARTING LOAD =====");
      console.log("🎥 RUN: Starting load for appId", appId, "pageId", pageId);
      console.log("🎥 RUN: Token exists:", !!token);

      try {
        // Fetch canvas for pages with enhanced authentication
        console.log("🔄 RUN: Fetching /api/canvas/" + appId + "?preview=true");
        const canvasResponse = await authenticatedFetch(
          `/api/canvas/${appId}?preview=true`,
          {
            cache: "no-store",
          }
        );
        console.log("🔄 RUN: Canvas status", canvasResponse.status);

        if (!canvasResponse.ok) {
          try {
            await handleApiError(canvasResponse);
          } catch (error) {
            console.error("� RUN: Canvas fetch error:", error);
            throw error;
          }
        }

        const canvasData = await canvasResponse.json();
        console.log("📄 RUN: Canvas data keys", Object.keys(canvasData));
        console.log("📄 RUN: Canvas data success:", canvasData.success);
        console.log(
          "📄 RUN: Canvas data has canvasState:",
          !!canvasData.data?.canvasState
        );
        console.log("📄 RUN: canvasState value:", canvasData.data?.canvasState);
        console.log(
          "📄 RUN: canvasState type:",
          typeof canvasData.data?.canvasState
        );
        console.log(
          "📄 RUN: canvasState length:",
          canvasData.data?.canvasState?.length
        );
        console.log(
          "📄 RUN: canvasState first 100 chars:",
          canvasData.data?.canvasState?.substring(0, 100)
        );
        console.log(
          "📄 RUN: Full canvas response:",
          JSON.stringify(canvasData, null, 2)
        );

        // Try to parse canvasState regardless of the condition check
        const rawCanvasState = canvasData.data?.canvasState;
        if (rawCanvasState) {
          console.log("📄 RUN: Raw canvasState type", typeof rawCanvasState);
          console.log("📄 RUN: Raw canvasState (full string)", rawCanvasState);

          let canvasState;
          try {
            // Handle both string and object cases
            canvasState =
              typeof rawCanvasState === "string"
                ? JSON.parse(rawCanvasState)
                : rawCanvasState;

            console.log("📄 RUN: Parsed canvasState type", typeof canvasState);
            console.log(
              "📄 RUN: Parsed canvasState keys",
              Object.keys(canvasState)
            );
            console.log(
              "📄 RUN: Parsed pages",
              canvasState.pages ? canvasState.pages.length : 0
            );
            console.log(
              "📄 RUN: First page",
              canvasState.pages ? canvasState.pages[0] : "No pages"
            );

            const rawPages = canvasState.pages || [];

            // Normalize all elements in all pages
            const pages = rawPages.map((page: any) => ({
              ...page,
              elements: (page.elements || []).map(normalizeElement),
            }));

            console.log(
              "📄 RUN: About to set pages with",
              pages.length,
              "items"
            );
            console.log(
              "📄 RUN: First page elements:",
              pages[0]?.elements?.slice(0, 3)
            );
            console.log(
              "📄 RUN: All page IDs:",
              pages.map((p: any) => p.id)
            );
            console.log("� RUN: Looking for pageId:", pageId);

            // Required logging for data flow verification
            console.log("[RUN] appId, pageId:", appId, pageId);
            console.log(
              "[RUN] pages:",
              pages?.length,
              pages?.map((p: any) => ({ id: p.id, el: p.elements?.length }))
            );

            // Log page style for verification
            if (pages.length > 0) {
              const firstPage = pages[0];
              console.log("[RUN] page.id:", firstPage.id);
              console.log(
                "[RUN] page.canvasWidth/Height:",
                firstPage.canvasWidth,
                firstPage.canvasHeight
              );
              console.log(
                "[RUN] page.canvasBackground:",
                JSON.stringify(firstPage.canvasBackground)
              );
              console.log(
                "[RUN] page.style:",
                JSON.stringify((firstPage as any).style)
              );
            }

            setPages(pages);
            console.log("📄 RUN: Set pages with", pages.length, "items");

            if (pages.length > 0) {
              // Try to find the page, but default to first page if not found
              const foundPage = pages.find(
                (p: any) =>
                  p.id === pageId ||
                  p.id === `page-${pageId}` ||
                  p.id.includes(pageId)
              );
              const targetPageId = foundPage ? foundPage.id : pages[0].id;
              console.log(
                "📄 RUN: Target page ID:",
                targetPageId,
                "from pageId:",
                pageId
              );
              setCurrentPageId(targetPageId);

              // Instrumentation for runtime
              const currentPage =
                pages.find((p: any) => p.id === targetPageId) || pages[0];
              console.log(
                "📄 RUN: Pages details:",
                pages.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  elements: p.elements?.length || 0,
                  firstElement: p.elements?.[0]
                    ? {
                        id: p.elements[0].id,
                        type: p.elements[0].type,
                        name: p.elements[0].name,
                      }
                    : null,
                }))
              );
            } else {
              console.warn(
                "⚠️ RUN: No pages in parsed canvasState, using fallback"
              );
              throw new Error("No pages in canvasState");
            }
          } catch (parseError) {
            console.error("❌ RUN: Parse error", parseError);
            console.log(
              "📄 RUN: Raw that failed",
              rawCanvasState.substring(0, 500)
            );

            // No fallback - show empty state
            setPages([]);
            setCurrentPageId("");
            console.log("📄 RUN: Parse error - no fallback pages");
          }
        } else {
          console.warn("⚠️ RUN: No canvasState");

          // No fallback - show empty state
          setPages([]);
          setCurrentPageId("");
          console.log("📄 RUN: No canvasState - no fallback pages");
        }

        // Fetch workflows - FIXED: Use correct endpoint /api/canvas/workflows/:appId
        console.log("🔄 RUN: ===== FETCHING WORKFLOWS =====");
        console.log("🔄 RUN: Fetching /api/canvas/workflows/" + appId);
        const workflowResponse = await fetch(
          `/api/canvas/workflows/${appId}?preview=true`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        console.log("🔄 RUN: Workflow status", workflowResponse.status);
        console.log("🔄 RUN: Workflow ok:", workflowResponse.ok);

        if (!workflowResponse.ok) {
          console.warn(
            `⚠️ RUN: Workflow fetch failed with status ${workflowResponse.status}, continuing without workflows`
          );
          // Don't throw - workflows are optional
        } else {
          const workflowData = await workflowResponse.json();
          console.log("🔄 RUN: Workflow data keys", Object.keys(workflowData));
          console.log("🔄 RUN: Workflow success:", workflowData.success);
          console.log(
            "🔄 RUN: Workflow data count:",
            workflowData.data?.length || 0
          );

          if (workflowData.success && workflowData.data) {
            console.log(
              "🔄 RUN: ===== PROCESSING WORKFLOWS =====",
              "success:",
              workflowData.success,
              "has data:",
              !!workflowData.data
            );
            console.log(
              "🔄 RUN: Workflow data type:",
              Array.isArray(workflowData.data) ? "array" : "object"
            );
            console.log(
              "🔄 RUN: Workflow data (first 500 chars):",
              JSON.stringify(workflowData.data).substring(0, 500)
            );

            const workflowsMap = new Map<string, Workflow>();
            let processedCount = 0;
            let skippedCount = 0;

            // Handle both array and single object responses
            const workflowsArray = Array.isArray(workflowData.data)
              ? workflowData.data
              : workflowData.data
              ? [workflowData.data]
              : [];

            console.log(
              "🔄 RUN: Workflows array length:",
              workflowsArray.length
            );

            workflowsArray.forEach((workflow: any) => {
              // Skip null or undefined workflows
              if (!workflow) {
                console.warn("⚠️ RUN: Skipping null/undefined workflow");
                skippedCount++;
                return;
              }

              // FIXED: Process ALL workflows, not just those with elementId
              // Workflows can be indexed by trigger type or other means

              // FIXED: Parse nodes and edges if they're strings - with better error handling
              let nodes = workflow.nodes;
              let edges = workflow.edges;

              if (typeof nodes === "string") {
                try {
                  nodes = JSON.parse(nodes);
                  console.log(
                    `🔄 RUN: Successfully parsed nodes from string for workflow ${workflow.id}`
                  );
                } catch (e) {
                  console.error(
                    `❌ CRITICAL: Failed to parse nodes for workflow ${workflow.id}:`,
                    e
                  );
                  console.error(
                    "Raw nodes value (first 200 chars):",
                    String(nodes).substring(0, 200)
                  );
                  console.warn(
                    `[WF-LOAD] Skipping workflow ${workflow.id} due to nodes parse error`
                  );
                  skippedCount++;
                  return; // Skip this workflow entirely
                }
              }

              if (typeof edges === "string") {
                try {
                  edges = JSON.parse(edges);
                  console.log(
                    `🔄 RUN: Successfully parsed edges from string for workflow ${workflow.id}`
                  );
                } catch (e) {
                  console.error(
                    `❌ CRITICAL: Failed to parse edges for workflow ${workflow.id}:`,
                    e
                  );
                  console.error(
                    "Raw edges value (first 200 chars):",
                    String(edges).substring(0, 200)
                  );
                  console.warn(
                    `[WF-LOAD] Skipping workflow ${workflow.id} due to edges parse error`
                  );
                  skippedCount++;
                  return; // Skip this workflow entirely
                }
              }

              // Validate that nodes and edges are arrays
              if (!Array.isArray(nodes)) {
                console.warn(
                  `⚠️ RUN: Nodes is not an array for workflow ${workflow.id}, converting to array`
                );
                nodes = nodes ? [nodes] : [];
              }

              if (!Array.isArray(edges)) {
                console.warn(
                  `⚠️ RUN: Edges is not an array for workflow ${workflow.id}, converting to array`
                );
                edges = edges ? [edges] : [];
              }

              // Use elementId if available, otherwise use workflow ID as key
              const workflowKey =
                workflow.elementId || `workflow-${workflow.id}`;

              console.log(
                `🔄 RUN: Processing workflow - key: ${workflowKey}, nodes: ${
                  nodes?.length || 0
                }, edges: ${edges?.length || 0}`
              );

              workflowsMap.set(workflowKey, {
                nodes: nodes || [],
                edges: edges || [],
                id: workflow.id,
                elementId: workflow.elementId,
                pageId: workflow.pageId,
              });

              if (workflow.elementId) {
                console.log(
                  `✅ [WF-LOAD] Loaded workflow for element ${
                    workflow.elementId
                  }: ${nodes?.length || 0} nodes, ${edges?.length || 0} edges`
                );
                processedCount++;
              } else {
                console.log(
                  `✅ [WF-LOAD] Loaded workflow ${
                    workflow.id
                  } (no elementId): ${nodes?.length || 0} nodes, ${
                    edges?.length || 0
                  } edges`
                );
                processedCount++;
              }
            });

            console.log("🔄 RUN: ===== SETTING WORKFLOWS STATE =====");
            console.log(
              `🔄 RUN: About to set workflows - Total: ${workflowsMap.size}, Processed: ${processedCount}, Skipped: ${skippedCount}`
            );
            console.log(
              "🔄 RUN: Workflows map keys before setState:",
              Array.from(workflowsMap.keys())
            );
            setWorkflows(workflowsMap);
            console.log(
              `🔄 RUN: Workflows loaded - Total: ${workflowsMap.size}, Processed: ${processedCount}, Skipped: ${skippedCount}`
            );
            console.log(
              "🔄 RUN: Workflow map keys:",
              Array.from(workflowsMap.keys())
            );
          } else {
            console.warn("⚠️ RUN: No workflow data found");
          }
        }

        setLoading(false);
        console.log("🔍 RUN: Load completed successfully");

        // Verify state after setting
        setTimeout(() => {
          console.log(
            "🔍 RUN: State verification after 100ms - pages.length:",
            pages.length
          );
        }, 100);
      } catch (error) {
        console.error("❌ RUN: Load error", error);
        console.log("🔄 RUN: Using hard fallback data");

        // No fallback - show empty state
        setPages([]);
        setCurrentPageId("");
  setWorkflows(new Map<string, Workflow>());
        console.log("🔄 RUN: Error - no fallback data");

        setLoading(false);
      }
    };

    loadAppData();
  }, [appId, pageId, router]);

  // Build workflow index by elementId:eventType
  const workflowIndex = useMemo(() => {
    const idx = new Map<TriggerKey, Workflow[]>();

    console.log(
      "[WF-INDEX] Building index from workflows map with",
      workflows.size,
      "workflows"
    );
    console.log("[WF-INDEX] Workflows map keys:", Array.from(workflows.keys()));

    if (workflows.size === 0) {
      console.warn("[WF-INDEX] ⚠️ CRITICAL: Workflows map is EMPTY!");
      return idx;
    }

  workflows.forEach((workflow: Workflow, elementId: string) => {
      console.log(
        `[WF-INDEX] Processing workflow for elementId: ${elementId}, nodes: ${
          workflow.nodes?.length || 0
        }`
      );

      // Log all nodes to see what we're working with
      if (workflow.nodes && workflow.nodes.length > 0) {
        console.log(
          `[WF-INDEX] Workflow nodes:`,
          workflow.nodes.map((n: any) => ({
            id: n.id,
            label: n.data?.label,
            category: n.data?.category,
            type: n.type,
            allDataKeys: Object.keys(n.data || {}),
          }))
        );
      } else {
        console.warn(`[WF-INDEX] Workflow has no nodes!`);
      }

      // Find trigger node to determine event type - IMPROVED DETECTION
      // More flexible trigger node detection to handle various node structures
      const triggerNode = workflow.nodes.find((n: any) => {
        // Check multiple ways a node could be a trigger
        const isTriggerByCategory = n.data && n.data.category === "Triggers";
        const isTriggerByFlag =
          n.type === "workflowNode" && n.data?.isTrigger === true;
        const isTriggerByLabel =
          n.data?.label &&
          [
            "onClick",
            "onChange",
            "onSubmit",
            "onDrop",
            "onHover",
            "onFocus",
            "onPageLoad",
            "onLogin",
          ].includes(n.data.label);

        // CRITICAL FIX: Also check if label starts with "on" (common trigger pattern)
        const isTriggerByPattern =
          n.data?.label &&
          typeof n.data.label === "string" &&
          n.data.label.startsWith("on");

        const result =
          isTriggerByCategory ||
          isTriggerByFlag ||
          isTriggerByLabel ||
          isTriggerByPattern;

        if (result) {
          console.log(`[WF-INDEX] ✅ Trigger node found:`, {
            id: n.id,
            label: n.data?.label,
            category: n.data?.category,
            byCategory: isTriggerByCategory,
            byFlag: isTriggerByFlag,
            byLabel: isTriggerByLabel,
            byPattern: isTriggerByPattern,
          });
        }

        return result;
      });

      console.log(
        `[WF-INDEX] Looking for trigger node in ${workflow.nodes.length} nodes`
      );
      console.log(
        "[WF-INDEX] Node categories:",
        workflow.nodes.map((n: any) => n.data?.category)
      );

      if (triggerNode && triggerNode.data) {
        const triggerType = triggerNode.data.label; // e.g., "onClick", "onChange", "onPageLoad"

        console.log("[WF-INDEX] 🔍 Trigger node data details:", {
          label: triggerNode.data.label,
          selectedFormGroup: triggerNode.data.selectedFormGroup,
          triggerType: triggerNode.data.triggerType,
          allKeys: Object.keys(triggerNode.data),
        });

        // CRITICAL: For onSubmit, ALWAYS use form group indexing if available
        if (triggerType === "onSubmit") {
          console.log(
            "[WF-INDEX] 🎯 Processing onSubmit trigger for elementId:",
            elementId
          );

          if (triggerNode.data.selectedFormGroup) {
            // PRIMARY: Index by form group (this is the main way onSubmit should be triggered)
            const formGroupKey =
              `formGroup:${triggerNode.data.selectedFormGroup}:submit` as TriggerKey;
            const formGroupExisting = idx.get(formGroupKey) ?? [];
            idx.set(formGroupKey, [...formGroupExisting, workflow]);

            console.log(
              "[WF-INDEX] ✅ OnSubmit indexed by form group:",
              formGroupKey,
              "selectedFormGroup:",
              triggerNode.data.selectedFormGroup
            );
          } else {
            console.warn(
              "[WF-INDEX] ⚠️ OnSubmit trigger found but NO form group selected:",
              elementId,
              "trigger node data:",
              triggerNode.data
            );
          }
        } else {
          // For non-onSubmit triggers, use regular element:event indexing
          let eventType:
            | "click"
            | "change"
            | "submit"
            | "drop"
            | "hover"
            | "focus"
            | "pageLoad"
            | "login" = "click";

          if (triggerType === "onClick") {
            // Check if onClick has a specific trigger type configured
            eventType = triggerNode.data.triggerType || "click";
          } else if (triggerType === "onChange") {
            eventType = "change";
          } else if (triggerType === "onDrop") {
            eventType = "drop";
          } else if (triggerType === "onPageLoad") {
            eventType = "pageLoad";
          } else if (triggerType === "onLogin") {
            eventType = "login";
          }

          // Index by element:event for regular triggers
          const key = `${elementId}:${eventType}` as TriggerKey;
          const existing = idx.get(key) ?? [];
          idx.set(key, [...existing, workflow]);

          console.log(
            "[WF-INDEX] ✅ Indexed:",
            key,
            "nodes:",
            workflow.nodes.length,
            "trigger type:",
            triggerType
          );
        }

        // Special handling for onPageLoad - index by page ID
        if (triggerType === "onPageLoad") {
          const targetPageId = triggerNode.data.targetPageId || elementId;
          const pageLoadKey = `page:${targetPageId}:pageLoad` as TriggerKey;
          const pageLoadExisting = idx.get(pageLoadKey) ?? [];
          idx.set(pageLoadKey, [...pageLoadExisting, workflow]);

          console.log(
            "[WF-INDEX] OnPageLoad indexed by page:",
            pageLoadKey,
            "for onPageLoad trigger"
          );
        }

        // Special handling for onLogin - index globally
        if (triggerType === "onLogin") {
          const loginKey = `app:${elementId}:login` as TriggerKey;
          const loginExisting = idx.get(loginKey) ?? [];
          idx.set(loginKey, [...loginExisting, workflow]);

          console.log(
            "[WF-INDEX] OnLogin indexed globally:",
            loginKey,
            "for onLogin trigger"
          );
        }
      } else {
        // FALLBACK: If no explicit trigger found, use first node as trigger
        if (workflow.nodes.length > 0) {
          console.warn(
            `[WF-INDEX] ⚠️ No explicit trigger found for ${elementId}, using fallback indexing`
          );

          // CRITICAL FIX: Check if any node has onSubmit in its label
          const hasOnSubmit = workflow.nodes.some(
            (n: any) =>
              n.data?.label === "onSubmit" ||
              (typeof n.data?.label === "string" &&
                n.data.label.includes("Submit"))
          );

          // CRITICAL FIX: Check if any node has selectedFormGroup (indicates onSubmit)
          const hasFormGroup = workflow.nodes.some(
            (n: any) => n.data?.selectedFormGroup
          );

          let key: TriggerKey;

          if (hasOnSubmit || hasFormGroup) {
            // If it looks like an onSubmit workflow, try to find the form group
            const formGroupNode = workflow.nodes.find(
              (n: any) => n.data?.selectedFormGroup
            );

            if (formGroupNode?.data?.selectedFormGroup) {
              key =
                `formGroup:${formGroupNode.data.selectedFormGroup}:submit` as TriggerKey;
              console.log(
                "[WF-INDEX] ✅ Fallback indexed as onSubmit:",
                key,
                "nodes:",
                workflow.nodes.length
              );
            } else {
              // Fallback to click if we can't find form group
              key = `${elementId}:click` as TriggerKey;
              console.log(
                "[WF-INDEX] ✅ Fallback indexed (onSubmit pattern but no form group):",
                key,
                "nodes:",
                workflow.nodes.length
              );
            }
          } else {
            // Default fallback to click
            key = `${elementId}:click` as TriggerKey;
            console.log(
              "[WF-INDEX] ✅ Fallback indexed (default click):",
              key,
              "nodes:",
              workflow.nodes.length
            );
          }

          const existing = idx.get(key) ?? [];
          idx.set(key, [...existing, workflow]);
        } else {
          console.warn(
            `[WF-INDEX] ❌ No trigger node found and no nodes in workflow ${elementId}`
          );
        }
      }
    });

    // FALLBACK: If index is completely empty but workflows exist, index by elementId
    if (idx.size === 0 && workflows.size > 0) {
      console.warn(
        "[WF-INDEX] ⚠️ CRITICAL: Index is empty but workflows exist! Using emergency fallback indexing"
      );
  workflows.forEach((workflow: Workflow, elementId: string) => {
        // Index all workflows by their elementId with default "click" event
        const key = `${elementId}:click` as TriggerKey;
        idx.set(key, [workflow]);
        console.log(
          `[WF-INDEX] 🆘 Emergency fallback indexed: ${key} with ${
            workflow.nodes?.length || 0
          } nodes`
        );
      });
    }

    console.log("[WF-INDEX] ✅ Final index keys:", Array.from(idx.keys()));
    console.log(
      "[WF-INDEX] ✅ Final index size:",
      idx.size,
      "workflows size:",
      workflows.size
    );
    return idx;
  }, [workflows]);

  // Navigation functions
  const navigateTo = useCallback(
    (targetPageId: string) => {
      console.log("[NAV] to", targetPageId, "from", currentPageId);

      // Check if target page exists
      const targetPage = pages.find(
        (p: Page) => p.id === targetPageId || String(p.id) === targetPageId
      );
      if (!targetPage) {
        console.error(
          "[NAV] Target page not found:",
          targetPageId,
          "Available pages:",
          pages.map((p: Page) => p.id)
        );
        toast({
          title: "Navigation Error",
          description: `Page ${targetPageId} not found`,
          variant: "destructive",
        });
        return;
      }

  setPageStack((s: string[]) => [...s, currentPageId]);
      setCurrentPageId(targetPageId);

      // Update URL without reload
      const url = new URL(window.location.href);
      url.searchParams.set("pageId", targetPageId);
      window.history.pushState({}, "", url.toString());

      // Show success toast
      toast({
        title: "Page Navigation",
        description: `Navigated to ${targetPage.name || targetPageId}`,
      });

      console.log(
        "[NAV] Successfully navigated to:",
        targetPageId,
        "Page name:",
        targetPage.name
      );
    },
    [currentPageId, pages, toast]
  );

  // Temporary test handler to fetch a mock quote and open runtime modal
  const handleTestQuote = useCallback(async () => {
    try {
      toast({ title: "Fetching quote...", description: "Contacting mock API", duration: 2000 });

  // Use backend host (default localhost:5000 in dev).
  // Avoid referencing `process` here to prevent TypeScript "Cannot find name 'process'" in some environments.
  const base = "http://localhost:5000";
  // Add ignoreTls flag for dev environments where the external mock endpoint
  // may present an untrusted/self-signed certificate. The proxy will honor
  // ?ignoreTls=true and skip certificate validation (dev only).
  const mockUrl = `${base}/api/proxy/mock-quote?ignoreTls=true`;

      const response = await fetch(mockUrl, { cache: "no-store" });

      // Handle non-JSON responses (HTML 404 from wrong host) gracefully
      const contentType = response.headers.get("content-type") || "";
      let json: any = null;

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Proxy request failed: ${response.status} ${response.statusText} - ${txt.substring(0, 200)}`);
      }

      if (contentType.includes("application/json") || contentType.includes("application/hal+json")) {
        json = await response.json();
      } else {
        const txt = await response.text();
        try {
          json = JSON.parse(txt);
        } catch (e) {
          // Fallback: return the raw text when it's not valid JSON
          json = { text: txt };
        }
      }

      console.log("🌐 [TEST-QUOTE] Mock API response:", json);

      // Prepare modal payload and open modal
      setRuntimeModalPayload({
        modalId: "test-quote-modal",
        title: "Mock Quote",
        content: "This is a mock quote response from the test endpoint.",
        data: json,
      });
      setRuntimeModalOpen(true);

      // Show success toast
      toast({ title: "Quote fetched successfully.", description: "Mock quote loaded", variant: "default" });
    } catch (error) {
      console.error("❌ [TEST-QUOTE] Error fetching mock quote:", error);
      toast({ title: "Quote fetch failed", description: String(error), variant: "destructive" });
    }
  }, [toast]);

  const goBack = useCallback(() => {
    setPageStack((s: string[]) => {
      const prev = s[s.length - 1];
      if (prev) {
        console.log("[NAV] back to", prev, "stack=", s);

        // Check if previous page exists
        const prevPage = pages.find(
          (p: Page) => p.id === prev || String(p.id) === prev
        );
        if (!prevPage) {
          console.error("[NAV] Previous page not found:", prev);
          toast({
            title: "Navigation Error",
            description: `Previous page ${prev} not found`,
            variant: "destructive",
          });
          return s;
        }

        setCurrentPageId(prev);

        // Update URL without reload
        const url = new URL(window.location.href);
        url.searchParams.set("pageId", prev);
        window.history.pushState({}, "", url.toString());

        // Show success toast
        toast({
          title: "Page Navigation",
          description: `Went back to ${prevPage.name || prev}`,
        });
      } else {
        console.log("[NAV] back - no previous page in stack");
      }
      return s.slice(0, -1);
    });
  }, [pages, toast]);

  // Helper to find next node index using connectors
  const nextIndex = useCallback(
    (
      workflow: Workflow,
      currentIdx: number,
      connector: "next" | "onError" | "yes" | "no"
    ): number => {
      const currentNode = workflow.nodes[currentIdx];
      if (!currentNode) return workflow.nodes.length; // End

      const edge = workflow.edges.find(
        (e: any) =>
          e.source === currentNode.id &&
          (e.label === connector || e.sourceHandle === connector)
      );

      if (edge) {
        const nextNodeIdx = workflow.nodes.findIndex(
          (n: any) => n.id === edge.target
        );
        return nextNodeIdx >= 0 ? nextNodeIdx : workflow.nodes.length;
      }

      return workflow.nodes.length; // End if no connector found
    },
    []
  );

  // Execute workflow with connector following
  const runWorkflow = useCallback(
    async (workflow: Workflow, initialContext?: any) => {
      console.log("[WF-RUN] Starting workflow execution:", {
        nodesCount: workflow.nodes.length,
        nodeLabels: workflow.nodes.map((n: WorkflowNode) => {
          const label = n.data?.label;
          return typeof label === "string" ? label : null;
        }),
      });

      try {
        // Handle file uploads if present
        let contextWithFiles = { ...initialContext };

        console.log("[WF-RUN] Initial context:", {
          hasUploadedFiles: !!initialContext?.uploadedFiles,
          uploadedFilesCount: Object.keys(initialContext?.uploadedFiles || {})
            .length,
          uploadedFilesKeys: Object.keys(initialContext?.uploadedFiles || {}),
        });

        if (
          initialContext?.uploadedFiles &&
          Object.keys(initialContext.uploadedFiles).length > 0
        ) {
          console.log(
            "[WF-RUN] 📤 Uploading files before workflow execution..."
          );

          const resolvedUploads: Record<string, any> = {};

          for (const [elementId, file] of Object.entries(
            initialContext.uploadedFiles
          )) {
            try {
              console.log(
                `[WF-RUN] 📁 Uploading file for element ${elementId}:`,
                {
                  fileName: file instanceof File ? file.name : "NOT A FILE",
                  fileSize: file instanceof File ? file.size : "N/A",
                  fileType: file instanceof File ? file.type : "N/A",
                  isFile: file instanceof File,
                }
              );

              const formData = new FormData();
              formData.append("files", file as File);
              if (appId) {
                formData.append("appId", appId.toString());
              }

              const uploadResponse = await authenticatedFetch(
                "/api/media/upload",
                {
                  method: "POST",
                  body: formData,
                }
              );

              const uploadResult = await uploadResponse.json();

              console.log(
                `[WF-RUN] Upload response for ${elementId}:`,
                uploadResult
              );

              if (
                uploadResult.success &&
                uploadResult.files &&
                uploadResult.files.length > 0
              ) {
                const uploadedFile = {
                  ...uploadResult.files[0],
                  elementId,
                };
                console.log(
                  `[WF-RUN] ✅ File uploaded successfully for ${elementId}:`,
                  {
                    path: uploadedFile.path,
                    size: uploadedFile.size,
                    mimeType: uploadedFile.mimeType,
                    filename: uploadedFile.filename,
                  }
                );

                // Store the uploaded file data in context with the element ID as key
                contextWithFiles[elementId] = uploadedFile;
                resolvedUploads[elementId] = uploadedFile;
                console.log(
                  `[WF-RUN] ✅ Stored file data in context[${elementId}]`
                );
              } else {
                console.error(
                  `[WF-RUN] ❌ File upload failed for ${elementId}:`,
                  uploadResult
                );
              }
            } catch (uploadError) {
              console.error(
                `[WF-RUN] ❌ Error uploading file for ${elementId}:`,
                uploadError
              );
            }
          }

          if (Object.keys(resolvedUploads).length > 0) {
            contextWithFiles.uploadedFiles = resolvedUploads;

            const uploadList = Object.values(resolvedUploads);
            contextWithFiles.lastUploadedFile = uploadList[uploadList.length - 1];
          }
        }

        console.log("[WF-RUN] Context before workflow execution:", {
          keys: Object.keys(contextWithFiles),
          hasFileData: Object.keys(contextWithFiles).some(
            (key) =>
              contextWithFiles[key] &&
              typeof contextWithFiles[key] === "object" &&
              (contextWithFiles[key].path || contextWithFiles[key].filename)
          ),
        });

        // Send entire workflow to backend for sequential execution with context passing
        const response = await authenticatedFetch("/api/workflow/execute", {
          method: "POST",
          body: JSON.stringify({
            appId: appId,
            nodes: workflow.nodes, // Send ALL nodes for sequential execution
            edges: workflow.edges || [], // Send edges for branching logic
            context: contextWithFiles, // Pass context with uploaded file data
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("[WF-RUN] Backend execution failed:", result);
          throw new Error(result.message || "Backend execution failed");
        }

        console.log("[WF-RUN] Backend execution completed:", {
          resultsCount: result.results?.length,
          success: result.success,
          hasResults: !!result.results,
          isArray: Array.isArray(result.results),
        });

        // Update workflow context with results
        console.log(
          "[WF-RUN] BEFORE context update check - result.results:",
          result.results
        );

        if (result.results && Array.isArray(result.results)) {
          console.log(
            "[WF-RUN] INSIDE context update block - processing results"
          );
          const newContext: Record<string, any> = { ...workflowContext };

          for (const resultItem of result.results) {
            console.log("[WF-RUN] Processing resultItem:", resultItem);

            if (!resultItem.result) {
              console.log("[WF-RUN] Skipping - no result property");
              continue;
            }

            const blockResult = resultItem.result;
            const nodeLabel = resultItem.nodeLabel || "unknown";

            console.log(`[WF-RUN] Processing result for ${nodeLabel}:`, {
              success: blockResult.success,
              type: blockResult.type,
            });

            // Store db.find results in context
            if (blockResult.type === "dbFind" && blockResult.success) {
              newContext.dbFindResult = blockResult.data;
              console.log(
                "[WF-RUN] Stored dbFindResult in context:",
                blockResult.data
              );
            }

            // Store other results as needed
            if (blockResult.data) {
              newContext[nodeLabel] = blockResult.data;
            }
          }

          console.log(
            "[WF-RUN] ABOUT TO CALL setWorkflowContext with:",
            newContext
          );
          setWorkflowContext(newContext);
          console.log(
            "[WF-RUN] AFTER setWorkflowContext call - context should be updated"
          );
        } else {
          console.log("[WF-RUN] SKIPPED context update - condition failed");
        }

        // Process results from backend execution
        if (result.results && Array.isArray(result.results)) {
          for (const resultItem of result.results) {
            if (!resultItem.result) continue;

            const blockResult = resultItem.result;
            const nodeLabel = resultItem.nodeLabel || "unknown";

            console.log(`[WF-RUN] Processing result for ${nodeLabel}:`, {
              success: blockResult.success,
              type: blockResult.type,
              fullResult: blockResult,
            });

            // Detect HTTP response objects in returned context and log them
            try {
              const ctx = blockResult.context || {};
              for (const [k, v] of Object.entries(ctx)) {
                if (
                  v &&
                  typeof v === "object" &&
                  "statusCode" in v &&
                  "data" in v
                ) {
                  console.log("🌐 [WF-RUN] HTTP response object found in context:", k, v);
                  // Show toast for successful quote fetch (guard safely)
                  if ("success" in v && (v as any).success) {
                    toast({
                      title: "Quote fetched successfully.",
                      description: `HTTP ${(v as any).statusCode}`,
                    });

                    // If a modal payload is already present, merge response into it
                    setRuntimeModalPayload((prev: any) => {
                      const base = prev || {};
                      return {
                        ...base,
                        data: {
                          ...(base.data || {}),
                          httpResponse: v,
                        },
                      };
                    });
                  }
                }
              }
            } catch (e) {
              console.warn("[WF-RUN] Error scanning context for http response", e);
            }

            // Handle page redirects
            if (blockResult.type === "redirect" && blockResult.redirect) {
              const redirectData = blockResult.redirect;
              console.log("[WF-RUN] Executing page redirect:", redirectData);

              if (redirectData.type === "page" && redirectData.target) {
                navigateTo(redirectData.target);
                return; // Stop after navigation
              } else if (redirectData.type === "url" && redirectData.target) {
                if (redirectData.openInNewTab) {
                  window.open(redirectData.target, "_blank");
                } else {
                  window.location.href = redirectData.target;
                }
                return; // Stop after navigation
              }
            }

            // Handle openModal actions returned from backend
            if (
              blockResult.type === "modal" ||
              (blockResult.action && blockResult.action.type === "openModal")
            ) {
              const payload =
                (blockResult.action && blockResult.action.payload) ||
                (blockResult.context && blockResult.context.openModalResult) ||
                blockResult;

              console.log("🪟 [WF-RUN] Opening runtime modal with payload:", payload);
              setRuntimeModalPayload(payload);
              setRuntimeModalOpen(true);
            }

            // Handle page back
            if (blockResult.type === "goBack") {
              console.log("[WF-RUN] Executing page goBack");
              goBack();
              return; // Stop after navigation
            }

            // Handle toast notifications
            if (
              blockResult.success &&
              blockResult.type === "toast" &&
              blockResult.toast
            ) {
              const toastData = blockResult.toast;
              console.log("🔔 [WF-RUN] Displaying toast:", toastData);

              toast({
                title: toastData.title,
                description: toastData.message,
                variant: toastData.variant || "default",
                duration: toastData.duration || 5000,
              });
            }

            // Handle toast errors
            if (
              !blockResult.success &&
              blockResult.type === "toast" &&
              blockResult.toast
            ) {
              const errorToast = blockResult.toast;
              console.log(
                "❌ [WF-RUN] Toast error, showing fallback:",
                errorToast
              );

              toast({
                title: errorToast.title || "Error",
                description: errorToast.message || "An error occurred",
                variant: "destructive",
                duration: 5000,
              });
            }

            if (
              !blockResult.success &&
              blockResult.type === "fileUpload"
            ) {
              toast({
                title: "File Upload Failed",
                description:
                  blockResult.message ||
                  "The uploaded file did not meet the configured rules.",
                variant: "destructive",
                duration: 5000,
              });
            }

            if (
              blockResult.success &&
              blockResult.type === "download" &&
              blockResult.download?.url &&
              typeof window !== "undefined"
            ) {
              const { url, fileName, mimeType } = blockResult.download;
              console.log("⬇️ [WF-RUN] Starting download:", {
                url,
                fileName,
                mimeType,
              });

              try {
                const link = document.createElement("a");
                link.href = url;
                if (fileName) {
                  link.download = fileName;
                }
                if (mimeType) {
                  link.type = mimeType;
                }
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast({
                  title: "Download starting",
                  description: fileName
                    ? `Downloading ${fileName}`
                    : "Your download is on the way",
                  duration: 3000,
                });
              } catch (downloadError) {
                console.error(
                  "❌ [WF-RUN] Failed to trigger browser download:",
                  downloadError
                );
              }
            }

            if (
              !blockResult.success &&
              blockResult.type === "download"
            ) {
              toast({
                title: "Download Failed",
                description: blockResult.message || "Unable to start download",
                variant: "destructive",
                duration: 5000,
              });
            }

            // Handle AI Summary results
            console.log("🔍 [WF-RUN] Checking AI Summary conditions:", {
              success: blockResult.success,
              type: blockResult.type,
              hasSummary: !!blockResult.summary,
              summaryContent: blockResult.summary,
            });

            if (
              blockResult.success &&
              blockResult.type === "aiSummary" &&
              blockResult.summary
            ) {
              const summaryResult = blockResult.summary;
              console.log("✨ [WF-RUN] Displaying AI summary:", summaryResult);
              console.log("✨ [WF-RUN] Setting summary data and opening popup");

              const newSummaryData = {
                summary: summaryResult.text || summaryResult.summary || "",
                fileName: summaryResult.fileName || "document",
                metadata: {
                  originalLength: summaryResult.originalLength,
                  summaryLength: summaryResult.summaryLength,
                  compressionRatio: summaryResult.compressionRatio,
                },
              };
              console.log("✨ [WF-RUN] Setting summary data:", newSummaryData);
              setSummaryData(newSummaryData);
              console.log("✨ [WF-RUN] Setting popup open to true");
              setSummaryPopupOpen(true);
              console.log("✨ [WF-RUN] Summary popup state updated");

              // Show a toast as confirmation that summary was processed
              toast({
                title: "✨ Summary Generated",
                description: `Document summarized: ${
                  summaryResult.fileName || "document"
                }`,
                variant: "default",
                duration: 3000,
              });
            }

            // Handle AI Summary errors
            if (!blockResult.success && blockResult.type === "aiSummary") {
              console.log("❌ [WF-RUN] AI Summary error:", blockResult.error);

              toast({
                title: "Summarization Failed",
                description:
                  blockResult.error || "Failed to summarize document",
                variant: "destructive",
                duration: 5000,
              });
            }

            // Handle other success messages
            if (blockResult.success && blockResult.message) {
              console.log(
                `✅ [WF-RUN] ${nodeLabel} success:`,
                blockResult.message
              );
            }
          }
        }

        console.log("[WF-RUN] Workflow execution completed successfully");
      } catch (error) {
        console.error("[WF-RUN] Workflow execution error:", error);
        toast({
          title: "Workflow Error",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [appId, navigateTo, goBack, toast, workflowContext]
  );

  // Handle element click
  const handleElementClick = (element: CanvasElement) => {
    if (element.type === "BUTTON" || element.type === "button") {
      console.log("🎯 LIVE PREVIEW: Button clicked:", element.id);

      // First, check if button is marked as submit button with explicit properties
      let formGroupId: string | null = null;

      if (
        element.properties?.isSubmitButton &&
        element.properties?.formGroupId
      ) {
        formGroupId = element.properties.formGroupId;
        console.log(
          `[CLICK] Button ${element.id} is marked as submit button for form group ${formGroupId} (explicit)`
        );
      } else {
        // Fallback: Look through all pages to find form groups with this button as submit button (legacy)
        pages.forEach((page: Page) => {
          page.groups?.forEach((group: FormGroup) => {
            if (
              group.submitButtonId === element.id ||
              group.properties?.submitButtonId === element.id
            ) {
              formGroupId = group.id ? String(group.id) : null;
              console.log(
                `[CLICK] Button ${element.id} is submit button for form group ${formGroupId} (legacy)`
              );
            }
          });
        });
      }

      // If this is a submit button, trigger form submission workflows
      if (formGroupId) {
        // Collect form data from all elements in this form group
        const formData: Record<string, any> = {};
        const uploadedFiles: Record<string, File> = {};

        // Get current form values from CanvasRenderer (stored in window)
        const canvasFormValues = (window as any).__canvasFormValues || {};
        const uploadedFilesMap = (window as any).__uploadedFiles || {};

        pages.forEach((page: Page) => {
          page.elements?.forEach((elem: CanvasElement) => {
            if (elem.groupId === formGroupId) {
              // Get the input value from CanvasRenderer's state, fallback to element properties
              const inputValue =
                canvasFormValues[elem.id] ?? elem.properties?.value ?? "";
              formData[elem.id] = inputValue;

              // Check if this is a file upload element with an uploaded file
              if (
                elem.type?.toUpperCase() === "UPLOAD" ||
                elem.type?.toUpperCase() === "FILE_UPLOAD"
              ) {
                console.log(
                  `[SUBMIT] Checking file upload element - ${elem.id}:`,
                  {
                    elementType: elem.type,
                    hasFileInMap: !!uploadedFilesMap[elem.id],
                    fileInMapType: uploadedFilesMap[elem.id]
                      ? typeof uploadedFilesMap[elem.id]
                      : "N/A",
                    fileInMapIsFile: uploadedFilesMap[elem.id]
                      ? uploadedFilesMap[elem.id] instanceof File
                      : false,
                  }
                );
                if (uploadedFilesMap[elem.id]) {
                  uploadedFiles[elem.id] = uploadedFilesMap[elem.id];
                  console.log(
                    `[SUBMIT] ✅ File upload element found - ${elem.id}:`,
                    {
                      fileName: uploadedFilesMap[elem.id].name,
                      fileSize: uploadedFilesMap[elem.id].size,
                      fileType: uploadedFilesMap[elem.id].type,
                      isFile: uploadedFilesMap[elem.id] instanceof File,
                    }
                  );
                } else {
                  console.log(
                    `[SUBMIT] ❌ No file found in uploadedFilesMap for ${elem.id}`
                  );
                }
              }

              console.log(
                `[SUBMIT] Collected form data - ${
                  elem.id
                }: ${inputValue} (from ${
                  canvasFormValues[elem.id] !== undefined
                    ? "canvas"
                    : "properties"
                })`
              );
            }
          });
        });

        console.log("[SUBMIT] Form data collected:", formData);
        console.log("[SUBMIT] Uploaded files:", {
          count: Object.keys(uploadedFiles).length,
          keys: Object.keys(uploadedFiles),
          details: Object.entries(uploadedFiles).map(([key, file]) => ({
            elementId: key,
            fileName: file instanceof File ? file.name : "NOT A FILE",
            fileSize: file instanceof File ? file.size : "N/A",
            isFile: file instanceof File,
          })),
        });

        const submitKey = `formGroup:${formGroupId}:submit` as TriggerKey;
        const submitWorkflows = workflowIndex.get(submitKey);

        if (submitWorkflows && submitWorkflows.length > 0) {
          console.log(
            `[SUBMIT] Found ${submitWorkflows.length} workflow(s) for ${submitKey}`
          );
          submitWorkflows.forEach((wf: Workflow) =>
            runWorkflow(wf, {
              elementId: element.id,
              formGroupId,
              formData, // Pass collected form data
              uploadedFiles, // Pass uploaded files
            })
          );
        } else {
          console.log(`[SUBMIT] No workflow found for ${submitKey}`);
        }
      }

      // Also check for click workflows on the button itself
      const clickKey = `${element.id}:click` as TriggerKey;
      const clickWorkflows = workflowIndex.get(clickKey);

      if (clickWorkflows && clickWorkflows.length > 0) {
        console.log(
          `[CLICK] Found ${clickWorkflows.length} workflow(s) for ${clickKey}`
        );
        clickWorkflows.forEach((wf: Workflow) =>
          runWorkflow(wf, { elementId: element.id })
        );
      } else if (!formGroupId) {
        console.log(`[CLICK] No workflow found for ${clickKey}`);
      }
    }
  };

  // Try to find page by ID with type conversion
  const currentPage =
    pages.find(
      (p: Page) =>
        p.id === currentPageId ||
        p.id === String(currentPageId) ||
        String(p.id) === currentPageId ||
        String(p.id) === String(currentPageId)
    ) || pages[0];

  // Enhanced debugging for runtime
  const debugInfo = {
    pagesCount: pages.length,
    currentPageId,
    currentPageFound: !!currentPage,
    currentPageName: currentPage?.name,
    currentPageElementsCount: currentPage?.elements?.length || 0,
    allPages: pages.map((p: Page) => ({
      id: p.id,
      name: p.name,
      elementsCount: p.elements?.length || 0,
    })),
  };
  console.log("🔍 RUN: Current state:", debugInfo);

  // Temporary alert for debugging
  if (currentPage && currentPage.elements && currentPage.elements.length > 0) {
    console.log("🔍 RUN: First 3 elements:", currentPage.elements.slice(0, 3));
  } else {
    console.log("🔍 RUN: No elements found!", { currentPage, pages });
  }

  // Runtime event handler for preview mode - NEW: Uses workflow index
  const handleRuntimeEvent = (
    elementId: string,
    eventType: string,
    data?: any
  ) => {
    console.log("[EVENT]", elementId, eventType, data);
    console.log("[EVENT] ===== EVENT HANDLER CALLED =====");
    console.log("[EVENT] workflowIndex size:", workflowIndex.size);
    console.log(
      "[EVENT] workflowIndex keys:",
      Array.from(workflowIndex.keys())
    );
    console.log("[EVENT] Looking for key:", `${elementId}:${eventType}`);

    // Check workflow index for this element:event combination
    if (
      eventType === "click" ||
      eventType === "change" ||
      eventType === "submit" ||
      eventType === "drop"
    ) {
      // Special handling for form submission events
      if (eventType === "submit" && data?.formGroupId) {
        const formGroupKey =
          `formGroup:${data.formGroupId}:submit` as TriggerKey;
        const formGroupWorkflows = workflowIndex.get(formGroupKey);

        console.log(
          `[EVENT] Form submission - checking form group key: ${formGroupKey}`
        );

        if (formGroupWorkflows && formGroupWorkflows.length > 0) {
          console.log(
            `[EVENT] Found ${formGroupWorkflows.length} onSubmit workflow(s) for form group`
          );

          // Collect uploaded files from window
          const uploadedFilesMap = (window as any).__uploadedFiles || {};
          const uploadedFiles: Record<string, File> = {};

          console.log(`[EVENT] Checking for uploaded files:`, {
            uploadedFilesMapKeys: Object.keys(uploadedFilesMap),
            uploadedFilesMapCount: Object.keys(uploadedFilesMap).length,
          });

          // Collect files for all elements in the form group
          pages.forEach((page: Page) => {
            page.elements?.forEach((elem: CanvasElement) => {
              if (elem.groupId === data.formGroupId) {
                if (
                  (elem.type?.toUpperCase() === "UPLOAD" ||
                    elem.type?.toUpperCase() === "FILE_UPLOAD") &&
                  uploadedFilesMap[elem.id]
                ) {
                  uploadedFiles[elem.id] = uploadedFilesMap[elem.id];
                  console.log(
                    `[EVENT] ✅ Collected file for element ${elem.id}:`,
                    {
                      fileName: uploadedFilesMap[elem.id].name,
                      fileSize: uploadedFilesMap[elem.id].size,
                    }
                  );
                }
              }
            });
          });

          console.log(
            `[EVENT] Total files collected:`,
            Object.keys(uploadedFiles).length
          );

          formGroupWorkflows.forEach((wf: Workflow) => {
            runWorkflow(wf, {
              elementId,
              formData: data.formData,
              triggerElement: data.triggerElement,
              formGroupId: data.formGroupId,
              eventType: "submit",
              uploadedFiles, // ✅ NOW PASSING uploadedFiles!
            });
          });
          return; // Don't process regular element workflows for form submissions
        } else {
          console.log(
            `[EVENT] No onSubmit workflow found for form group: ${data.formGroupId}`
          );
        }
      }

      const key = `${elementId}:${eventType}` as TriggerKey;
      const workflowList = workflowIndex.get(key);

      if (workflowList && workflowList.length > 0) {
        console.log(
          `[EVENT] Found ${workflowList.length} workflow(s) for ${key}`
        );

        // Special handling for drop events
        if (eventType === "drop") {
          workflowList.forEach((wf: Workflow) => {
            // Find onDrop nodes in the workflow
            const onDropNodes = wf.nodes.filter(
              (node: WorkflowNode) => node.data?.label === "onDrop"
            );
            if (onDropNodes.length > 0) {
              console.log(
                "📁 [DROP-EVENT] Processing drop with files:",
                data?.files?.length
              );
              runWorkflow(wf, {
                elementId,
                dropData: {
                  files: data?.files || [],
                  position: data?.position || { x: 0, y: 0 },
                  elementId: elementId,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          });
        } else {
          // Execute all workflows for this trigger (in order)
          workflowList.forEach((wf: Workflow) =>
            runWorkflow(wf, { elementId, data })
          );
        }
        return; // Workflow handled the event
      }
    }

    // Custom event for invalid phone input from CanvasRenderer
    if (eventType === "invalidPhone") {
      try {
        const message = data?.message || "Invalid phone input";
        // Use toast to show the message in run mode
        toast({ title: "Invalid phone number", description: message, variant: "destructive", duration: 4000 });
      } catch (err) {
        console.warn("Failed to show invalidPhone toast", err);
      }
      return;
    }

    // Fallback to legacy handler for backwards compatibility
    switch (eventType) {
      case "click":
        console.log(
          `[EVENT] No workflow found for ${elementId}:${eventType}, using fallback`
        );
        // Don't call handleElementClick to avoid infinite recursion
        // Just log that no workflow was found
        break;
      case "change":
        // Update local state map for form inputs
        console.log("🔄 RUNTIME: Input changed:", elementId, data?.value);
        break;
      default:
        console.log("🎯 RUNTIME: Event:", eventType, elementId, data);
    }
  };

  // Trigger onPageLoad workflows when page loads
  useEffect(() => {
    if (!currentPageId || !currentPage || loading) {
      console.log("[PAGE-LOAD] Skipping - page not ready", {
        currentPageId,
        hasCurrentPage: !!currentPage,
        loading,
      });
      return;
    }

    console.log(
      "[PAGE-LOAD] 📄 Page loaded, checking for onPageLoad workflows"
    );
    console.log("[PAGE-LOAD] Current page ID:", currentPageId);
    console.log("[PAGE-LOAD] Workflow index size:", workflowIndex.size);
    console.log(
      "[PAGE-LOAD] Workflow index keys:",
      Array.from(workflowIndex.keys())
    );

    // Look for onPageLoad workflows indexed by page ID
    const pageLoadKey = `page:${currentPageId}:pageLoad` as TriggerKey;
    const pageLoadWorkflows = workflowIndex.get(pageLoadKey);

    if (pageLoadWorkflows && pageLoadWorkflows.length > 0) {
      console.log(
        `[PAGE-LOAD] ✅ Found ${pageLoadWorkflows.length} onPageLoad workflow(s) for page ${currentPageId}`
      );

      // Execute each onPageLoad workflow with page context
  pageLoadWorkflows.forEach((wf: Workflow, index: number) => {
        console.log(
          `[PAGE-LOAD] Executing workflow ${index + 1}/${
            pageLoadWorkflows.length
          }`
        );
        runWorkflow(wf, {
          pageId: currentPageId,
          pageName: currentPage.name,
          loadData: {
            timestamp: new Date().toISOString(),
            elementCount: currentPage.elements?.length || 0,
          },
        });
      });
    } else {
      console.log(
        `[PAGE-LOAD] ℹ️ No onPageLoad workflows found for page ${currentPageId}`
      );
    }
  }, [currentPageId, currentPage, loading, workflowIndex, runWorkflow]);

  // Debug current state
  console.log("🔍 RUN: Render state:", {
    loading,
    pagesCount: pages.length,
    currentPageId,
    currentPage: currentPage
      ? {
          id: currentPage.id,
          name: currentPage.name,
          elementsCount: currentPage.elements?.length || 0,
          elements:
            currentPage.elements?.map((el: CanvasElement) => ({
              id: el.id,
              type: el.type,
            })) || [],
        }
      : null,
    workflowsCount: workflows.size,
  availablePageIds: pages.map((p: Page) => p.id),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-800">
            Loading live preview...
          </p>
          <p className="text-sm text-gray-500 mt-2">AppId: {appId}</p>
          <p className="text-sm text-green-600 mt-1">
            ✅ Route /run is working!
          </p>
          <p className="text-xs text-gray-400 mt-2">
            If this stays loading, check browser console for errors
          </p>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg border border-red-200">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-red-600 mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 mb-4">
            Current Page ID:{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              {currentPageId}
            </code>
          </p>
          <p className="text-gray-600 mb-4">
            Available Pages:{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              {pages.map((p: Page) => p.id).join(", ") || "None"}
            </code>
          </p>
          <p className="text-gray-600 mb-4">
            Total Pages:{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              {pages.length}
            </code>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Generate background style
  const getBackgroundStyle = () => {
    const bg = currentPage?.canvasBackground;
    if (!bg) return { backgroundColor: "#ffffff" };

    if (bg.type === "gradient" && bg.gradient) {
      const { type, colors, direction } = bg.gradient;
      if (type === "radial") {
        return {
          background: `radial-gradient(circle, ${colors.join(", ")})`,
        };
      } else {
        return {
          background: `linear-gradient(${direction || "45deg"}, ${colors.join(
            ", "
          )})`,
        };
      }
    }

    return { backgroundColor: bg.color || "#ffffff" };
  };

  return (
    <div className="min-h-screen" style={getBackgroundStyle()}>
      {/* Live Preview Header */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-medium">
            🎥 Live App Preview - App {appId}
          </h1>
          <span className="text-xs bg-green-600 px-2 py-1 rounded">
            {currentPage.name || `Page ${currentPageId}`}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTestQuote}
            className="px-2 py-1 text-xs rounded bg-emerald-500 text-white hover:bg-emerald-600"
          >
            Test Quote
          </button>
          {pages.map((page: Page, index: number) => (
            <button
              key={page.id}
              onClick={() => {
                const redirectUrl = `/run?appId=${appId}&pageId=${page.id}`;
                window.location.href = redirectUrl;
              }}
              className={`px-2 py-1 text-xs rounded ${
                currentPageId === page.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {page.name || `Page ${index + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Runtime Canvas - 1:1 scale, no transforms */}
      <div className="runtime-reset w-full h-[calc(100vh-56px)] flex items-center justify-center bg-white dark:bg-gray-900 overflow-auto">
        {(() => {
          // Parity verification logs
          const canvasWidth = currentPage?.canvasWidth ?? 960;
          const canvasHeight = currentPage?.canvasHeight ?? 640;
          const elementCount = currentPage?.elements?.length || 0;

          console.log("🔍 RUN: Rendering canvas with:", {
            currentPageId,
            currentPageName: currentPage?.name,
            elementCount,
            canvasWidth,
            canvasHeight,
            canvasDimensions: `${canvasWidth}x${canvasHeight}`,
          });

          // Log first few elements for verification
          if (elementCount > 0) {
            console.log(
              "🔍 RUN: First 3 elements:",
              currentPage.elements.slice(0, 3).map((el) => ({
                id: el.id,
                type: el.type,
                pos: `${el.x},${el.y}`,
                size: `${el.width}x${el.height}`,
              }))
            );
          }

          return null;
        })()}

        {(() => {
          // Build canvas style with page background/border/shadow
          const pageStyle =
            (currentPage as any).style || currentPage.canvasBackground;
          const canvasStyle: React.CSSProperties = {
            width: currentPage.canvasWidth ?? 960,
            height: currentPage.canvasHeight ?? 640,
            position: "relative",
            overflow: "hidden",
            ...mapPageStyle(pageStyle),
          };

          // Log canvas style for verification
          console.log("[RUN] canvasStyle:", canvasStyle);
          console.log("[RUN] pageStyleHash:", getPageStyleHash(pageStyle));

          return (
            <div style={canvasStyle}>
              <CanvasRenderer
                mode="preview"
                readOnly
                canvasWidth={currentPage.canvasWidth ?? 960}
                canvasHeight={currentPage.canvasHeight ?? 640}
                elements={(currentPage.elements as CanvasElement[]) || []}
                onEvent={handleRuntimeEvent}
                hasClickWorkflow={(elementId) =>
                  workflowIndex.has(`${elementId}:click` as TriggerKey)
                }
                formGroups={
                  currentPage.groups?.filter((g: any) => g.type === "form") ||
                  []
                }
                workflowContext={workflowContext}
              />
            </div>
          );
        })()}
      </div>

      {/* Runtime modal used by workflows (ui.openModal) */}
      <Dialog
        open={runtimeModalOpen}
        onOpenChange={() => {
          setRuntimeModalOpen(false);
          setRuntimeModalPayload(null);
        }}
      >
        {/* Responsive dialog: full width on small screens, centered with max-width on larger screens.
            Use max-height + overflow to keep content scrollable on small viewports. */}
        <DialogContent className="w-full mx-4 sm:mx-auto max-w-3xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl p-4 max-h-[80vh] overflow-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg sm:text-xl font-medium break-words">
              {runtimeModalPayload?.title || runtimeModalPayload?.modalId || "Modal"}
            </DialogTitle>
            {runtimeModalPayload?.content && (
              <DialogDescription className="text-sm text-muted-foreground">
                {runtimeModalPayload?.content}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            <TestDisplayElement data={runtimeModalPayload?.data || runtimeModalPayload} />
          </div>

          <DialogFooter>
            <div className="w-full flex flex-col sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => {
                  setRuntimeModalOpen(false);
                  setRuntimeModalPayload(null);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Popup - Always render to avoid mounting issues */}
      <AiSummaryPopup
        isOpen={summaryPopupOpen && !!summaryData}
        onClose={() => {
          console.log("🎯 [RUN-PAGE] Closing summary popup");
          setSummaryPopupOpen(false);
          // Optionally clear summary data after closing
          setTimeout(() => setSummaryData(null), 300);
        }}
        summary={summaryData?.summary || ""}
        fileName={summaryData?.fileName || "document"}
        metadata={summaryData?.metadata}
      />
    </div>
  );
}

// Error boundary component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (error: any) => {
      console.error("🚨 Run App Error:", error);
      setHasError(true);
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg border border-red-200">
          <h1 className="text-xl font-bold text-red-600 mb-4">
            ⚠️ Run App Error
          </h1>
          <p className="text-gray-600 mb-4">
            Something went wrong loading the app preview.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function RunApp() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-blue-50">
            <div className="text-center p-8 bg-white rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-semibold">Loading Run App...</p>
              <p className="text-sm text-blue-600 mt-2">
                ✅ Suspense boundary working
              </p>
            </div>
          </div>
        }
      >
        <RunAppContent />
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}