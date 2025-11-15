"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  isAuthenticated,
  getUserFromToken,
  logout,
  authenticatedFetch,
  type User,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Grid3X3,
  Bell,
  Archive,
  Home,
  FolderOpen,
  Layout,
  Sparkles,
  Play,
  LogOut,
  Wand2,
  MoreHorizontal,
  ExternalLink,
  ShoppingBag,
  Briefcase,
  BarChart3,
  FileText,
  Smartphone,
  Eye,
  Edit,
  RotateCcw,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import RenameModal from "@/components/rename-modal";

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("apps"); // Default to apps as requested
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notifications, setNotifications] = useState(3);
  const [activeNavItem, setActiveNavItem] = useState("home");
  const [showPanel, setShowPanel] = useState(false);
  const [backendApps, setBackendApps] = useState<any[]>([]);
  const [archivedApps, setArchivedApps] = useState<any[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [backendTemplates, setBackendTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    app: any;
  }>({ show: false, x: 0, y: 0, app: null });
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);
  const [pendingAppName, setPendingAppName] = useState<string>("");
  const [renameShouldNavigate, setRenameShouldNavigate] = useState(false);

  // Authentication check and user loading
  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.push("/");
        return;
      }

      const userData = getUserFromToken();
      if (!userData) {
        router.push("/");
        return;
      }

      setUser(userData);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  // Fetch apps from backend
  const fetchApps = async (search?: string) => {
    if (!user) return;

    setIsLoadingApps(true);
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await authenticatedFetch(
        `/api/apps?page=1&limit=50${searchParam}`
      );
      const data = await response.json();

      if (data.success) {
        const allApps = data.data.apps || [];
        // Separate active and archived apps
        const activeApps = allApps.filter((app: any) => !app.archived);
        const archivedApps = allApps.filter((app: any) => app.archived);

        setBackendApps(activeApps);
        setArchivedApps(archivedApps);
        console.log(
          "✅ Apps loaded from backend:",
          activeApps.length,
          "active,",
          archivedApps.length,
          "archived"
        );
      } else {
        console.error("❌ Failed to fetch apps:", data.message);
      }
    } catch (error) {
      console.error("❌ Error fetching apps:", error);
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Fetch templates from backend
  const fetchTemplates = async (search?: string) => {
    if (!user) return;

    setIsLoadingTemplates(true);
    try {
      const searchParam = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await authenticatedFetch(`/api/templates${searchParam}`);
      const data = await response.json();

      if (data.success) {
        setBackendTemplates(data.data.templates || []);
        console.log(
          "✅ Templates loaded from backend:",
          data.data.templates?.length || 0
        );
      } else {
        console.error("❌ Failed to fetch templates:", data.message);
      }
    } catch (error) {
      console.error("❌ Error fetching templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (!user) return; // Wait for user to be loaded

    fetchApps(); // Fetch from backend
    fetchTemplates(); // Fetch templates from backend
  }, [user]);

  // Handle clicking outside context menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu.show) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [contextMenu.show]);

  const navItems = [
    { id: "create", icon: Plus, label: "Create", hasNotification: false },
    { id: "home", icon: Home, label: "Home", hasNotification: false },
    {
      id: "projects",
      icon: FolderOpen,
      label: "Projects",
      hasNotification: false,
    },
    {
      id: "templates",
      icon: Layout,
      label: "Templates",
      hasNotification: false,
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Notifications",
      hasNotification: true,
    },
    { id: "archive", icon: Archive, label: "Archive", hasNotification: false },
    { id: "sop", icon: Play, label: "SOP Videos", hasNotification: false },
  ];

  const handleNavClick = async (itemId: string) => {
    if (itemId === "create") {
      // Create a new app first, then navigate to canvas
      await handleNewApp();
      return;
    }

    setActiveNavItem(itemId);
    if (itemId !== "home" && itemId !== "create") {
      setShowPanel(true);
    } else {
      setShowPanel(false);
    }
  };

  const handleSOPVideoClick = () => {
    // Open SOP video in new tab or modal
    window.open("https://example.com/sop-videos", "_blank");
  };

  const handleNewApp = async () => {
    try {
      const response = await authenticatedFetch("/api/apps", {
        method: "POST",
        body: JSON.stringify({
          name: "Untitled App",
          description: "A new FloNeo application",
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ New app created:", data.data.app);

        // Refresh apps list to show the new app
        fetchApps();

        // Open rename modal so user can change the name before entering canvas
        setPendingAppId(data.data.app.id);
        setPendingAppName(data.data.app.name || "Untitled App");
        setRenameShouldNavigate(true);
        setRenameOpen(true);
      } else {
        console.error("❌ Failed to create app:", data.message);
        alert("Failed to create new app. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error creating app:", error);
      alert("Failed to create new app. Please try again.");
    }
  };

  const handleOpenApp = (app: any) => {
    // All apps are now backend apps - navigate with app ID
    router.push(`/canvas?appId=${app.id}`);
  };

  const handleArchiveApp = async (app: any) => {
    try {
      const response = await authenticatedFetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();

      if (data.success) {
        console.log("✅ App archived:", app.name);
        toast({
          title: "Success",
          description: `App "${app.name}" has been archived.`,
        });
        // Refresh apps list
        fetchApps();
      } else {
        console.error("❌ Failed to archive app:", data.message);
        toast({
          title: "Error",
          description: "Failed to archive app. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error archiving app:", error);
      toast({
        title: "Error",
        description: "Failed to archive app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreApp = async (app: any) => {
    try {
      const response = await authenticatedFetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      });
      const data = await response.json();

      if (data.success) {
        console.log("✅ App restored:", app.name);
        toast({
          title: "Success",
          description: `App "${app.name}" has been restored.`,
        });
        // Refresh apps list
        fetchApps();
      } else {
        console.error("❌ Failed to restore app:", data.message);
        toast({
          title: "Error",
          description: "Failed to restore app. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error restoring app:", error);
      toast({
        title: "Error",
        description: "Failed to restore app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteApp = async (app: any) => {
    setAppToDelete(app);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteApp = async () => {
    if (!appToDelete) return;

    try {
      const response = await authenticatedFetch(`/api/apps/${appToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        console.log(`✅ App ${appToDelete.id} deleted`);
        toast({
          title: "Success",
          description: `App "${appToDelete.name}" has been deleted.`,
        });
        // Refresh apps list
        fetchApps();
      } else {
        console.error("❌ Failed to delete app:", data.message);
        toast({
          title: "Error",
          description: "Failed to delete app. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error deleting app:", error);
      toast({
        title: "Error",
        description: "Failed to delete app. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAppToDelete(null);
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, app: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      app: app,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, app: null });
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu.app) return;

    if (action === "delete") {
      handleDeleteApp(contextMenu.app);
    } else if (action === "archive") {
      handleArchiveApp(contextMenu.app);
    } else if (action === "rename") {
      // Open rename modal for the context menu app (do not navigate)
      setPendingAppId(contextMenu.app.id);
      setPendingAppName(contextMenu.app.name || "");
      setRenameShouldNavigate(false);
      setRenameOpen(true);
    }

    handleCloseContextMenu();
  };

  const handleCreateFromTemplate = async (template: any) => {
    try {
      const response = await authenticatedFetch("/api/apps", {
        method: "POST",
        body: JSON.stringify({
          name: `${template.name} App`,
          description: `App created from ${template.name} template`,
          templateId: template.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ App created from template:", data.data.app);

        // Refresh apps list
        fetchApps();

        // Navigate to canvas with app ID and template ID
        router.push(
          `/canvas?appId=${data.data.app.id}&templateId=${template.id}`
        );
      } else {
        console.error("❌ Failed to create app from template:", data.message);
        toast({
          title: "Error",
          description: "Failed to create app from template. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error creating app from template:", error);
      toast({
        title: "Error",
        description: "Failed to create app from template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewTemplate = async (template: any) => {
    try {
      const response = await authenticatedFetch(
        `/api/templates/${template.id}`
      );
      const data = await response.json();

      if (data.success) {
        setPreviewTemplate(data.data.template);
        setShowTemplatePreview(true);
      } else {
        console.error("❌ Failed to fetch template details:", data.message);
        toast({
          title: "Error",
          description: "Failed to load template preview. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error fetching template details:", error);
      toast({
        title: "Error",
        description: "Failed to load template preview. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  // Removed hardcoded appData - only showing user-created apps from backend and localStorage

  // Search handler with debouncing
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      if (activeTab === "apps") {
        fetchApps(query);
      } else if (activeTab === "templates") {
        fetchTemplates(query);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Removed hardcoded templateData - only showing backend templates

  const renderPanel = () => {
    if (!showPanel) return null;

    const panelContent = {
      projects: {
        title: "Projects",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Recent Projects
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/20 dark:bg-gray-700/50 border-white/30 dark:border-gray-600/50 text-gray-700 dark:text-gray-200 hover:bg-white/30 dark:hover:bg-gray-600/50"
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/30 dark:bg-gray-700/50 backdrop-blur-sm border border-white/40 dark:border-gray-600/50 hover:bg-white/40 dark:hover:bg-gray-600/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand-blue)] shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        Project {i}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Updated 2 hours ago
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      templates: {
        title: "Templates",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Popular Templates
              </h3>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-32 text-sm bg-white/20 border-white/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {backendTemplates.slice(0, 4).map((template) => (
                <div
                  key={template.id}
                  className="aspect-square rounded-xl bg-white/30 backdrop-blur-sm border border-white/40 p-3 flex flex-col items-center justify-center shadow-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-medium text-gray-800 text-center">
                    {template.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      notifications: {
        title: "Notifications",
        content: (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/30 backdrop-blur-sm border border-white/40"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      New update available
                    </p>
                    <p className="text-xs text-gray-600">2 minutes ago</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      archive: {
        title: "Archived Apps",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Archived Apps
              </h3>
              <span className="text-xs text-gray-500">
                {archivedApps?.length || 0} apps
              </span>
            </div>

            {isLoadingApps ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            ) : archivedApps && archivedApps.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {archivedApps.map((app) => (
                  <div
                    key={`sidebar-archived-${app.id}`}
                    className="p-3 rounded-xl bg-white/30 backdrop-blur-sm border border-white/40 hover:bg-white/40 transition-all cursor-pointer"
                    onClick={() => handleOpenApp(app)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center shadow-lg flex-shrink-0">
                        <Archive className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {app.name}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {app.description || "Archived app"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Updated {formatDate(app.updatedAt || app.createdAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreApp(app);
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Archive className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">No archived apps</p>
                <p className="text-xs text-gray-500">
                  Apps you archive will appear here
                </p>
              </div>
            )}
          </div>
        ),
      },
      sop: {
        title: "SOP Videos",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Training Videos
              </h3>
              <Button size="sm" className="bg-blue-500 text-white shadow-lg">
                <ExternalLink className="w-3 h-3 mr-1" />
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/30 backdrop-blur-sm border border-white/40 hover:bg-white/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        SOP Video {i}
                      </p>
                      <p className="text-xs text-gray-600">Duration: 5:30</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    };

    const currentPanel =
      panelContent[activeNavItem as keyof typeof panelContent];
    if (!currentPanel) return null;

    return (
      <div className="fixed left-4 top-4 bottom-4 w-80 bg-white/15 dark:bg-gray-800/50 backdrop-blur-xl border border-white/25 dark:border-gray-700/50 rounded-2xl p-6 z-40 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {currentPanel.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPanel(false)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg"
          >
            ×
          </Button>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
          {currentPanel.content}
        </div>
      </div>
    );
  };

  const getHeaderText = () => {
    const navItem = navItems.find((item) => item.id === activeNavItem);
    return navItem ? navItem.label : "Home";
  };

  const handleProjectStatus = async (app: any) => {
    try {
      const response = await authenticatedFetch(`/api/apps/${app.id}/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        alert(`Project Status: ${data.data.app.status || "Draft"}`);
      } else {
        alert(data.message || "Failed to get project status");
      }
    } catch (error) {
      console.error("Project status error:", error);
      alert("Failed to get project status. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even if backend call fails
      router.push("/");
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="homepage-container min-h-screen bg-gradient-to-br from-blue-50 via-purple-25 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 font-['Poppins'] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container min-h-screen bg-gradient-to-br from-blue-50 via-purple-25 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 font-['Poppins']">
      <div className="fixed top-0 left-0 right-0 z-30 bg-white/15 dark:bg-gray-900/50 backdrop-blur-xl border-b border-white/25 dark:border-gray-700/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Image
              src="/floneo-logo.png"
              alt="Floneo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {getHeaderText()}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Welcome, {user?.email}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800 hover:bg-white/20 rounded-lg dark:text-gray-300 dark:hover:text-gray-100"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed right-4 top-4 bottom-4 w-20 bg-white/15 dark:bg-gray-800/50 backdrop-blur-xl border border-white/25 dark:border-gray-700/50 rounded-2xl z-50 flex flex-col items-center py-2 shadow-2xl">
        <div className="mb-2 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-gray-700/50 backdrop-blur-sm border border-white/30 dark:border-gray-600/50 shadow-lg overflow-hidden mb-1">
            <Image
              src="/floneo-logo.png"
              alt="Profile"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 text-center font-medium">
            Profile
          </p>
        </div>

        <div className="space-y-2 flex-1 flex flex-col items-center justify-center">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeNavItem === item.id;
            return (
              <div
                key={item.id}
                className="relative group flex flex-col items-center"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-10 h-10 rounded-full transition-all duration-300 shadow-md relative ${
                    isActive
                      ? "bg-[var(--brand-blue)] text-white dark:text-white shadow-lg"
                      : "bg-white/20 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-600/50 hover:text-gray-800 dark:hover:text-gray-100 hover:shadow-md"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.hasNotification && notifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 bg-[var(--brand-pink)] text-white dark:text-white text-xs flex items-center justify-center shadow-lg">
                      {notifications}
                    </Badge>
                  )}
                </Button>
                <p className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1 font-medium">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mb-2 flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavClick("archive")}
            className={`w-10 h-10 rounded-full transition-all duration-300 shadow-md ${
              activeNavItem === "archive"
                ? "bg-[var(--brand-blue)] text-white dark:text-white shadow-lg"
                : "bg-white/20 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-600/50 hover:text-gray-800 dark:hover:text-gray-100 hover:shadow-md"
            }`}
          >
            <Archive className="w-4 h-4" />
          </Button>
          <p className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1 font-medium">
            Archive
          </p>
        </div>

        <div className="mb-2 flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavClick("sop")}
            className={`w-10 h-10 rounded-full transition-all duration-300 shadow-md ${
              activeNavItem === "sop"
                ? "bg-[var(--brand-blue)] text-white dark:text-white shadow-lg"
                : "bg-white/20 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-600/50 hover:text-gray-800 dark:hover:text-gray-100 hover:shadow-md"
            }`}
          >
            <Play className="w-4 h-4" />
          </Button>
          <p className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1 font-medium">
            SOP Videos
          </p>
        </div>

        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-10 h-10 rounded-full bg-red-50/20 dark:bg-[var(--brand-pink)]/20 text-[var(--brand-pink)] dark:text-[var(--brand-pink)] hover:bg-red-100/30 dark:hover:bg-[var(--brand-pink)]/30 hover:text-red-600 dark:hover:text-[var(--brand-pink)] transition-all duration-300 shadow-md"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {renderPanel()}

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          showPanel ? "mr-24 ml-96" : "mr-24"
        } pt-24 p-6`}
      >
        {/* Show archived apps main view when archive is selected */}
        {activeNavItem === "archive" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">
                Archived Apps
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {archivedApps?.length || 0} archived apps
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Show loading state */}
              {isLoadingApps && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-gray-600">
                    Loading archived apps...
                  </span>
                </div>
              )}

              {/* Display archived apps */}
              {archivedApps?.map((app) => (
                <Card
                  key={`main-archived-${app.id}`}
                  className="group relative overflow-hidden bg-white/30 backdrop-blur-sm border border-white/40 hover:bg-white/40 hover:shadow-xl transition-all duration-300 cursor-pointer rounded-2xl"
                  onClick={() => handleOpenApp(app)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
                        <Archive className="w-6 h-6 text-white" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreApp(app);
                            }}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-2 truncate">
                      {app.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {app.description || "Archived application"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Archived</span>
                      <span>
                        Updated {formatDate(app.updatedAt || app.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Empty state for archived apps */}
              {!isLoadingApps &&
                (!archivedApps || archivedApps.length === 0) && (
                  <div className="col-span-full text-center py-12">
                    <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      No Archived Apps
                    </h3>
                    <p className="text-gray-500">
                      Apps you archive will appear here. You can restore them
                      anytime.
                    </p>
                  </div>
                )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="relative mb-6">
                <div className="bg-white/25 dark:bg-gray-800/50 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <Search className="text-gray-500 dark:text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Search apps, templates, and more..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="border-0 bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 text-base"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {[
                  { id: "apps", label: "Your Apps", icon: Grid3X3 },
                  { id: "templates", label: "Templates", icon: Layout },
                  { id: "floneo", label: "FloNeo AI", icon: Sparkles },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      onClick={() => setActiveTab(tab.id)}
                      className={`h-12 px-6 rounded-xl transition-all duration-300 shadow-lg ${
                        activeTab === tab.id
                          ? tab.id === "floneo"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white dark:text-white shadow-xl border-2 border-white/30 dark:border-gray-600/50"
                            : "bg-[var(--brand-blue)] text-white dark:text-white shadow-xl"
                          : "bg-white/20 dark:bg-gray-700/50 backdrop-blur-sm border border-white/30 dark:border-gray-600/50 text-gray-700 dark:text-gray-200 hover:bg-white/30 dark:hover:bg-gray-600/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Content based on active tab */}
        {activeTab === "apps" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                Your Apps
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {backendApps?.length || 0} apps
                </span>
                <Button
                  onClick={handleNewApp}
                  className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/90 text-white dark:text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New App
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Show loading state */}
              {isLoadingApps && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-blue)] mr-3"></div>
                  <span className="text-gray-600 dark:text-gray-300">
                    Loading apps...
                  </span>
                </div>
              )}

              {/* Display backend apps */}
              {backendApps?.map((app) => (
                <Card
                  key={`backend-${app.id}`}
                  className={`backdrop-blur-xl border transition-all duration-300 rounded-2xl shadow-xl hover:shadow-2xl overflow-hidden cursor-pointer ${
                    selectedApp?.id === app.id
                      ? "bg-blue-100/40 dark:bg-blue-900/30 border-blue-400/50 dark:border-blue-500/50"
                      : "bg-white/25 dark:bg-gray-800/50 border-white/30 dark:border-gray-700/50 hover:bg-white/35 dark:hover:bg-gray-700/50"
                  }`}
                  onClick={() => handleOpenApp(app)}
                  onContextMenu={(e) => handleContextMenu(e, app)}
                >
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 flex items-center justify-center relative">
                    <Badge className="absolute top-3 left-3 bg-[var(--brand-blue)] text-white dark:text-white text-xs">
                      {app.status || "Draft"}
                    </Badge>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <Smartphone className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                        {app.name}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingAppId(app.id);
                              setPendingAppName(app.name || "");
                              setRenameShouldNavigate(false);
                              setRenameOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <hr />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveApp(app);
                            }}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteApp(app);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {app.description || "Backend app"}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      >
                        Backend
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                      >
                        Canvas
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Updated {formatDate(app.updatedAt || app.createdAt)}
                      </span>
                      <span>Click to edit</span>
                    </div>
                  </CardContent>
                </Card>
              )) || []}

              {/* Hardcoded apps removed - only showing user-created apps */}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Templates</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {backendTemplates.length} templates
                </span>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-40 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="content">Content</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Show loading state */}
              {isLoadingTemplates && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-gray-600">Loading templates...</span>
                </div>
              )}

              {/* Display backend templates */}
              {backendTemplates?.map((template) => (
                <Card
                  key={`backend-template-${template.id}`}
                  className="bg-white/25 backdrop-blur-xl border border-white/30 hover:bg-white/35 transition-all duration-300 rounded-2xl shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center relative">
                    <Badge className="absolute top-3 left-3 bg-purple-500 text-white text-xs">
                      {template.category || "Template"}
                    </Badge>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-2xl">
                        {template.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {template.name}
                      </h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:bg-white/20 rounded-lg"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {template.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-purple-100 text-purple-700"
                      >
                        Backend
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gray-100 text-gray-700"
                      >
                        {template.category || "General"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTemplate(template);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Template
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-purple-600 hover:bg-purple-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateFromTemplate(template);
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) || []}

              {/* Hardcoded templates removed - only showing backend templates */}
            </div>
          </div>
        )}

        {activeTab === "floneo" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">FloNeo AI</h2>
              <Button
                onClick={handleNewApp}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                New AI Project
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card
                  key={i}
                  className="bg-white/25 backdrop-blur-xl border border-white/30 hover:bg-white/35 transition-all duration-300 rounded-2xl shadow-xl hover:shadow-2xl"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center shadow-lg">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800">
                            AI Project {i}
                          </h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 hover:bg-white/20 rounded-lg"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600">
                          Generated 1 hour ago
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-4">
                      AI-powered solution for automating your business
                      processes.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-white/20 border-white/30 text-gray-700"
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-purple-600 text-white shadow-lg"
                      >
                        Continue
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center mb-4">
              {previewTemplate?.name || "Template Preview"}
            </DialogTitle>
          </DialogHeader>

          {previewTemplate && previewTemplate.structure && (
            <div className="bg-white rounded-lg p-6 border">
              <div className="text-center mb-6">
                <h2
                  className="text-2xl font-bold text-gray-800 mb-2"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  {previewTemplate.name}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Your First Name
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        placeholder="Enter your first name"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Gender
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <select
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      >
                        <option>Select gender</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Contact Number
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        placeholder="+91 Enter your contact number"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Education Qualification
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <select
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      >
                        <option>Select qualification</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Annual Income
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        placeholder="Enter annual income"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      State
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <select
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      >
                        <option>Select state</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Communication Preferences:
                    </label>
                    <div className="space-y-2">
                      <label
                        className="flex items-center text-sm text-gray-700"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        <input type="checkbox" className="mr-2" disabled />
                        SMS/Call/Email
                      </label>
                      <label
                        className="flex items-center text-sm text-gray-700"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        <input type="checkbox" className="mr-2" disabled />
                        WhatsApp
                      </label>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Your Last Name (Optional)
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        placeholder="Enter your last name"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Your Date of Birth
                    </label>
                    <div className="border-b border-gray-300 pb-1 flex items-center">
                      <input
                        type="text"
                        placeholder="Select date of birth"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                      <span className="text-gray-400 ml-2">📅</span>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Email ID
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Occupation
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <select
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      >
                        <option>Select occupation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Do you use Tobacco?
                    </label>
                    <div className="flex gap-4">
                      <label
                        className="flex items-center text-sm text-gray-700"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        <input
                          type="radio"
                          name="tobacco"
                          className="mr-2"
                          disabled
                        />
                        Yes
                      </label>
                      <label
                        className="flex items-center text-sm text-gray-700"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        <input
                          type="radio"
                          name="tobacco"
                          className="mr-2"
                          checked
                          disabled
                        />
                        No
                      </label>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      City
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <select
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      >
                        <option>Select city</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      Pin/Zip Code
                    </label>
                    <div className="border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        placeholder="Enter pin/zip code"
                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center mt-8">
                <button
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-full text-sm shadow-lg"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                  disabled
                >
                  Calculate Premium
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowTemplatePreview(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowTemplatePreview(false);
                if (previewTemplate) {
                  handleCreateFromTemplate(previewTemplate);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Use This Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => handleContextMenuAction("archive")}
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => handleContextMenuAction("rename")}
          >
            <Edit className="w-4 h-4" />
            Rename
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            onClick={() => handleContextMenuAction("delete")}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this app?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the app
              {appToDelete && ` "${appToDelete.name}"`} and all of its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAppToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteApp}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename modal shown after creating a new app so the user can immediately change name */}
      <RenameModal
        isOpen={renameOpen}
        onClose={() => {
          setRenameOpen(false);
          if (pendingAppId) {
            const id = pendingAppId;
            setPendingAppId(null);
            setPendingAppName("");
            if (renameShouldNavigate) {
              setRenameShouldNavigate(false);
              router.push(`/canvas?appId=${id}`);
            } else {
              // just refresh apps list
              fetchApps();
            }
          }
        }}
        appId={pendingAppId}
        currentName={pendingAppName}
        onSaved={(newName) => {
          // After saving, close modal. Navigate only if this rename was for a newly created app.
          const id = pendingAppId;
          setRenameOpen(false);
          setPendingAppId(null);
          setPendingAppName("");
          if (!id) return;
          if (renameShouldNavigate) {
            setRenameShouldNavigate(false);
            router.push(`/canvas?appId=${id}`);
          } else {
            fetchApps();
          }
        }}
      />
    </div>
  );
}
