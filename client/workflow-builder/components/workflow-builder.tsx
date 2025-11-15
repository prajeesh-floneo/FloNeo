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

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";


// Dynamically import Canvas component to avoid circular dependencies
const CanvasPage = dynamic(() => import("../../app/canvas/page"), {
  ssr: false,
});

function WorkflowBuilderContent() {
  // ============================================================
  //  ManageRolesModal – For Workflow Builder Internal Testing
  // ============================================================

  function ManageRolesModal({ open, onClose, appId, refreshRoles, appPages }) {
    const [roles, setRoles] = useState<string[]>([]);
    const [newRole, setNewRole] = useState("");

    const [users, setUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");

    const [selectedRole, setSelectedRole] = useState("");
    const [selectedPages, setSelectedPages] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);

    // Fetch roles
    const loadRoles = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/apps/${appId}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setRoles(data.roles || []);
      } catch (err) {
        console.error(err);
      }
    };

    // Fetch app users (owner + invited future)
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/apps/${appId}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setUsers(data.users || []);
      } catch (err) {
        console.error(err);
      }
    };

    // Fetch user's assignments when user selected
    const loadUserAssignments = async (uid) => {
      if (!uid) return;
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/apps/${appId}/user/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setSelectedRole(data.userRole || "");
          setSelectedPages(data.pageSlugs || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    useEffect(() => {
      if (open) {
        loadRoles();
        loadUsers();
      }
    }, [open]);

    useEffect(() => {
      if (selectedUserId) {
        loadUserAssignments(selectedUserId);
      }
    }, [selectedUserId]);

    // ----------------------------
    // CREATE ROLE
    // ----------------------------
    const createRole = async () => {
      if (!newRole.trim()) return;
      setLoading(true);
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/apps/${appId}/roles/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newRole.trim().toLowerCase() }),
        });

        const d = await res.json();
        if (d.success) {
          setRoles((r) => [...r, d.role.name]);
          setNewRole("");
          refreshRoles && refreshRoles();
        } else {
          alert(d.message);
        }
      } finally {
        setLoading(false);
      }
    };

    // ----------------------------
    // ASSIGN ROLE + PAGE ACCESS
    // ----------------------------
    const saveAssignments = async () => {
      if (!selectedUserId || !selectedRole) {
        alert("Select user & role");
        return;
      }
      setLoading(true);

      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/apps/${appId}/assign/${selectedUserId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roleName: selectedRole,
            pageSlugs: selectedPages,
          }),
        });

        const d = await res.json();
        if (d.success) {
          alert("User assigned successfully!");
        } else {
          alert(d.message);
        }
      } finally {
        setLoading(false);
      }
    };

    // Toggle page selection
    const togglePage = (slug) => {
      let updated = [...selectedPages];
      if (updated.includes(slug)) {
        updated = updated.filter((x) => x !== slug);
      } else {
        updated.push(slug);
      }
      setSelectedPages(updated);
    };

    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="w-[520px]">
          <DialogHeader>
            <DialogTitle>
              Manage Roles & User Access (Workflow Test Panel)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* CREATE ROLE */}
            <div className="border p-3 rounded-md">
              <div className="text-sm font-medium mb-2">Create Role</div>
              <div className="flex gap-2">
                <input
                  className="border px-2 py-1 rounded w-full"
                  placeholder="manager / accountant"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <button
                  onClick={createRole}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Add
                </button>
              </div>
            </div>

            {/* ASSIGN ROLE + PAGES */}
            <div className="border p-3 rounded-md space-y-3">
              <div className="text-sm font-medium">Assign Role to User</div>

              {/* User Dropdown */}
              <select
                className="w-full border px-2 py-1 rounded"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>

              {/* Role Dropdown */}
              <select
                className="w-full border px-2 py-1 rounded"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option value={r} key={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* Page Access */}
              <div>
                <div className="text-sm font-medium mb-1">Page Access</div>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                  {appPages.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      No pages found
                    </div>
                  ) : (
                    appPages.map((p) => (
                      <div key={p.slug} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPages.includes(p.slug)}
                          onChange={() => togglePage(p.slug)}
                        />
                        <span className="text-sm">{p.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={saveAssignments}
                className="px-3 py-1 bg-green-600 text-white rounded w-full mt-2"
                disabled={loading}
              >
                Save Assignments
              </button>
            </div>
          </div>

          <DialogFooter>
            <button onClick={onClose} className="px-3 py-1 border rounded">
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const [openRolesModal, setOpenRolesModal] = useState(false);

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
        <div className="flex h-full">
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
              variant="outline"
              size="sm"
              onClick={() => setOpenRolesModal(true)}
            >
              Manage Roles
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
      <ManageRolesModal
        open={openRolesModal}
        onClose={() => setOpenRolesModal(false)}
        appId={appId}
        appPages={pages}
        refreshRoles={() => {}}
      />
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
