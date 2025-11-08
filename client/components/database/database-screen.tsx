"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  ArrowLeft,
  Table as TableIcon,
  HardDrive,
  Plus,
  Trash,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DatabaseTable {
  name: string;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  createdAt: string;
}

export function DatabaseScreen() {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(
    null
  );
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Create Table Modal State
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableColumns, setNewTableColumns] = useState<
    Array<{
      name: string;
      type: string;
      required: boolean;
    }>
  >([
    { name: "id", type: "Number", required: true },
    { name: "Name", type: "Text", required: true },
  ]);
  const [creatingTable, setCreatingTable] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = searchParams.get("appId");
  const appName = searchParams.get("appName") || "Unknown App";
  const { toast } = useToast();

  // Load tables for the current app with auto-refresh
  useEffect(() => {
    if (!appId) {
      setError("No app ID provided");
      setLoading(false);
      return;
    }

    // Initial load
    loadTables();

    // Auto-refresh every 10 seconds to detect new tables
    const interval = setInterval(() => {
      loadTables();
    }, 10000);

    return () => clearInterval(interval);
  }, [appId]);

  const loadTables = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/database/${appId}/tables`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load tables");
      }

      setTables(data.tables || []);
      setError(null);
    } catch (err) {
      console.error("❌ [DATABASE] Error loading tables:", err);
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (table: DatabaseTable, page = 1) => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(
        `/api/database/${appId}/tables/${table.name}/data?page=${page}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load table data");
      }

      setTableData(data.data || []);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setSelectedTable(table);
    } catch (err) {
      console.error("❌ [DATABASE] Error loading table data:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to load table data",
        variant: "destructive",
      });
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table name",
        variant: "destructive",
      });
      return;
    }

    if (newTableColumns.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one column",
        variant: "destructive",
      });
      return;
    }

    // Validate column names
    const emptyColumns = newTableColumns.filter((col) => !col.name.trim());
    if (emptyColumns.length > 0) {
      toast({
        title: "Error",
        description: "All columns must have a name",
        variant: "destructive",
      });
      return;
    }

    setCreatingTable(true);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Map column types to database types
      const columnTypeMap: Record<string, string> = {
        Text: "TEXT",
        Number: "INTEGER",
        Boolean: "BOOLEAN",
        Date: "TIMESTAMP",
      };

      const columns = newTableColumns.map((col) => ({
        name: col.name.toLowerCase().replace(/\s+/g, "_"),
        type: columnTypeMap[col.type] || "TEXT",
        required: col.required,
        elementId: col.name.toLowerCase().replace(/\s+/g, "_"),
        originalName: col.name,
      }));

      const response = await fetch(`/api/database/${appId}/tables/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableName: newTableName.toLowerCase().replace(/\s+/g, "_"),
          columns,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create table");
      }

      toast({
        title: "Success",
        description: `Table "${newTableName}" created successfully`,
      });

      // Reset form
      setShowCreateTableModal(false);
      setNewTableName("");
      setNewTableColumns([
        { name: "id", type: "Number", required: true },
        { name: "Name", type: "Text", required: true },
      ]);

      // Reload tables
      loadTables();
    } catch (err) {
      console.error("❌ [DATABASE] Error creating table:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create table",
        variant: "destructive",
      });
    } finally {
      setCreatingTable(false);
    }
  };

  const addColumn = () => {
    setNewTableColumns([
      ...newTableColumns,
      { name: "", type: "Text", required: false },
    ]);
  };

  const removeColumn = (index: number) => {
    setNewTableColumns(newTableColumns.filter((_, i) => i !== index));
  };

  const updateColumn = (
    index: number,
    field: "name" | "type" | "required",
    value: string | boolean
  ) => {
    const updated = [...newTableColumns];
    updated[index] = { ...updated[index], [field]: value };
    setNewTableColumns(updated);
  };

  // Helper function to format cell values based on type
  const formatCellValue = (value: any, columnType: string) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">NULL</span>;
    }

    const type = columnType.toUpperCase();

    // Boolean values
    if (type === "BOOLEAN" || typeof value === "boolean") {
      return (
        <span className="flex items-center gap-1">
          {value ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600">True</span>
            </>
          ) : (
            <>
              <X className="w-4 h-4 text-red-600" />
              <span className="text-red-600">False</span>
            </>
          )}
        </span>
      );
    }

    // Date/Time values
    if (type.includes("DATE") || type.includes("TIME")) {
      try {
        const date = new Date(value);
        return (
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{date.toLocaleString()}</span>
          </span>
        );
      } catch {
        return String(value);
      }
    }

    // Image URLs
    if (
      type.includes("TEXT") &&
      typeof value === "string" &&
      value.startsWith("http") &&
      (value.includes(".jpg") ||
        value.includes(".png") ||
        value.includes(".gif") ||
        value.includes(".webp") ||
        value.includes(".jpeg"))
    ) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:underline"
        >
          <ImageIcon className="w-4 h-4" />
          <span className="truncate max-w-xs">View Image</span>
        </a>
      );
    }

    // Video URLs
    if (
      type.includes("TEXT") &&
      typeof value === "string" &&
      value.startsWith("http") &&
      (value.includes(".mp4") ||
        value.includes(".webm") ||
        value.includes(".mov") ||
        value.includes(".avi"))
    ) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:underline"
        >
          <Video className="w-4 h-4" />
          <span className="truncate max-w-xs">View Video</span>
        </a>
      );
    }

    // Audio URLs
    if (
      type.includes("TEXT") &&
      typeof value === "string" &&
      value.startsWith("http") &&
      (value.includes(".mp3") ||
        value.includes(".wav") ||
        value.includes(".ogg") ||
        value.includes(".m4a"))
    ) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:underline"
        >
          <Music className="w-4 h-4" />
          <span className="truncate max-w-xs">Play Audio</span>
        </a>
      );
    }

    // Long text truncation
    if (typeof value === "string" && value.length > 100) {
      return (
        <span className="truncate max-w-xs block" title={value}>
          {value.substring(0, 100)}...
        </span>
      );
    }

    // Default: convert to string
    return String(value);
  };

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnName);
      setSortDirection("asc");
    }
  };

  // Filter and sort data
  const filteredData = tableData.filter((row) => {
    if (!searchQuery) return true;
    return Object.values(row).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    const modifier = sortDirection === "asc" ? 1 : -1;
    if (aVal < bVal) return -1 * modifier;
    if (aVal > bVal) return 1 * modifier;
    return 0;
  });

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading database tables...</span>
        </div>

        {/* Create Table Modal - Must be included in early return */}
        <Dialog
          open={showCreateTableModal}
          onOpenChange={setShowCreateTableModal}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Table</DialogTitle>
              <DialogDescription>
                Define your table structure with columns and data types
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Table Name */}
              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name</Label>
                <Input
                  id="tableName"
                  placeholder="demo"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Final table: app_{appId}_
                  {newTableName.toLowerCase().replace(/\s+/g, "_")}
                </p>
              </div>

              {/* Columns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {newTableColumns.map((column, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          placeholder="Column name"
                          value={column.name}
                          onChange={(e) =>
                            updateColumn(index, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-32">
                        <Select
                          value={column.type}
                          onValueChange={(value) =>
                            updateColumn(index, "type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Text">Text</SelectItem>
                            <SelectItem value="Number">Number</SelectItem>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={column.required}
                          onCheckedChange={(checked) =>
                            updateColumn(index, "required", checked as boolean)
                          }
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(index)}
                        disabled={newTableColumns.length <= 1}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateTableModal(false)}
                disabled={creatingTable}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTable} disabled={creatingTable}>
                {creatingTable ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Table"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Database className="w-12 h-12 text-gray-400" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Database Error
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{error}</p>
          </div>
          <Button onClick={loadTables} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>

        {/* Create Table Modal - Must be included in early return */}
        <Dialog
          open={showCreateTableModal}
          onOpenChange={setShowCreateTableModal}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Table</DialogTitle>
              <DialogDescription>
                Define your table structure with columns and data types
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Table Name */}
              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name</Label>
                <Input
                  id="tableName"
                  placeholder="demo"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Final table: app_{appId}_
                  {newTableName.toLowerCase().replace(/\s+/g, "_")}
                </p>
              </div>

              {/* Columns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {newTableColumns.map((column, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          placeholder="Column name"
                          value={column.name}
                          onChange={(e) =>
                            updateColumn(index, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-32">
                        <Select
                          value={column.type}
                          onValueChange={(value) =>
                            updateColumn(index, "type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Text">Text</SelectItem>
                            <SelectItem value="Number">Number</SelectItem>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={column.required}
                          onCheckedChange={(checked) =>
                            updateColumn(index, "required", checked as boolean)
                          }
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(index)}
                        disabled={newTableColumns.length <= 1}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateTableModal(false)}
                disabled={creatingTable}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTable} disabled={creatingTable}>
                {creatingTable ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Table"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (tables.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Database className="w-12 h-12 text-gray-400" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Tables Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create your first table manually or by submitting a form with a
              db.create workflow block.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateTableModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Table
            </Button>
            <Button onClick={loadTables} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Create Table Modal - Must be included in early return */}
        <Dialog
          open={showCreateTableModal}
          onOpenChange={setShowCreateTableModal}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Table</DialogTitle>
              <DialogDescription>
                Define your table structure with columns and data types
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Table Name */}
              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name</Label>
                <Input
                  id="tableName"
                  placeholder="demo"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Final table: app_{appId}_
                  {newTableName.toLowerCase().replace(/\s+/g, "_")}
                </p>
              </div>

              {/* Columns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {newTableColumns.map((column, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          placeholder="Column name"
                          value={column.name}
                          onChange={(e) =>
                            updateColumn(index, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-32">
                        <Select
                          value={column.type}
                          onValueChange={(value) =>
                            updateColumn(index, "type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Text">Text</SelectItem>
                            <SelectItem value="Number">Number</SelectItem>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={column.required}
                          onCheckedChange={(checked) =>
                            updateColumn(index, "required", checked as boolean)
                          }
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(index)}
                        disabled={newTableColumns.length <= 1}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateTableModal(false)}
                disabled={creatingTable}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTable} disabled={creatingTable}>
                {creatingTable ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Table"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Calculate quick stats
  const totalTables = tables.length;
  const totalRows = tables.reduce((sum, table) => sum + table.rowCount, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Navigation Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
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
              <ChevronRight className="w-4 h-4" />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {appName}
              </span>
              <ChevronRight className="w-4 h-4" />
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Database
              </span>
            </div>
          </div>

          {/* Header with Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Database Management
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Manage and view your application data
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowCreateTableModal(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Table
              </Button>
              <Button onClick={loadTables} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <TableIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Tables
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {totalTables}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <HardDrive className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Rows
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {totalRows.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Active Table
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                      {selectedTable?.name || "None"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Table List */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Tables ({tables.length})
            </h2>
            <div className="space-y-2">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => loadTableData(table)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTable?.name === table.name
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium truncate">{table.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {table.rowCount} rows • {table.columns.length} columns
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Table Data */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
          {selectedTable ? (
            <>
              {/* Header */}
              <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold">{selectedTable.name}</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedTable.rowCount} total rows
                    </p>
                  </div>
                  <Button
                    onClick={() => loadTableData(selectedTable)}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search in table..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectedTable.columns.map((column) => (
                          <TableHead
                            key={column.name}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() => handleSort(column.name)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {column.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {column.type}
                              </Badge>
                              {sortColumn === column.name && (
                                <span className="text-xs">
                                  {sortDirection === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={selectedTable.columns.length}
                            className="text-center py-8 text-gray-500"
                          >
                            No data found
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedData.map((row, index) => (
                          <TableRow key={index}>
                            {selectedTable.columns.map((column) => (
                              <TableCell key={column.name}>
                                {formatCellValue(row[column.name], column.type)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() =>
                          loadTableData(selectedTable, currentPage - 1)
                        }
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          loadTableData(selectedTable, currentPage + 1)
                        }
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Database className="w-16 h-16 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Select a Table
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Choose a table from the sidebar to view its data
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Table Modal */}
      <Dialog
        open={showCreateTableModal}
        onOpenChange={setShowCreateTableModal}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>
              Define your table structure with columns and data types
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Table Name */}
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name</Label>
              <Input
                id="tableName"
                placeholder="demo"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Final table: app_{appId}_
                {newTableName.toLowerCase().replace(/\s+/g, "_")}
              </p>
            </div>

            {/* Columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addColumn}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Column
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {newTableColumns.map((column, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <Input
                        placeholder="Column name"
                        value={column.name}
                        onChange={(e) =>
                          updateColumn(index, "name", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-32">
                      <Select
                        value={column.type}
                        onValueChange={(value) =>
                          updateColumn(index, "type", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Text">Text</SelectItem>
                          <SelectItem value="Number">Number</SelectItem>
                          <SelectItem value="Boolean">Boolean</SelectItem>
                          <SelectItem value="Date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={column.required}
                        onCheckedChange={(checked) =>
                          updateColumn(index, "required", checked as boolean)
                        }
                      />
                      <Label className="text-xs">Required</Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeColumn(index)}
                      disabled={newTableColumns.length <= 1}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTableModal(false)}
              disabled={creatingTable}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTable} disabled={creatingTable}>
              {creatingTable ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
