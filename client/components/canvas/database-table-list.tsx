import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Database, AlertCircle } from 'lucide-react';
import { UserTable } from '@/types/database';

interface DatabaseTableListProps {
  tables: UserTable[];
  selectedTable: UserTable | null;
  onSelectTable: (table: UserTable) => void;
}

export default function DatabaseTableList({ 
  tables, 
  selectedTable, 
  onSelectTable 
}: DatabaseTableListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // ⭐ FIXED: Use 'name' instead of 'tableName'
  const filteredTables = tables.filter((table) => {
    return table.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate total rows
  const totalRows = tables.reduce((sum, table) => sum + table.rowCount, 0);

  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-800 h-full flex flex-col">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Database Tables
        </h2>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tables..."
            className="pl-10"
          />
        </div>

        {/* Quick Stats */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Total Tables</span>
            <span className="font-semibold">{tables.length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Total Rows</span>
            <span className="font-semibold">{totalRows.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredTables.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tables found</p>
          </div>
        ) : (
          filteredTables.map((table) => (
            <Card
              key={table.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTable?.id === table.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'hover:border-gray-300'
              }`}
              onClick={() => onSelectTable(table)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {/* ⭐ FIXED: Use 'name' instead of 'tableName' */}
                    <h3 className="font-medium text-sm mb-1">{table.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {table.rowCount} rows
                    </p>
                  </div>
                </div>
                
                {/* Show columns count */}
                <div className="text-xs text-gray-400 mt-2">
                  {Object.keys(table.columns).length} columns
                </div>
                
                {/* Show created date */}
                <div className="text-xs text-gray-400">
                  Created: {new Date(table.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
