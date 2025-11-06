// client/types/database.ts (new file banao)
export interface UserTable {
  id: number;
  tableName: string;
  rowCount: number;
  createdAt: string;
}

export interface TableColumn {
  name: string;
  type: string;
  required?: boolean;
}

export interface TableData {
  [key: string]: any;
}
