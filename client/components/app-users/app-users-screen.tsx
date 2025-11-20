"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { initializeSocket, getSocket } from "@/lib/socket";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  RefreshCw,
  Search,
  ArrowLeft,
  Plus,
  Edit,
  Trash,
  Key,
  Eye,
  EyeOff,
  Shield,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface AppUser {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  roles: Array<{
    appRole: {
      id: number;
      name: string;
      slug: string;
    };
  }>;
  pageAccess: Array<{
    page: {
      id: number;
      slug: string;
      title: string;
    };
  }>;
}

export function AppUsersScreen() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPageAccessModal, setShowPageAccessModal] = useState(false);
  
  // Page access state
  const [availablePages, setAvailablePages] = useState<Array<{id: number; title: string; slug: string}>>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([]);
  const [savingPageAccess, setSavingPageAccess] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    email: "",
    name: "",
    isActive: true,
    roleSlug: "",
  });
  
  // Reset password form
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = searchParams.get("appId");
  const appName = searchParams.get("appName") || "Unknown App";
  const { toast } = useToast();

  const loadUsers = useCallback(async () => {
    if (!appId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/app-users/app/${appId}/list`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load users");
      }

      setUsers(data.users || []);
    } catch (err) {
      console.error("❌ [APP-USERS] Error loading users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [appId, toast]);

  // Real-time updates via Socket.io - Using window events (same pattern as database screen)
  useEffect(() => {
    if (!appId) return;

    // Ensure socket is initialized and join room
    let socket = getSocket();
    if (!socket || !socket.connected) {
      try {
        socket = initializeSocket();
      } catch (error) {
        console.warn("⚠️ [APP-USERS] Could not initialize socket:", error);
        return;
      }
    }

    if (!socket) return;

    // Join app room for receiving events
    const joinRoom = () => {
      if (socket && socket.connected) {
        socket.emit("database:join-app", Number(appId));
        console.log(`✅ [APP-USERS] Joined app room: ${appId}`);
      }
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_DELAY = 100; // Reduced to 100ms for faster updates

    // Handle app user events via window events (dispatched by socket.ts)
    const handleUserCreated = (event: CustomEvent) => {
      const data = event.detail;
      console.log("🟢 [APP-USERS] Window event received (created):", data);
      if (data.appId?.toString() === appId) {
        console.log("🟢 [APP-USERS] User created event matched appId:", appId);
        if (debounceTimer) clearTimeout(debounceTimer);
        // Call loadUsers immediately, then show toast
        loadUsers();
        debounceTimer = setTimeout(() => {
          toast({
            title: "User Created",
            description: `User ${data.user?.email || "new user"} has been created.`,
          });
        }, 50);
      } else {
        console.log("⚠️ [APP-USERS] Event appId mismatch:", data.appId, "!=", appId);
      }
    };

    const handleUserUpdated = (event: CustomEvent) => {
      const data = event.detail;
      console.log("🟢 [APP-USERS] Window event received (updated):", data);
      if (data.appId?.toString() === appId) {
        console.log("🟢 [APP-USERS] User updated event matched appId:", appId);
        if (debounceTimer) clearTimeout(debounceTimer);
        // Call loadUsers immediately, then show toast
        loadUsers();
        debounceTimer = setTimeout(() => {
          toast({
            title: "User Updated",
            description: `User ${data.user?.email || "user"} has been updated.`,
          });
        }, 50);
      } else {
        console.log("⚠️ [APP-USERS] Event appId mismatch:", data.appId, "!=", appId);
      }
    };

    const handleUserDeleted = (event: CustomEvent) => {
      const data = event.detail;
      console.log("🟢 [APP-USERS] Window event received (deleted):", data);
      if (data.appId?.toString() === appId) {
        console.log("🟢 [APP-USERS] User deleted event matched appId:", appId);
        if (debounceTimer) clearTimeout(debounceTimer);
        // Call loadUsers immediately, then show toast
        loadUsers();
        debounceTimer = setTimeout(() => {
          toast({
            title: "User Deleted",
            description: `User ${data.email || "user"} has been deleted.`,
          });
        }, 50);
      } else {
        console.log("⚠️ [APP-USERS] Event appId mismatch:", data.appId, "!=", appId);
      }
    };

    // Attach window event listeners
    window.addEventListener("app_user_created", handleUserCreated as EventListener);
    window.addEventListener("app_user_updated", handleUserUpdated as EventListener);
    window.addEventListener("app_user_deleted", handleUserDeleted as EventListener);

    // Cleanup
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("app_user_created", handleUserCreated as EventListener);
      window.removeEventListener("app_user_updated", handleUserUpdated as EventListener);
      window.removeEventListener("app_user_deleted", handleUserDeleted as EventListener);
      if (socket && socket.connected) {
        socket.emit("database:leave-app", Number(appId));
      }
    };
  }, [appId, loadUsers, toast]);

  // Load users on mount and when appId changes
  useEffect(() => {
    if (appId) {
      loadUsers();
    }
  }, [appId, loadUsers]);

  const handleEdit = (user: AppUser) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      name: user.name || "",
      isActive: user.isActive,
      roleSlug: user.roles[0]?.appRole.slug || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    setEditing(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/app-users/user/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update user");
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setShowEditModal(false);
      await loadUsers();
    } catch (err) {
      console.error("❌ [APP-USERS] Error updating user:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setEditing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setResetting(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/app-users/user/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      toast({
        title: "Success",
        description: "Password reset successfully",
      });

      setShowResetPasswordModal(false);
      setNewPassword("");
    } catch (err) {
      console.error("❌ [APP-USERS] Error resetting password:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleEditPageAccess = async (user: AppUser) => {
    setSelectedUser(user);
    
    // Load available pages for this app
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const pagesResponse = await fetch(`/api/pages/${appId}/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const pagesData = await pagesResponse.json();
      if (pagesData.success) {
        setAvailablePages(pagesData.pages || []);
      }

      // Set currently selected page IDs
      setSelectedPageIds(user.pageAccess.map(pa => pa.page.id));
      setShowPageAccessModal(true);
    } catch (err) {
      console.error("❌ [APP-USERS] Error loading pages:", err);
      toast({
        title: "Error",
        description: "Failed to load pages",
        variant: "destructive",
      });
    }
  };

  const handleSavePageAccess = async () => {
    if (!selectedUser || !appId) return;

    setSavingPageAccess(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/pages/${appId}/assign/${selectedUser.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageIds: selectedPageIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update page access");
      }

      toast({
        title: "Success",
        description: "Page access updated successfully",
      });

      setShowPageAccessModal(false);
      await loadUsers();
    } catch (err) {
      console.error("❌ [APP-USERS] Error updating page access:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update page access",
        variant: "destructive",
      });
    } finally {
      setSavingPageAccess(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/app-users/user/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setShowDeleteModal(false);
      await loadUsers();
    } catch (err) {
      console.error("❌ [APP-USERS] Error deleting user:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.name && user.name.toLowerCase().includes(query)) ||
      user.roles.some((r) => r.appRole.name.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Navigation Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="px-6 py-4">
          {/* Back Button & Breadcrumbs */}
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Apps</span>
              <span>/</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {appName}
              </span>
              <span>/</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                App Users
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 responsive-text-2xl">
                    App Users Management
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 responsive-text-sm">
                    Manage users, roles, and access for {appName}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadUsers} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search users by email, name, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 responsive-p-6">
        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Users Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery
                  ? "No users match your search criteria"
                  : "No users have been created for this app yet. Users will appear here after they are created via the RoleIs workflow block."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Page Access</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role.appRole.id} variant="outline">
                                <Shield className="w-3 h-3 mr-1" />
                                {role.appRole.name}
                              </Badge>
                            ))}
                            {user.roles.length === 0 && (
                              <span className="text-gray-400 text-sm">No role</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.pageAccess.slice(0, 2).map((access) => (
                              <Badge key={access.page.id} variant="secondary" className="text-xs">
                                {access.page.title || access.page.slug}
                              </Badge>
                            ))}
                            {user.pageAccess.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{user.pageAccess.length - 2} more
                              </Badge>
                            )}
                            {user.pageAccess.length === 0 && (
                              <span className="text-gray-400 text-sm">No access</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isActive ? "default" : "secondary"}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPageAccess(user)}
                              title="Edit page access"
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetPasswordModal(true);
                              }}
                              title="Reset password"
                            >
                              <Key className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                              }}
                              title="Delete user"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Input
                id="edit-role"
                value={editForm.roleSlug}
                onChange={(e) =>
                  setEditForm({ ...editForm, roleSlug: e.target.value })
                }
                placeholder="e.g., user, admin, manager"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isActive: checked as boolean })
                }
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editing}>
              {editing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetPasswordModal(false);
                setNewPassword("");
              }}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || !newPassword}>
              {resetting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.email}? This action
              cannot be undone and will remove all user data, roles, and access
              permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Access Modal */}
      <Dialog open={showPageAccessModal} onOpenChange={setShowPageAccessModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Page Access</DialogTitle>
            <DialogDescription>
              Manage which pages {selectedUser?.email} can access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {availablePages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No pages available for this app. Create pages first.
              </p>
            ) : (
              <div className="space-y-2">
                {availablePages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      id={`page-${page.id}`}
                      checked={selectedPageIds.includes(page.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPageIds([...selectedPageIds, page.id]);
                        } else {
                          setSelectedPageIds(
                            selectedPageIds.filter((id) => id !== page.id)
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={`page-${page.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{page.title}</div>
                      <div className="text-xs text-gray-500">{page.slug}</div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPageAccessModal(false);
                setSelectedPageIds([]);
              }}
              disabled={savingPageAccess}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePageAccess}
              disabled={savingPageAccess || availablePages.length === 0}
            >
              {savingPageAccess ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Save Access
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

