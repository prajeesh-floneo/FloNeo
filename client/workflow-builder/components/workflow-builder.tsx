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

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";



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
  mode,
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

  // When collapsed, show a thin rail
  if (!isOpen) {
    return (
      <div
        className={cx(
          "flex items-center justify-center bg-muted/40 hover:bg-muted/60 transition-colors border-l border-border",
          isHorizontal ? "h-8 w-full" : "w-12 h-full"
        )}
      >
        <button
          onClick={onToggle}
          className="group inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Expand panel"
        >
          <ArrowRightIcon
            className={cx(
              "h-4 w-4 transition-transform",
              !isHorizontal && "rotate-180 group-hover:translate-x-0.5"
            )}
          />
        </button>
      </div>
    );
  }

  // When open, show full panel
  return (
    <div className="w-96 flex flex-col bg-card/30">
      {/* Header with tabs and close button */}
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
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
        </button>
      </div>

      {/* Filters - only show for blocks tab */}
      {rightPanelTab === "blocks" && (
        <div className="p-4 border-b border-border">
          <FilterPanel filters={filters} onFiltersChange={setFilters} />
        </div>
      )}

      {/* Content area - takes remaining height and scrolls */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === "blocks" ? (
          <BlockLibrary filters={filters} />
        ) : (
          <TemplateLibrary />
        )}
      </div>
    </div>
  );
}


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


  // Status Bar --->
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

        <Button
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={handleSaveWorkflow}
        >
          <Save className="mr-1 h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </div>
  );

  // Canvas Section --->
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


  // Right Panel --->
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
    <div className="flex h-full bg-background text-foreground">
      <div className="flex flex-1 flex-col">
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
    // <CanvasWorkflowProvider>
      <WorkflowBuilderContent />
    // </CanvasWorkflowProvider>
  );
}
