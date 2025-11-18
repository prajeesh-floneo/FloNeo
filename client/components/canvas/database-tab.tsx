"use client";

import { useState, useEffect } from "react";
import DatabaseTableList from "./database-table-list";
import DatabaseTableViewer from "./database-table-viewer";
import { UserTable } from "@/types/database";
import { useSearchParams } from "next/navigation";

export default function DatabaseTab() {
  const [tables, setTables] = useState<UserTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<UserTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const appId = searchParams.get("appId");

  const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGV4YW1wbGUuY29tIiwicm9sZSI6ImRldmVsb3BlciIsImlhdCI6MTc2MjM2NDMxNywiZXhwIjoxNzYyMzY3OTE3fQ.MqkOHZCz7I7-NUnJiIeIAEaHoLeA0uhMbx5OgEtCW7c";

  useEffect(() => {
    if (!appId) return;

    const fetchTables = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(
          `https://3da3fb6ed330.ngrok-free.app/api/database/${appId}/tables`,
          {
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "69420",
              "User-Agent": "CustomAgent",
              "Authorization": `Bearer ${JWT_TOKEN}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        // ⭐ NO NEED TO TRANSFORM - Backend response already matches UserTable
        // Just filter out tables that don't exist in database
        const validTables: UserTable[] = data.tables.filter((table: any) => table.exists);
        
        setTables(validTables);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load tables");
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, [appId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p>Loading tables...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-white dark:bg-gray-950">
      <DatabaseTableList
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
      />
      <DatabaseTableViewer selectedTable={selectedTable} />
    </div>
  );
}
