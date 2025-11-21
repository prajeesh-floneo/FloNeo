// client/components/canvas/database-table-viewer.tsx
import { useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Database,
  Upload,
} from "lucide-react";
import { UserTable, TableData } from "@/types/database";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";

interface DatabaseTableViewerProps {
  selectedTable: UserTable | null;
}

interface ApiResponse {
  success: boolean;
  data: TableData[];
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
  };
  columns: Record<string, any>;
}

export default function DatabaseTableViewer({
  selectedTable,
}: DatabaseTableViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalRows: 0,
    totalPages: 1,
  });
  const [csvData, setCsvData] = useState<TableData[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGV4YW1wbGUuY29tIiwicm9sZSI6ImRldmVsb3BlciIsImlhdCI6MTc2MjM2NDMxNywiZXhwIjoxNzYyMzY3OTE3fQ.MqkOHZCz7I7-NUnJiIeIAEaHoLeA0uhMbx5OgEtCW7c";

  // ⭐ FETCH TABLE DATA FROM API
  const fetchTableData = useCallback(async (page: number = 1) => {
    if (!selectedTable) return;

    try {
      setIsLoading(true);
      
      const appId = new URLSearchParams(window.location.search).get("appId");
      const url = `https://3da3fb6ed330.ngrok-free.app/api/database/${appId}/tables/${selectedTable.name}/data?page=${page}&limit=50`;

      console.log("Fetching table data:", url);

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
          "Authorization": `Bearer ${JWT_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const apiData: ApiResponse = await response.json();
      console.log("Table data response:", apiData);

      if (apiData.success) {
        setTableData(apiData.data);
        setColumns(Object.keys(apiData.columns));
        setPagination(apiData.pagination);
        setCurrentPage(apiData.pagination.page);
      }
    } catch (err) {
      console.error("Error fetching table data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTable, JWT_TOKEN]);

  // ⭐ FETCH DATA WHEN TABLE CHANGES
  useEffect(() => {
    if (selectedTable) {
      fetchTableData(1);
    }
  }, [selectedTable, fetchTableData]);

  // CSV Import Handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (file && file.type === "text/csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log("CSV Parsed:", results);

          if (results.data.length > 0) {
            const columns = Object.keys(results.data[0] as object);
            setCsvColumns(columns);
            setCsvData(results.data as TableData[]);

            console.log("Ready to upload:", {
              columns,
              rows: results.data.length,
              data: results.data,
            });
          }
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          alert("Error parsing CSV file. Please check the format.");
        },
      });
    } else {
      alert("Please upload a valid CSV file");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    multiple: false,
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTableData(currentPage).finally(() => {
      setIsRefreshing(false);
    });
  };

  const handleExport = () => {
    console.log("Export clicked");
    // TODO: Implement export functionality
  };

  // ⭐ HANDLE PAGE CHANGE
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchTableData(newPage);
    }
  };

  // Use CSV data if imported, otherwise use API data
  const displayColumns = csvColumns.length > 0 ? csvColumns : columns;
  const displayData = csvData.length > 0 ? csvData : tableData;
  const totalPages = csvData.length > 0 ? 1 : pagination.totalPages;
  const totalRows = csvData.length > 0 ? csvData.length : pagination.totalRows;

  if (!selectedTable) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="flex flex-col justify-center items-center text-gray-500 border border-dashed border-gray-300 rounded-2xl w-[50%] h-[50%]"
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
          {isDragActive ? (
            <p className="text-blue-600">Drop the files here...</p>
          ) : (
            <>
              <p className="text-lg">Select a table to view data</p>
              <p className="text-sm mt-2">
                Choose a table from the list on the left
              </p>
              <p className="text-xs mt-4 text-gray-400">
                Or drag & drop a CSV file to import
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <Card className="m-4 mb-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">
              {selectedTable.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {totalRows} rows • {displayColumns.length} columns
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  isRefreshing || isLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>

            {/* CSV Import Button */}
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                variant="outline"
                size="sm"
                className={isDragActive ? "border-blue-500 bg-blue-50" : ""}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Drag & Drop Zone (shows when empty) */}
      {displayData.length === 0 && !isLoading && (
        <div className="m-4 mt-2">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-gray-300 dark:border-gray-700 hover:border-blue-400"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                Drop your CSV file here...
              </p>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No data in this table yet
                </p>
                <p className="text-sm text-gray-500">
                  Drag & drop a CSV file here, or click to select
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Loading data...</p>
          </div>
        </div>
      )}

      {/* Table Content */}
      {!isLoading && displayData.length > 0 && (
        <div className="flex-1 overflow-auto m-4 mt-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayColumns.map((column) => (
                      <TableHead key={column} className="font-semibold">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((row, index) => (
                    <TableRow key={index}>
                      {displayColumns.map((column) => (
                        <TableCell key={column}>
                          {row[column] !== undefined
                            ? String(row[column])
                            : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && displayData.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages} • {totalRows} total rows
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
