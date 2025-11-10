"use client";

import {
  useState,
  useCallback,
  useRef,
  DragEvent,
  useEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  EdgeChange,
  NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import _ from "lodash";
import { Plus, Undo, Redo, AlertTriangle, CheckCircle } from "lucide-react";
import WorkflowNode from "./workflow-node";
import { BlockRecommendationPanel } from "./block-recommendation-panel";
import {
  getBlockRecommendations,
  BlockRecommendation,
} from "../utils/block-recommendations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

interface WorkflowCanvasProps {
  onDrop?: (event: DragEvent, reactFlowBounds: DOMRect) => void;
  selectedElementId?: string | null;
  onSaveRequest?: () => void; // Callback to expose save function to parent
  saveHandlerRef?: React.MutableRefObject<(() => Promise<void>) | null>; // Ref to expose save handler
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface ConnectionDialogData {
  isOpen: boolean;
  sourceNode?: Node;
  targetNode?: Node;
  connection?: Connection;
}

interface EdgeContextMenuData {
  isOpen: boolean;
  edge?: Edge;
  x: number;
  y: number;
}

// Connector types with their properties
const CONNECTOR_TYPES = {
  next: { label: "next", color: "source", description: "Sequential flow" },
  yes: { label: "yes", color: "#10b981", description: "Condition true" },
  no: { label: "no", color: "#ef4444", description: "Condition false" },
  onError: {
    label: "onError",
    color: "#ef4444",
    description: "Error handling",
  },
  fork: { label: "fork", color: "source", description: "Parallel branch" },
  join: { label: "join", color: "source", description: "Merge branches" },
  loopBack: {
    label: "loopBack",
    color: "source",
    description: "Loop iteration",
  },
  eventEdge: {
    label: "eventEdge",
    color: "source",
    description: "Event emission",
  },
};

// Category color mapping
const CATEGORY_COLORS = {
  Triggers: "#6366f1", // indigo-500
  Conditions: "#10b981", // emerald-500
  Actions: "#06b6d4", // cyan-500
  "AI Blocks": "#a855f7", // purple-500
  "Security & Governance": "#f43f5e", // rose-500
  "Utility & Data": "#f59e0b", // amber-500
  "Execution & Schedules": "#f97316", // orange-500
};

function WorkflowCanvasInner({
  onDrop,
  selectedElementId,
  onSaveRequest,
  saveHandlerRef,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, zoomTo } =
    useReactFlow();
  const { workflows, setWorkflows } = useCanvasWorkflow();
  const router = useRouter();

  // History management for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [connectionDialog, setConnectionDialog] =
    useState<ConnectionDialogData>({ isOpen: false });
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuData>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const [newNodeName, setNewNodeName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [ghostEdge, setGhostEdge] = useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);

  // Block recommendations state
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [currentRecommendations, setCurrentRecommendations] = useState<
    BlockRecommendation[]
  >([]);
  const [lastAddedNodeLabel, setLastAddedNodeLabel] = useState<string | null>(
    null
  );

  // Save state to history
  const saveToHistory = useCallback(() => {
    const newState: HistoryState = { nodes, edges };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  // Function to save workflow to backend (manual save only)
  // Updated for JSON Blueprint Serialization - uses new PATCH /api/canvas/workflows/:appId endpoint
  const saveWorkflowToBackend = useCallback(
    async (elementId: string, nodes: Node[], edges: Edge[]) => {
      try {
        // Validate element is selected
        if (!elementId) {
          console.warn("⚠️  No element selected");
          toast({
            title: "No Element Selected",
            description: "Please select an element before saving the workflow.",
            variant: "destructive",
          });
          return false;
        }

        const appId = new URLSearchParams(window.location.search).get("appId");
        if (!appId) {
          console.warn("⚠️  No appId found, skipping workflow save");
          toast({
            title: "Error",
            description: "No app ID found. Cannot save workflow.",
            variant: "destructive",
          });
          return false;
        }

        // Get token from localStorage (stored as 'authToken' by auth.ts)
        console.log("🔍 SAVE: Checking for auth token in localStorage...");
        console.log(
          "🔍 SAVE: authToken key:",
          localStorage.getItem("authToken") ? "EXISTS" : "NULL"
        );
        console.log(
          "🔍 SAVE: token key:",
          localStorage.getItem("token") ? "EXISTS" : "NULL"
        );
        console.log(
          "🔍 SAVE: jwt key:",
          localStorage.getItem("jwt") ? "EXISTS" : "NULL"
        );

        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("jwt");
        if (!token) {
          console.error("❌ SAVE: No token found in localStorage");
          console.log(
            "ℹ️  SAVE: Available localStorage keys:",
            Object.keys(localStorage)
          );
          console.warn("⚠️  No auth token found, redirecting to login");
          toast({
            title: "Authentication Required",
            description: "Please log in to save workflows. Redirecting...",
            variant: "destructive",
          });
          // Redirect to login page after a short delay
          setTimeout(() => {
            router.push("/");
          }, 1500);
          return false;
        }
        console.log(
          "✅ SAVE: Auth token found:",
          token.substring(0, 20) + "..."
        );
        console.log(
          "✅ SAVE: Token retrieved from key:",
          localStorage.getItem("authToken")
            ? "authToken"
            : localStorage.getItem("token")
            ? "token"
            : "jwt"
        );

        console.log("💾 SAVE: Starting workflow save for element:", elementId);
        console.log("💾 SAVE: App ID:", appId);
        console.log("💾 SAVE: Nodes count:", nodes.length);
        console.log("💾 SAVE: Edges count:", edges.length);
        console.log(
          "💾 SAVE: Nodes:",
          nodes.map((n) => ({
            id: n.id,
            type: n.data?.type || n.type,
            position: n.position,
          }))
        );
        console.log(
          "💾 SAVE: Edges:",
          edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type,
          }))
        );

        // Prepare workflow JSON with proper structure for JSON Blueprint Serialization
        const workflowData = {
          elementId: elementId,
          nodes: nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            label: edge.label,
            data: edge.data,
          })),
          metadata: {
            timestamp: Date.now(),
            nodeCount: nodes.length,
            edgeCount: edges.length,
            lastModified: new Date().toISOString(),
          },
        };

        console.log(
          "📦 SAVE: Workflow data payload:",
          JSON.stringify(workflowData, null, 2)
        );

        // Use new PATCH endpoint for JSON Blueprint Serialization
        const apiUrl = `/api/canvas/workflows/${appId}`;
        console.log("📡 SAVE: Sending PATCH request to:", apiUrl);

        const response = await fetch(apiUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(workflowData),
        });

        console.log("📡 SAVE: Response status:", response.status);
        const data = await response.json();
        console.log("📡 SAVE: Response data:", data);

        if (data.success) {
          console.log("✅ Workflow saved to backend:", data.data);
          toast({
            title: "Workflow Saved",
            description: `Successfully saved workflow for element ${elementId}`,
          });
          return true;
        } else {
          console.error("❌ Failed to save workflow:", data.message);
          toast({
            title: "Save Failed",
            description: data.message || "Failed to save workflow",
            variant: "destructive",
          });
          return false;
        }
      } catch (error) {
        console.error("❌ Error saving workflow to backend:", error);
        toast({
          title: "Error",
          description: "An error occurred while saving the workflow",
          variant: "destructive",
        });
        return false;
      }
    },
    []
  );

  // Store workflow in context when nodes/edges change (NO AUTO-SAVE)
  useEffect(() => {
    if (selectedElementId && (nodes.length > 0 || edges.length > 0)) {
      const workflow = { nodes, edges };
      // Store workflow using selectedElementId as the key (in-memory only)
      setWorkflows(new Map(workflows).set(selectedElementId, workflow));
      console.log(
        "💾 Workflow stored in context for element:",
        selectedElementId,
        { nodes: nodes.length, edges: edges.length }
      );
    }
  }, [nodes, edges, selectedElementId, setWorkflows]);

  // Manual save handler - exposed to parent via onSaveRequest
  const handleManualSave = useCallback(async () => {
    console.log("🔧 Manual save triggered:", {
      selectedElementId,
      nodesCount: nodes.length,
      edgesCount: edges.length,
    });

    if (!selectedElementId) {
      console.warn("⚠️  No element selected for save");
      toast({
        title: "No Element Selected",
        description: "Please select an element before saving the workflow.",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ Saving workflow for element:", selectedElementId);
    await saveWorkflowToBackend(selectedElementId, nodes, edges);
  }, [selectedElementId, nodes, edges, saveWorkflowToBackend]);

  // Expose save handler to parent component via ref (no window object, no async issues)
  useEffect(() => {
    console.log("🔧 WorkflowCanvas: Registering save handler", {
      saveHandlerRef: !!saveHandlerRef,
      selectedElementId,
    });
    if (saveHandlerRef) {
      // Store the save handler in the ref provided by parent
      saveHandlerRef.current = handleManualSave;
      console.log(
        "✅ WorkflowCanvas: Save handler registered successfully via ref"
      );
    } else {
      console.warn("⚠️  WorkflowCanvas: saveHandlerRef prop not provided");
    }

    // Cleanup on unmount
    return () => {
      if (saveHandlerRef) {
        saveHandlerRef.current = null;
      }
    };
  }, [handleManualSave, saveHandlerRef, selectedElementId]);

  // Load workflow from backend when element is selected
  // Updated for JSON Blueprint Serialization - uses new GET /api/canvas/workflows/:appId endpoint
  // Track re-renders for debugging (removed - was causing performance issues)
  // useEffect(() => {
  //   console.log('🔄 RENDER: Workflow canvas component re-rendered');
  //   console.log('🔄 RENDER: selectedElementId:', selectedElementId);
  //   console.log('🔄 RENDER: nodes count:', nodes.length);
  //   console.log('🔄 RENDER: edges count:', edges.length);
  // });

  // Track if we've already loaded for this element to prevent re-loading on every workflow update
  const loadedElementRef = useRef<string | null>(null);

  useEffect(() => {
    const loadWorkflowFromBackend = async () => {
      console.log(
        "📖 LOAD: useEffect triggered for selectedElementId:",
        selectedElementId
      );

      if (!selectedElementId) {
        console.log("ℹ️  LOAD: No element selected, clearing canvas");
        // Clear canvas when no element is selected
        setNodes([]);
        setEdges([]);
        loadedElementRef.current = null;
        return;
      }

      // Skip if we've already loaded this element (prevents re-loading after adding nodes)
      if (loadedElementRef.current === selectedElementId) {
        console.log(
          "ℹ️  LOAD: Already loaded workflow for element:",
          selectedElementId,
          "- skipping reload"
        );
        return;
      }

      try {
        const appId = new URLSearchParams(window.location.search).get("appId");
        if (!appId) {
          console.log("ℹ️  LOAD: No appId found, skipping workflow load");
          return;
        }

        // Get token from localStorage (stored as 'authToken' by auth.ts)
        console.log("🔍 LOAD: Checking for auth token in localStorage...");
        console.log(
          "🔍 LOAD: authToken key:",
          localStorage.getItem("authToken") ? "EXISTS" : "NULL"
        );
        console.log(
          "🔍 LOAD: token key:",
          localStorage.getItem("token") ? "EXISTS" : "NULL"
        );
        console.log(
          "🔍 LOAD: jwt key:",
          localStorage.getItem("jwt") ? "EXISTS" : "NULL"
        );

        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("jwt");
        if (!token) {
          console.error("❌ LOAD: No token found in localStorage");
          console.log(
            "ℹ️  LOAD: Available localStorage keys:",
            Object.keys(localStorage)
          );
          console.log("ℹ️  LOAD: Please log in at http://localhost:3000 first");
          return;
        }
        console.log(
          "✅ LOAD: Auth token found:",
          token.substring(0, 20) + "..."
        );

        console.log(
          "📖 LOAD: Starting workflow load for element:",
          selectedElementId
        );
        console.log("📖 LOAD: App ID:", appId);

        // Clear canvas BEFORE loading to ensure clean state
        console.log("🧹 LOAD: Clearing canvas before loading new workflow");
        setNodes([]);
        setEdges([]);

        // Use optimized GET endpoint with elementId query parameter
        const apiUrl = `/api/canvas/workflows/${appId}?elementId=${encodeURIComponent(
          selectedElementId
        )}`;
        console.log("📡 LOAD: Fetching from:", apiUrl);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📡 LOAD: Response status:", response.status);

        // Handle 401 Unauthorized - token expired/invalid
        if (response.status === 401) {
          console.log(
            "🔄 LOAD: Token expired or invalid, redirecting to login"
          );
          localStorage.removeItem("authToken");
          localStorage.removeItem("token");
          localStorage.removeItem("jwt");
          window.location.href = "/login";
          return;
        }

        const data = await response.json();
        console.log("📡 LOAD: Response data:", {
          success: data.success,
          hasData: !!data.data,
        });

        if (data.success && data.data) {
          // Backend now returns single workflow object (not array) when elementId is specified
          const workflow = data.data;

          console.log(
            "✅ LOAD: Found workflow for element:",
            selectedElementId
          );
          console.log("✅ LOAD: Workflow details:", {
            id: workflow.id,
            elementId: workflow.elementId,
            nodesCount: workflow.nodes?.length || 0,
            edgesCount: workflow.edges?.length || 0,
            nodes: workflow.nodes?.map((n: any) => ({
              id: n.id,
              type: n.data?.type || n.type,
              position: n.position,
            })),
            edges: workflow.edges?.map((e: any) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              type: e.type,
            })),
          });

          // Set nodes and edges from backend
          setNodes(workflow.nodes || []);
          setEdges(workflow.edges || []);

          // Also store in context
          setWorkflows(
            new Map(workflows).set(selectedElementId, {
              nodes: workflow.nodes,
              edges: workflow.edges,
            })
          );

          console.log(
            "✅ LOAD: Workflow loaded successfully for element:",
            selectedElementId
          );
        } else {
          console.log(
            "ℹ️  LOAD: No workflow found for element:",
            selectedElementId
          );
          console.log("ℹ️  LOAD: Canvas already cleared, keeping empty state");
        }

        // Mark this element as loaded
        loadedElementRef.current = selectedElementId;
      } catch (error) {
        console.error("❌ LOAD: Error loading workflow:", error);
        console.error(
          "❌ LOAD: Error details:",
          error instanceof Error ? error.message : String(error)
        );
        // Clear nodes and edges on error
        setNodes([]);
        setEdges([]);
        loadedElementRef.current = selectedElementId; // Still mark as loaded to prevent retry loop
      }
    };

    loadWorkflowFromBackend();
  }, [selectedElementId, setNodes, setEdges, setWorkflows, workflows]);

  // Undo functionality
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
      toast({ title: "Undone", description: "Last action has been undone" });
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Redo functionality
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
      toast({ title: "Redone", description: "Action has been redone" });
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Get source node color based on category
  const getSourceNodeColor = useCallback((sourceNode: Node) => {
    return (
      CATEGORY_COLORS[
        sourceNode.data.category as keyof typeof CATEGORY_COLORS
      ] || "#6b7280"
    );
  }, []);

  // Validate connector compatibility
  const validateConnector = useCallback(
    (connectorType: string, sourceNode: Node, targetNode: Node) => {
      switch (connectorType) {
        case "yes":
        case "no":
          return sourceNode.data.category === "Conditions";
        case "onError":
          return ["Actions", "AI Blocks"].includes(sourceNode.data.category);
        case "fork":
          return ["Actions", "Triggers"].includes(sourceNode.data.category);
        case "join":
          return true; // Join can accept from any node
        case "loopBack":
          return ["Utility & Data", "Execution & Schedules"].includes(
            sourceNode.data.category
          );
        case "eventEdge":
          return ["AI Blocks", "Triggers"].includes(sourceNode.data.category);
        default:
          return true; // 'next' is always valid
      }
    },
    []
  );

  // Enhanced connection handler with source node color inheritance
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (sourceNode && targetNode) {
        // Default to "next" connector
        let connectorType = "next";
        let label = "next";
        let edgeColor = getSourceNodeColor(sourceNode);

        // Override based on source handle if specified
        if (params.sourceHandle === "yes") {
          connectorType = "yes";
          label = "yes";
          edgeColor = "#10b981";
        } else if (params.sourceHandle === "no") {
          connectorType = "no";
          label = "no";
          edgeColor = "#ef4444";
        } else if (params.sourceHandle === "error") {
          connectorType = "onError";
          label = "onError";
          edgeColor = "#ef4444";
        }

        // Validate connector compatibility
        if (!validateConnector(connectorType, sourceNode, targetNode)) {
          // Show validation error with shake animation
          const targetElement = document.querySelector(
            `[data-id="${targetNode.id}"]`
          );
          if (targetElement) {
            targetElement.classList.add("animate-bounce");
            setTimeout(
              () => targetElement.classList.remove("animate-bounce"),
              500
            );
          }

          toast({
            title: "Invalid Connection",
            description: `Invalid target for ${label} connector`,
            variant: "destructive",
          });
          return;
        }

        const newEdge = {
          ...params,
          id: `${params.source}-${params.target}-${Date.now()}`,
          label,
          type: "smoothstep",
          animated: false,
          style: {
            stroke: edgeColor,
            strokeWidth: 3,
            strokeDasharray: connectorType === "onError" ? "5,5" : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
            width: 20,
            height: 20,
          },
          labelStyle: {
            fontSize: "12px",
            fontWeight: "600",
            fill: edgeColor,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: "2px 6px",
            borderRadius: "4px",
            border: `1px solid ${edgeColor}`,
          },
          labelBgStyle: {
            fill: "rgba(255, 255, 255, 0.9)",
            fillOpacity: 0.9,
          },
          data: {
            connectorType,
            sourceCategory: sourceNode.data.category,
            canSwitch: true,
          },
        };

        setEdges((eds) => addEdge(newEdge, eds));
        saveToHistory();

        // Show connection dialog for naming
        setConnectionDialog({
          isOpen: true,
          sourceNode,
          targetNode,
          connection: params,
        });

        // Visual feedback - pulse animation
        setTimeout(() => {
          const edgeElement = document.querySelector(
            `[data-id="${newEdge.id}"]`
          );
          if (edgeElement) {
            edgeElement.classList.add("animate-pulse");
            setTimeout(
              () => edgeElement.classList.remove("animate-pulse"),
              1000
            );
          }
        }, 100);

        toast({
          title: "Connection Created",
          description: `Connected ${sourceNode.data.label} to ${targetNode.data.label}`,
        });
      }
    },
    [setEdges, nodes, saveToHistory, getSourceNodeColor, validateConnector]
  );

  // Handle edge click for connector switching
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    if (edge.data?.canSwitch) {
      setEdgeContextMenu({
        isOpen: true,
        edge,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }, []);

  // Handle edge context menu (right-click)
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (edge.data?.canSwitch) {
        setEdgeContextMenu({
          isOpen: true,
          edge,
          x: event.clientX,
          y: event.clientY,
        });
      }
    },
    []
  );

  // Switch connector type
  const switchConnectorType = useCallback(
    (edge: Edge, newConnectorType: string) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      // Validate new connector type
      if (!validateConnector(newConnectorType, sourceNode, targetNode)) {
        toast({
          title: "Invalid Connector",
          description: `Cannot use ${newConnectorType} connector for this connection`,
          variant: "destructive",
        });
        return;
      }

      const connectorConfig =
        CONNECTOR_TYPES[newConnectorType as keyof typeof CONNECTOR_TYPES];
      let edgeColor =
        connectorConfig.color === "source"
          ? getSourceNodeColor(sourceNode)
          : connectorConfig.color;

      // Special case for onError - always red
      if (newConnectorType === "onError") {
        edgeColor = "#ef4444";
      }

      const updatedEdge = {
        ...edge,
        label: connectorConfig.label,
        style: {
          stroke: edgeColor,
          strokeWidth: 3,
          strokeDasharray: newConnectorType === "onError" ? "5,5" : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 20,
          height: 20,
        },
        labelStyle: {
          fontSize: "12px",
          fontWeight: "600",
          fill: edgeColor,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "2px 6px",
          borderRadius: "4px",
          border: `1px solid ${edgeColor}`,
        },
        labelBgStyle: {
          fill: "rgba(255, 255, 255, 0.9)",
          fillOpacity: 0.9,
        },
        data: {
          ...edge.data,
          connectorType: newConnectorType,
        },
      };

      setEdges((edges) =>
        edges.map((e) => (e.id === edge.id ? updatedEdge : e))
      );
      setEdgeContextMenu({ isOpen: false, x: 0, y: 0 });
      saveToHistory();

      toast({
        title: "Connector Updated",
        description: `Changed to ${connectorConfig.label} connector`,
      });
    },
    [nodes, validateConnector, getSourceNodeColor, setEdges, saveToHistory]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return; // Don't handle shortcuts when typing in inputs
      }

      switch (event.key) {
        case "Delete":
        case "Backspace":
          if (selectedNodes.length > 0 || selectedEdges.length > 0) {
            saveToHistory();
            setNodes((nodes) =>
              nodes.filter((n) => !selectedNodes.includes(n.id))
            );
            setEdges((edges) =>
              edges.filter((e) => !selectedEdges.includes(e.id))
            );
            setSelectedNodes([]);
            setSelectedEdges([]);
            toast({
              title: "Deleted",
              description: "Selected items have been deleted",
            });
          }
          break;
        case "z":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          break;
        case "c":
          if (event.ctrlKey || event.metaKey) {
            // Copy functionality
            console.log("Copy selected nodes");
          }
          break;
        case "v":
          if (event.ctrlKey || event.metaKey) {
            // Paste functionality
            console.log("Paste nodes");
          }
          break;
        case "g":
          if (selectedNodes.length > 1) {
            // Group nodes
            console.log("Group selected nodes");
          }
          break;
        case "u":
          // Ungroup nodes
          console.log("Ungroup nodes");
          break;
        case "l":
          // Lock/unlock selected nodes
          if (selectedNodes.length > 0) {
            setNodes((nodes) =>
              nodes.map((n) =>
                selectedNodes.includes(n.id)
                  ? { ...n, data: { ...n.data, isLocked: !n.data.isLocked } }
                  : n
              )
            );
          }
          break;
        case "0":
          fitView();
          break;
        case "=":
        case "+":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
        case "f":
          if (selectedNodes.length > 0) {
            fitView({
              nodes: nodes.filter((n) => selectedNodes.includes(n.id)),
            });
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNodes,
    selectedEdges,
    nodes,
    edges,
    setNodes,
    setEdges,
    saveToHistory,
    undo,
    redo,
    fitView,
    zoomIn,
    zoomOut,
  ]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation(); // Stop propagation to prevent interference
    event.dataTransfer.dropEffect = "move";
    // Uncomment for verbose logging:
    // console.log("🔄 DRAG OVER: Drag over canvas", event.clientX, event.clientY)
  }, []);

  // Enhanced drop handler with validation and warnings
  const onDropHandler = useCallback(
    (event: DragEvent) => {
      console.log("🎯 DROP: Drop event triggered");
      console.log("🎯 DROP: Event target:", event.target);
      console.log("🎯 DROP: Event currentTarget:", event.currentTarget);
      event.preventDefault();
      event.stopPropagation();
      console.log("🎯 DROP: Event prevented and propagation stopped");

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) {
        console.error("❌ DROP: No reactFlowBounds");
        return;
      }
      console.log("✅ DROP: ReactFlow bounds:", reactFlowBounds);

      const type = event.dataTransfer.getData("application/reactflow");
      const blockData = event.dataTransfer.getData("application/json");
      const dataType = event.dataTransfer.getData("data-type");

      console.log("🎯 DROP: Retrieved data:", { type, blockData, dataType });
      console.log(
        "🎯 DROP: DataTransfer types:",
        Array.from(event.dataTransfer.types)
      );

      if (!type || !blockData) {
        console.error("❌ DROP: Missing required data", {
          type,
          blockData,
          dataType,
        });
        console.error(
          "❌ DROP: Available types:",
          Array.from(event.dataTransfer.types)
        );
        toast({
          title: "Drop Failed",
          description:
            "Missing required drag data. Please try dragging the node again.",
          variant: "destructive",
        });
        return;
      }
      console.log("✅ DROP: All required data present");

      let parsedData;
      try {
        parsedData = JSON.parse(blockData);
        console.log("Parsed data:", parsedData);
        if (parsedData.category === "Conditions") {
          console.log(`Dropping condition node: ${parsedData.name}`);
        }
      } catch (error) {
        console.error(
          "Failed to parse block data:",
          error,
          "Raw data:",
          blockData
        );
        toast({
          title: "Drop Failed",
          description: "Invalid drag data format. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Use screenToFlowPosition instead of deprecated project
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Snap to 16px grid
      position.x = Math.round(position.x / 16) * 16;
      position.y = Math.round(position.y / 16) * 16;

      // Generate sample data mapping based on node type
      const generateDataMapping = (category: string, name: string) => {
        switch (category) {
          case "Triggers":
            return { event: "click", timestamp: new Date().toISOString() };
          case "Conditions":
            return { input: "value", result: "boolean", condition: name };
          case "Actions":
            return { data: "payload", status: "pending" };
          default:
            return { input: "data", output: "result" };
        }
      };

      // Create node with category-specific properties
      const newNode: Node = {
        id: `${parsedData.name}-${Date.now()}`,
        type: "workflowNode",
        position,
        data: {
          label: parsedData.name,
          description: parsedData.description,
          category: parsedData.category,
          icon: parsedData.icon,
          dataMapping: generateDataMapping(
            parsedData.category,
            parsedData.name
          ),
          hasWarning: false,
          isLocked: false,
          // Add isNew flag for condition nodes to delay validation
          ...(parsedData.category === "Conditions" && { isNew: true }),
          // Link trigger nodes to selected canvas element
          ...(parsedData.category === "Triggers" &&
            selectedElementId && {
              linkedElementId: selectedElementId,
              elementType: selectedElementId.split("-")[0], // Extract element type from ID
            }),
          // Initialize page.redirect nodes with empty targetPageId
          ...(parsedData.name === "page.redirect" && {
            targetPageId: "",
          }),
          // Add condition-specific properties with proper port configuration
          ...(parsedData.category === "Conditions" && {
            ports: [
              {
                id: "input",
                type: "target",
                position: Position.Top,
                shape: "circle",
                label: "input",
                color: "emerald",
              },
              {
                id: "yes",
                type: "source",
                position: Position.Bottom,
                shape: "diamond",
                label: "yes",
                color: "emerald",
              },
              {
                id: "no",
                type: "source",
                position: Position.Right,
                shape: "diamond",
                label: "no",
                color: "emerald",
              },
            ],
          }),
        },
      };

      try {
        saveToHistory();
        setNodes((nds) => nds.concat(newNode));

        // Log Canvas-Workflow integration
        if (parsedData.category === "Triggers" && selectedElementId) {
          console.log("🔗 Trigger node linked to canvas element:", {
            nodeId: newNode.id,
            elementId: selectedElementId,
            triggerType: parsedData.name,
          });
        }

        // Show block recommendations after adding a node
        const recommendations = getBlockRecommendations(parsedData.name);
        if (recommendations.length > 0) {
          setLastAddedNodeLabel(parsedData.name);
          setCurrentRecommendations(recommendations);
          setShowRecommendations(true);
        }

        toast({
          title: "Node Added",
          description: `${parsedData.name} has been added to the workflow${
            parsedData.category === "Triggers" && selectedElementId
              ? ` (linked to ${selectedElementId})`
              : ""
          }`,
        });
      } catch (error) {
        console.error("Error adding node:", error);
        toast({
          title: "Error Adding Node",
          description: `Failed to add ${parsedData.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          variant: "destructive",
        });
      }
    },
    [screenToFlowPosition, setNodes, saveToHistory, selectedElementId, toast]
  );

  // Handler for adding a recommended block
  const handleAddRecommendedBlock = useCallback(
    (blockType: string, category: string) => {
      // Find the last added node to position the new node near it
      const lastNode = nodes[nodes.length - 1];
      const position = lastNode
        ? { x: lastNode.position.x + 250, y: lastNode.position.y }
        : { x: 250, y: 250 };

      const newNode: Node = {
        id: `${Date.now()}`,
        type: "workflowNode",
        position,
        data: {
          label: blockType,
          category,
          description: `${blockType} block`,
        },
      };

      saveToHistory();
      setNodes((nds) => nds.concat(newNode));
      setShowRecommendations(false);

      toast({
        title: "Block Added",
        description: `${blockType} has been added to the workflow`,
      });
    },
    [nodes, setNodes, saveToHistory, toast]
  );

  // Handler for dismissing recommendations
  const handleDismissRecommendations = useCallback(() => {
    setShowRecommendations(false);
    setCurrentRecommendations([]);
    setLastAddedNodeLabel(null);
  }, []);

  // Validation for empty states and errors
  const validateWorkflow = useCallback(() => {
    const warnings: string[] = [];
    const errors: string[] = [];

    nodes.forEach((node) => {
      const connectedEdges = edges.filter(
        (e) => e.source === node.id || e.target === node.id
      );

      // Check for unconnected condition nodes (skip newly dropped nodes)
      if (node.data.category === "Conditions" && !node.data.isNew) {
        const yesEdge = edges.find(
          (e) => e.source === node.id && e.sourceHandle === "yes"
        );
        const noEdge = edges.find(
          (e) => e.source === node.id && e.sourceHandle === "no"
        );

        if (!yesEdge || !noEdge) {
          warnings.push(
            `Condition "${node.data.label}" has unconnected branches`
          );
          // Update node to show warning (debounced to prevent infinite loop)
          setTimeout(() => {
            setNodes((nodes) =>
              nodes.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, hasWarning: true } }
                  : n
              )
            );
          }, 100);
        }
      }

      // Check for unconnected error handlers
      if (node.data.category === "Actions") {
        const errorEdge = edges.find(
          (e) => e.source === node.id && e.sourceHandle === "error"
        );
        if (!errorEdge) {
          warnings.push(`Action "${node.data.label}" has no error handler`);
        }
      }

      // Check for isolated nodes
      if (connectedEdges.length === 0) {
        warnings.push(`Node "${node.data.label}" is not connected`);
      }
    });

    return { warnings, errors };
  }, [nodes, edges, setNodes]);

  // Debounced version of validateWorkflow to prevent infinite loops
  const debouncedValidateWorkflow = useCallback(
    _.debounce(() => {
      if (nodes.length > 0) {
        validateWorkflow();
      }
    }, 200),
    [validateWorkflow, nodes]
  );

  // Remove isNew flag from nodes when they get connected (debounced)
  useEffect(() => {
    const connectedNodeIds = new Set();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    // Debounce the setNodes call to prevent infinite loop
    const timeoutId = setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.data.isNew && connectedNodeIds.has(node.id)) {
            return { ...node, data: { ...node.data, isNew: false } };
          }
          return node;
        })
      );
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [edges, setNodes]);

  // Run validation when edges change (debounced to prevent infinite loop)
  useEffect(() => {
    debouncedValidateWorkflow();
  }, [edges, debouncedValidateWorkflow]);

  // Handle node selection
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const selectionChanges = changes.filter(
        (change) => change.type === "select"
      );
      if (selectionChanges.length > 0) {
        const selected = selectionChanges
          .filter((change) => change.selected)
          .map((change) => change.id);
        setSelectedNodes(selected);
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // Handle edge selection
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const selectionChanges = changes.filter(
        (change) => change.type === "select"
      );
      if (selectionChanges.length > 0) {
        const selected = selectionChanges
          .filter((change) => change.selected)
          .map((change) => change.id);
        setSelectedEdges(selected);
      }
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  return (
    <div className="w-full h-full relative" ref={reactFlowWrapper}>
      {/* Undo/Redo Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={undo}
          disabled={historyIndex <= 0}
          className="bg-background/95 backdrop-blur-sm"
        >
          <Undo className="w-4 h-4 mr-1" />
          Undo
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="bg-background/95 backdrop-blur-sm"
        >
          <Redo className="w-4 h-4 mr-1" />
          Redo
        </Button>
      </div>

      {/* Validation Status */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {nodes.some((n) => n.data.hasWarning) && (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warnings
          </Badge>
        )}
        {nodes.length > 0 && !nodes.some((n) => n.data.hasWarning) && (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDropHandler}
        onDragOver={onDragOver}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={true}
        snapGrid={[16, 16]}
        connectionLineStyle={{
          stroke: "#6366f1",
          strokeWidth: 3,
          strokeDasharray: "5,5",
        }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: {
            strokeWidth: 3,
            stroke: "#6b7280",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
          labelStyle: {
            fontSize: "12px",
            fontWeight: "600",
            fill: "#374151",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: "2px 6px",
            borderRadius: "4px",
          },
        }}
        fitView
        className="bg-background"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Start Building Your Workflow
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Drag blocks from the library to create your automation
                  workflow. Connect triggers, conditions, and actions to build
                  powerful automations.
                </p>
                <div className="text-xs text-muted-foreground space-y-1 mt-4">
                  <p>
                    <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                      Delete
                    </kbd>{" "}
                    - Remove selected items
                  </p>
                  <p>
                    <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                      Ctrl+Z
                    </kbd>{" "}
                    - Undo |{" "}
                    <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                      Ctrl+Shift+Z
                    </kbd>{" "}
                    - Redo
                  </p>
                  <p>
                    <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                      L
                    </kbd>{" "}
                    - Lock/Unlock |{" "}
                    <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                      F
                    </kbd>{" "}
                    - Focus selected
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>

      {/* Connection Dialog */}
      <Dialog
        open={connectionDialog.isOpen}
        onOpenChange={(open) =>
          setConnectionDialog({ ...connectionDialog, isOpen: open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Connection</DialogTitle>
            <DialogDescription>
              Connected {connectionDialog.sourceNode?.data.label} to{" "}
              {connectionDialog.targetNode?.data.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nodeName">Target Node Name (Optional)</Label>
              <Input
                id="nodeName"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder={connectionDialog.targetNode?.data.label}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectionDialog({ isOpen: false })}
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                if (newNodeName && connectionDialog.targetNode) {
                  setNodes((nodes) =>
                    nodes.map((n) =>
                      n.id === connectionDialog.targetNode!.id
                        ? { ...n, data: { ...n.data, label: newNodeName } }
                        : n
                    )
                  );
                }
                setConnectionDialog({ isOpen: false });
                setNewNodeName("");
              }}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edge Context Menu */}
      {edgeContextMenu.isOpen && edgeContextMenu.edge && (
        <div
          className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-2 min-w-48"
          style={{
            left: edgeContextMenu.x,
            top: edgeContextMenu.y,
            transform: "translate(-50%, -10px)",
          }}
          onMouseLeave={() => setEdgeContextMenu({ isOpen: false, x: 0, y: 0 })}
        >
          <div className="text-sm font-medium text-foreground mb-2 px-2">
            Switch Connector
          </div>
          <div className="space-y-1">
            {Object.entries(CONNECTOR_TYPES).map(([type, config]) => {
              const sourceNode = nodes.find(
                (n) => n.id === edgeContextMenu.edge?.source
              );
              const targetNode = nodes.find(
                (n) => n.id === edgeContextMenu.edge?.target
              );
              const isValid =
                sourceNode &&
                targetNode &&
                validateConnector(type, sourceNode, targetNode);
              const isCurrent =
                edgeContextMenu.edge?.data?.connectorType === type;

              return (
                <button
                  key={type}
                  onClick={() =>
                    switchConnectorType(edgeContextMenu.edge!, type)
                  }
                  disabled={!isValid || isCurrent}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    isCurrent
                      ? "bg-primary/20 text-primary cursor-default"
                      : isValid
                      ? "hover:bg-muted text-foreground"
                      : "text-muted-foreground cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{config.label}</span>
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        backgroundColor:
                          config.color === "source" && sourceNode
                            ? getSourceNodeColor(sourceNode)
                            : config.color,
                        borderColor:
                          config.color === "source" && sourceNode
                            ? getSourceNodeColor(sourceNode)
                            : config.color,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Block Recommendations Panel */}
      {showRecommendations && currentRecommendations.length > 0 && (
        <BlockRecommendationPanel
          recommendations={currentRecommendations}
          onAddBlock={handleAddRecommendedBlock}
          onDismiss={handleDismissRecommendations}
        />
      )}
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
