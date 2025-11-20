"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initializeSocket, getSocket } from "@/lib/socket";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
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
  User,
} from "lucide-react";
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
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showRecordDetailsModal, setShowRecordDetailsModal] = useState(false);
  const [visibleColumnsCount, setVisibleColumnsCount] = useState(4); // Show first 4 columns by default

  // Create Table Modal State
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableColumns, setNewTableColumns] = useState<
    Array<{ name: string; type: string; required: boolean }>
  >([
    { name: "id", type: "Number", required: true },
    { name: "Name", type: "Text", required: true },
  ]);
  const [creatingTable, setCreatingTable] = useState(false);

  // Add Record Modal State
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [newRecordData, setNewRecordData] = useState<Record<string, any>>({});
  const [addingRecord, setAddingRecord] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = searchParams.get("appId");
  const appName = searchParams.get("appName") || "Unknown App";
  const { toast } = useToast();

  // ✅ Initialize socket connection and join app room
  useEffect(() => {
    if (!appId) return;

    try {
      const socket = initializeSocket();
      console.log("✅ Socket initialized for database screen:", socket.id);
      
      // Join the app room for real-time database updates
      socket.on("connect", () => {
        socket.emit("database:join-app", appId);
        console.log("🔄 Joined database room for app:", appId);
      });

      // If already connected, join immediately
      if (socket.connected) {
        socket.emit("database:join-app", appId);
        console.log("🔄 Joined database room for app (already connected):", appId);
      }
    } catch (err) {
      console.warn("⚠️ Socket initialization failed:", err);
    }

    // Cleanup: leave room on unmount
    return () => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("database:leave-app", appId);
        console.log("🔄 Left database room for app:", appId);
      }
    };
  }, [appId]);

  // ✅ Load tables for the current app with auto-refresh
  useEffect(() => {
    if (!appId) {
      setError("No app ID provided");
      setLoading(false);
      return;
    }

    loadTables();

    const interval = setInterval(() => {
      loadTables();
    }, 10000);

    return () => clearInterval(interval);
  }, [appId]);

  // ✅ Real-time database updates (debounced to prevent duplicate calls)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.warn("⚠️ Socket not connected, skipping DB listener setup");
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_DELAY = 500; // 500ms debounce

    const handleDBEvent = (event: CustomEvent) => {
      const { tableName, action, appId: eventAppId } = event.detail;
      
      // Only process events for the current app
      if (eventAppId && eventAppId.toString() !== appId) {
        return;
      }

      console.log(`📡 Real-time DB event [${action}] for table:`, tableName);

      // Clear existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce the reload to prevent multiple rapid calls
      debounceTimer = setTimeout(() => {
        // Reload tables list if table was created
        if (action === "created" && event.type === "db_table_created") {
          loadTables();
          toast({
            title: "Table Created",
            description: `Table "${tableName}" has been created.`,
          });
          return;
        }

        // Get current selectedTable from state (use functional update to avoid stale closure)
        const currentSelectedTable = selectedTable;
        
        // Reload table data if current table was updated
        if (currentSelectedTable && currentSelectedTable.name === tableName) {
          // Use a fresh table object to avoid triggering useEffect loops
          loadTableData({ ...currentSelectedTable }, currentPage);
          toast({
            title: "Database Updated",
            description: `Table "${tableName}" has been ${action}.`,
          });
        } else if (tableName) {
          // Table was updated but not currently selected, just reload tables list
          loadTables();
        }
      }, DEBOUNCE_DELAY);
    };

    // Attach listeners for database events
    window.addEventListener(
      "db_record_updated",
      handleDBEvent as EventListener
    );
    window.addEventListener(
      "db_record_created",
      handleDBEvent as EventListener
    );
    window.addEventListener(
      "db_record_deleted",
      handleDBEvent as EventListener
    );
    window.addEventListener(
      "db_table_created",
      handleDBEvent as EventListener
    );

    console.log("🧩 Real-time DB event listeners registered");

    return () => {
      // Clear debounce timer on cleanup
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      window.removeEventListener(
        "db_record_updated",
        handleDBEvent as EventListener
      );
      window.removeEventListener(
        "db_record_created",
        handleDBEvent as EventListener
      );
      window.removeEventListener(
        "db_record_deleted",
        handleDBEvent as EventListener
      );
      window.removeEventListener(
        "db_table_created",
        handleDBEvent as EventListener
      );
      console.log("🧹 Real-time DB event listeners removed");
    };
  }, [appId]); // Removed selectedTable and currentPage from dependencies to prevent loops

  const loadTables = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/database/${appId}?_t=${timestamp}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store", // Prevent browser caching
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
    console.log("🟢 [LOAD TABLE DATA] Starting...");
    console.log("🟢 [LOAD TABLE DATA] Table:", table.name);
    console.log("🟢 [LOAD TABLE DATA] Page:", page);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const url = `/api/database/${appId}/tables/${table.name}/data?page=${page}&limit=50&_t=${timestamp}`;
      console.log("🟢 [LOAD TABLE DATA] Fetching:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();
      console.log("🟢 [LOAD TABLE DATA] Response received:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to load table data");
      }

      console.log(
        "🟢 [LOAD TABLE DATA] Data array length:",
        data.data?.length || 0
      );
      console.log(
        "🟢 [LOAD TABLE DATA] First 3 records:",
        data.data?.slice(0, 3)
      );

      setTableData(data.data || []);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      
      // Update selectedTable with columns from API response
      // Backend should always return columns as an array: [{name: "col1", type: "TEXT"}, ...]
      let normalizedColumns = [];
      
      if (data.columns) {
        if (Array.isArray(data.columns)) {
          // Columns are already in array format - use directly
          normalizedColumns = data.columns;
        } else if (typeof data.columns === 'object' && data.columns !== null) {
          // Convert object to array format (fallback for old data)
          normalizedColumns = Object.entries(data.columns).map(([name, def]: [string, any]) => ({
            name,
            type: (def && typeof def === 'object' && def.type) ? def.type : (def || "TEXT"),
            required: (def && typeof def === 'object') ? (def.required || false) : false,
          }));
        }
      } else if (table.columns && Array.isArray(table.columns)) {
        // Fallback to table.columns if API doesn't return columns
        normalizedColumns = table.columns;
      } else if (table.columns && typeof table.columns === 'object') {
        // Fallback: convert object to array
        normalizedColumns = Object.entries(table.columns).map(([name, def]: [string, any]) => ({
          name,
          type: (def && typeof def === 'object' && def.type) ? def.type : (def || "TEXT"),
          required: (def && typeof def === 'object') ? (def.required || false) : false,
        }));
      }
      
      // Ensure all columns have a type
      normalizedColumns = normalizedColumns.map((col: any) => ({
        ...col,
        type: col.type || "TEXT",
      }));
      
      setSelectedTable({
        ...table,
        columns: normalizedColumns,
      });

      // Columns loaded and normalized successfully
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

      // Send UI types to backend - backend will map them to SQL types
      // DO NOT convert to SQL types here - let backend handle it
      const columns = newTableColumns.map((col) => ({
        name: col.name.toLowerCase().replace(/\s+/g, "_"),
        type: col.type, // Send UI type (Text, Number, Boolean, Date, etc.)
        required: col.required,
        elementId: col.name.toLowerCase().replace(/\s+/g, "_"),
        originalName: col.name,
      }));
      
      console.log("🔨 [CREATE TABLE] Sending columns to backend:", JSON.stringify(columns, null, 2));

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
      await loadTables();
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

  const handleAddRecord = async () => {
    if (!selectedTable) {
      toast({
        title: "Error",
        description: "No table selected",
        variant: "destructive",
      });
      return;
    }

    setAddingRecord(true);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Ensure all columns are included in the record data
      // This is especially important for boolean columns that might be false
      const completeRecordData: Record<string, any> = { ...newRecordData };
      
      if (selectedTable.columns) {
        selectedTable.columns.forEach((column) => {
          // Skip system columns
          if (
            column.name === "id" ||
            column.name === "created_at" ||
            column.name === "updated_at" ||
            column.name === "app_id"
          ) {
            return;
          }
          
          // If column is not in recordData, set default value based on type
          if (!(column.name in completeRecordData)) {
            const columnType = (column.type || "").toUpperCase();
            if (columnType.includes("BOOLEAN") || columnType.includes("BOOL")) {
              completeRecordData[column.name] = false;
            } else if (columnType.includes("NUMBER") || columnType.includes("INTEGER")) {
              completeRecordData[column.name] = null;
            } else {
              completeRecordData[column.name] = "";
            }
          }
        });
      }

      const response = await fetch(
        `/api/database/${appId}/tables/${selectedTable.name}/records`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(completeRecordData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add record");
      }

      toast({
        title: "Success",
        description: "Record added successfully",
      });

      // Reset form
      setShowAddRecordModal(false);
      setNewRecordData({});

      // Force refresh by calling loadTableData with a fresh timestamp
      // Reset to page 1 to see the newly inserted record (newest first)
      await loadTableData(selectedTable, 1);
      
      // Also reload tables list to update row counts
      await loadTables();
    } catch (err) {
      console.error("❌ [DATABASE] Error adding record:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to add record",
        variant: "destructive",
      });
    } finally {
      setAddingRecord(false);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    // Show confirmation dialog
    if (
      !confirm(
        `Are you sure you want to delete the table "${tableName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    console.log("🔴 [DELETE TABLE] Starting table deletion...");
    console.log("🔴 [DELETE TABLE] Table name:", tableName);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      console.log("🔴 [DELETE TABLE] Sending DELETE request...");
      const response = await fetch(
        `/api/database/${appId}/tables/${tableName}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      console.log("🔴 [DELETE TABLE] Response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete table");
      }

      console.log("✅ [DELETE TABLE] Table deleted successfully");

      toast({
        title: "Success",
        description: `Table "${tableName}" deleted successfully`,
      });

      // If the deleted table was selected, clear the selection
      if (selectedTable?.name === tableName) {
        setSelectedTable(null);
        setTableData([]);
      }

      // Reload tables list
      console.log("🔴 [DELETE TABLE] Reloading tables list...");
      await loadTables();
      console.log("✅ [DELETE TABLE] Tables list reloaded");
    } catch (err) {
      console.error("❌ [DATABASE] Error deleting table:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete table",
        variant: "destructive",
      });
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

  // Helper function to normalize SQL types to UI types for comparison
  const normalizeColumnType = (type: string): string => {
    if (!type) return "Text";
    const upperType = type.toUpperCase();
    
    // Map SQL types to UI types
    if (upperType.includes("BOOLEAN")) return "Boolean";
    if (upperType.includes("INTEGER") || upperType.includes("INT") || upperType.includes("SERIAL")) return "Number";
    if (upperType.includes("DECIMAL") || upperType.includes("NUMERIC") || upperType.includes("FLOAT") || upperType.includes("DOUBLE") || upperType.includes("REAL")) return "Number";
    if (upperType.includes("DATE") && !upperType.includes("TIME")) return "Date";
    if (upperType.includes("TIMESTAMP") || upperType.includes("DATETIME")) return "DateTime";
    if (upperType.includes("TEXT") || upperType.includes("VARCHAR") || upperType.includes("CHAR")) return "Text";
    
    // If it's already in UI format, return as is
    if (type === "Boolean" || type === "Number" || type === "Text" || type === "Date" || type === "DateTime") {
      return type;
    }
    
    // Default to Text
    return "Text";
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

    // Try to parse JSON strings that start with { or [
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 2) {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === "object" && parsed !== null) {
            // If it's an array, show it nicely
            if (Array.isArray(parsed)) {
              return (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Array ({parsed.length} items):</span>
                  <pre className="text-xs bg-gray-100 p-2 rounded max-w-md overflow-auto max-h-32">
                    {JSON.stringify(parsed, null, 2)}
                  </pre>
                </div>
              );
            }
            // If it's an object, show it nicely
            return (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Object:</span>
                <pre className="text-xs bg-gray-100 p-2 rounded max-w-md overflow-auto max-h-32">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            );
          }
        } catch {
          // Not valid JSON, continue to default
        }
      }
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden responsive-container">
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
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 responsive-text-2xl">
                    Database Management
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 responsive-text-sm">
                    Manage and view your application data
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 responsive-gap-4 responsive-flex-row">
              <Button
                onClick={() => router.push(`/app-users?appId=${appId}&appName=${encodeURIComponent(appName)}`)}
                variant="outline"
                className="gap-2 responsive-button"
              >
                <User className="w-4 h-4" />
                App Users
              </Button>
              <Button
                onClick={() => setShowCreateTableModal(true)}
                className="gap-2 responsive-button"
              >
                <Plus className="w-4 h-4" />
                Create Table
              </Button>
              <Button onClick={loadTables} variant="outline" size="sm" className="responsive-button">
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
                <div
                  key={table.name}
                  className={`group relative w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTable?.name === table.name
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <button
                    onClick={() => loadTableData(table)}
                    className="w-full text-left"
                  >
                    <div className="font-medium truncate pr-8">
                      {table.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {table.rowCount} rows • {table.columns.length} columns
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTable(table.name);
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Delete table"
                  >
                    <Trash className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Table Data */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
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
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setNewRecordData({});
                        setShowAddRecordModal(true);
                      }}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Record
                    </Button>
                    <Button
                      onClick={() => loadTableData(selectedTable)}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
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
              <div className="flex-1 flex flex-col min-h-0 p-4 pb-6 responsive-p-6">
                {/* Column Visibility Toggle */}
                <div className="mb-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {Math.min(visibleColumnsCount, selectedTable.columns.length)} of {selectedTable.columns.length} columns
                    </span>
                    {selectedTable.columns.length > visibleColumnsCount && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleColumnsCount(selectedTable.columns.length)}
                      >
                        Show All
                      </Button>
                    )}
                    {visibleColumnsCount === selectedTable.columns.length && selectedTable.columns.length > 4 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleColumnsCount(4)}
                      >
                        Show Less
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col min-h-0 responsive-card">
                  <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                    <Table className="responsive-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          {selectedTable.columns.slice(0, visibleColumnsCount).map((column) => (
                            <TableHead
                              key={column.name}
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[150px]"
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
                          {selectedTable.columns.length > visibleColumnsCount && (
                            <TableHead className="w-24">Actions</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={visibleColumnsCount + 2}
                              className="text-center py-8 text-gray-500"
                            >
                              No data found
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedData.map((row, index) => (
                            <TableRow 
                              key={index}
                              className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              onClick={() => {
                                setSelectedRecord(row);
                                setShowRecordDetailsModal(true);
                              }}
                            >
                              <TableCell className="text-gray-500">
                                {index + 1 + (currentPage - 1) * 50}
                              </TableCell>
                              {selectedTable.columns.slice(0, visibleColumnsCount).map((column) => (
                                <TableCell key={column.name} className="max-w-[200px]">
                                  <div className="truncate" title={String(row[column.name] || '')}>
                                    {formatCellValue(row[column.name], column.type)}
                                  </div>
                                </TableCell>
                              ))}
                              {selectedTable.columns.length > visibleColumnsCount && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRecord(row);
                                      setShowRecordDetailsModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    View All
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 flex-shrink-0">
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
                
                {/* Bottom margin for better scrolling experience */}
                <div className="h-4 flex-shrink-0"></div>
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

      {/* Add Record Modal */}
      <Dialog open={showAddRecordModal} onOpenChange={setShowAddRecordModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Record</DialogTitle>
            <DialogDescription>
              Add a new record to {selectedTable?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedTable?.columns
              ?.filter(
                (col) =>
                  col.name !== "id" &&
                  col.name !== "created_at" &&
                  col.name !== "updated_at" &&
                  col.name !== "app_id"
              )
              .map((column) => {
                // Normalize the column type to handle both SQL types and UI types
                const columnType = column.type || "TEXT";
                const normalizedType = normalizeColumnType(columnType);
                
                return (
                  <div key={column.name} className="space-y-2">
                    <Label htmlFor={column.name}>
                      {column.name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({column.type || "TEXT"})
                      </span>
                    </Label>
                    {(() => {
                      if (normalizedType === "Boolean") {
                        return (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={column.name}
                              checked={newRecordData[column.name] || false}
                              onCheckedChange={(checked) =>
                                setNewRecordData({
                                  ...newRecordData,
                                  [column.name]: checked,
                                })
                              }
                            />
                            <Label htmlFor={column.name} className="text-sm">
                              {newRecordData[column.name] ? "True" : "False"}
                            </Label>
                          </div>
                        );
                      } else if (normalizedType === "Date" || normalizedType === "DateTime") {
                        return (
                          <Input
                            id={column.name}
                            type="datetime-local"
                            value={newRecordData[column.name] || ""}
                            onChange={(e) =>
                              setNewRecordData({
                                ...newRecordData,
                                [column.name]: e.target.value,
                              })
                            }
                          />
                        );
                      } else if (normalizedType === "Number") {
                        return (
                          <Input
                            id={column.name}
                            type="number"
                            placeholder={`Enter ${column.name}`}
                            value={newRecordData[column.name] || ""}
                            onChange={(e) =>
                              setNewRecordData({
                                ...newRecordData,
                                [column.name]: e.target.value,
                              })
                            }
                          />
                        );
                      } else {
                        // Default to text input
                        return (
                          <Input
                            id={column.name}
                            type="text"
                            placeholder={`Enter ${column.name}`}
                            value={newRecordData[column.name] || ""}
                            onChange={(e) =>
                              setNewRecordData({
                                ...newRecordData,
                                [column.name]: e.target.value,
                              })
                            }
                          />
                        );
                      }
                    })()}
                  </div>
                );
              })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddRecordModal(false)}
              disabled={addingRecord}
            >
              Cancel
            </Button>
            <Button onClick={handleAddRecord} disabled={addingRecord}>
              {addingRecord ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Details Modal */}
      <Dialog open={showRecordDetailsModal} onOpenChange={setShowRecordDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Details</DialogTitle>
            <DialogDescription>
              Full details for record from {selectedTable?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && selectedTable && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTable.columns.map((column) => (
                  <div
                    key={column.name}
                    className="space-y-2 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-semibold text-sm">
                        {column.name}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {column.type}
                      </Badge>
                    </div>
                    <div className="min-h-[40px] break-words">
                      {formatCellValue(selectedRecord[column.name], column.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecordDetailsModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
