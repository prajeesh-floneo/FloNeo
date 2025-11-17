"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

type ChartElementType = 
  | "chart-bar" 
  | "chart-line" 
  | "chart-pie" 
  | "chart-donut" 
  | "kpi-card" 
  | "table" 
  | "matrix-chart";

interface ChartSeries {
  dataKey: string;
  label: string;
  color?: string;
  strokeWidth?: number;
}

interface KPICardData {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  target?: number;
  description?: string;
}

interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

interface ChartProperties {
  title?: string;
  description?: string;
  data?: Array<Record<string, any>>;
  xKey?: string;
  valueKey?: string;
  nameKey?: string;
  series?: ChartSeries[];
  colors?: string[];
  legend?: boolean;
  showGrid?: boolean;
  showAxis?: boolean;
  strokeCurve?: "linear" | "monotone";
  innerRadius?: number | string;
  outerRadius?: number | string;
  donut?: boolean;
  
  // KPI Card specific
  kpiData?: KPICardData;
  
  // Table specific
  columns?: TableColumn[];
  showHeader?: boolean;
  striped?: boolean;
  
  // Matrix Chart specific
  matrixRows?: string[];
  matrixCols?: string[];
  cellColors?: string[];
}

const DEFAULT_COLORS = ["#2563eb", "#7c3aed", "#22c55e", "#f97316", "#14b8a6"];

const DEFAULT_PROPERTIES: Record<ChartElementType, ChartProperties> = {
  "chart-bar": {
    title: "Monthly Revenue",
    description: "Example dataset for drag & drop preview",
    data: [
      { month: "Jan", desktop: 186, mobile: 80 },
      { month: "Feb", desktop: 305, mobile: 200 },
      { month: "Mar", desktop: 237, mobile: 120 },
      { month: "Apr", desktop: 173, mobile: 190 },
      { month: "May", desktop: 209, mobile: 130 },
      { month: "Jun", desktop: 214, mobile: 140 },
    ],
    xKey: "month",
    legend: true,
    showGrid: true,
    showAxis: true,
    series: [
      { dataKey: "desktop", label: "Desktop" },
      { dataKey: "mobile", label: "Mobile" },
    ],
  },
  "chart-line": {
    title: "Active Users",
    description: "Example trend line",
    data: [
      { month: "Jan", desktop: 120, mobile: 80 },
      { month: "Feb", desktop: 160, mobile: 110 },
      { month: "Mar", desktop: 200, mobile: 140 },
      { month: "Apr", desktop: 180, mobile: 150 },
      { month: "May", desktop: 220, mobile: 170 },
      { month: "Jun", desktop: 260, mobile: 210 },
    ],
    xKey: "month",
    legend: true,
    showGrid: true,
    showAxis: true,
    strokeCurve: "monotone",
    series: [
      { dataKey: "desktop", label: "Desktop", strokeWidth: 3 },
      { dataKey: "mobile", label: "Mobile", strokeWidth: 3 },
    ],
  },
  "chart-pie": {
    title: "Traffic Sources",
    description: "Distribution example",
    data: [
      { category: "Organic", value: 45 },
      { category: "Paid", value: 25 },
      { category: "Referral", value: 15 },
      { category: "Social", value: 10 },
      { category: "Email", value: 5 },
    ],
    nameKey: "category",
    valueKey: "value",
    legend: true,
    showAxis: false,
    showGrid: false,
  },
  "chart-donut": {
    title: "Plan Usage",
    description: "Relative share of plans",
    data: [
      { plan: "Free", value: 40 },
      { plan: "Starter", value: 25 },
      { plan: "Pro", value: 22 },
      { plan: "Enterprise", value: 13 },
    ],
    nameKey: "plan",
    valueKey: "value",
    legend: true,
    donut: true,
    innerRadius: "55%",
    outerRadius: "80%",
  },
  "kpi-card": {
    title: "Revenue",
    description: "Monthly performance",
    kpiData: {
      label: "Total Revenue",
      value: "$45,231",
      unit: "",
      trend: 12.5,
      target: 50000,
      description: "vs last month",
    },
  },
  "table": {
    title: "Sales Report",
    description: "Recent transactions",
    columns: [
      { key: "id", label: "ID", align: "left" },
      { key: "product", label: "Product", align: "left" },
      { key: "quantity", label: "Qty", align: "center" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    data: [
      { id: "001", product: "Laptop", quantity: 2, amount: "$2,400" },
      { id: "002", product: "Mouse", quantity: 5, amount: "$125" },
      { id: "003", product: "Keyboard", quantity: 3, amount: "$210" },
      { id: "004", product: "Monitor", quantity: 1, amount: "$450" },
    ],
    showHeader: true,
    striped: true,
  },
  "matrix-chart": {
    title: "Performance Matrix",
    description: "Cross-category analysis",
    matrixRows: ["Q1", "Q2", "Q3", "Q4"],
    matrixCols: ["Sales", "Marketing", "Support", "Dev"],
    data: [
      { row: "Q1", col: "Sales", value: 85 },
      { row: "Q1", col: "Marketing", value: 72 },
      { row: "Q1", col: "Support", value: 68 },
      { row: "Q1", col: "Dev", value: 90 },
      { row: "Q2", col: "Sales", value: 78 },
      { row: "Q2", col: "Marketing", value: 88 },
      { row: "Q2", col: "Support", value: 75 },
      { row: "Q2", col: "Dev", value: 82 },
      { row: "Q3", col: "Sales", value: 92 },
      { row: "Q3", col: "Marketing", value: 80 },
      { row: "Q3", col: "Support", value: 85 },
      { row: "Q3", col: "Dev", value: 88 },
      { row: "Q4", col: "Sales", value: 88 },
      { row: "Q4", col: "Marketing", value: 95 },
      { row: "Q4", col: "Support", value: 90 },
      { row: "Q4", col: "Dev", value: 93 },
    ],
    cellColors: ["#fee2e2", "#fef3c7", "#dcfce7", "#d1fae5", "#86efac"],
  },
};

const normalizeType = (type: string): ChartElementType => {
  switch (type?.toLowerCase()) {
    case "chart-bar":
    case "chart_bar":
    case "chartbar":
      return "chart-bar";
    case "chart-line":
    case "chart_line":
    case "chartline":
      return "chart-line";
    case "chart-donut":
    case "chart_donut":
    case "chartdonut":
    case "chart-ring":
      return "chart-donut";
    case "kpi-card":
    case "kpi_card":
    case "kpicard":
      return "kpi-card";
    case "table":
    case "data-table":
      return "table";
    case "matrix-chart":
    case "matrix_chart":
    case "matrixchart":
      return "matrix-chart";
    case "chart-pie":
    case "chart_pie":
    case "chartpie":
    default:
      return type?.toLowerCase() === "chart-donut" ? "chart-donut" : "chart-pie";
  }
};

const mergeProperties = (
  type: ChartElementType,
  properties?: Record<string, any>
): ChartProperties => {
  const defaults = DEFAULT_PROPERTIES[type];
  return {
    ...defaults,
    ...properties,
    series: properties?.series || defaults.series,
    data: properties?.data && Array.isArray(properties.data)
      ? properties.data
      : defaults.data,
    colors: properties?.colors && properties.colors.length > 0
      ? properties.colors
      : defaults.colors || DEFAULT_COLORS,
    kpiData: properties?.kpiData || defaults.kpiData,
    columns: properties?.columns || defaults.columns,
    matrixRows: properties?.matrixRows || defaults.matrixRows,
    matrixCols: properties?.matrixCols || defaults.matrixCols,
  };
};

interface ChartElementProps {
  type: string;
  properties?: Record<string, any>;
  showHeader?: boolean;
  className?: string;
}

export const ChartElement: React.FC<ChartElementProps> = ({
  type,
  properties,
  showHeader = true,
  className,
}) => {
  const normalizedType = normalizeType(type);
  const mergedProps = mergeProperties(normalizedType, properties);
  const data = mergedProps.data || [];
  const colors = mergedProps.colors || DEFAULT_COLORS;

  const renderBarChart = () => {
    const series = mergedProps.series || [];
    const config = series.length > 0 ? series : [{ dataKey: mergedProps.valueKey || "value", label: mergedProps.valueKey || "Value" }];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          {mergedProps.showGrid !== false && (
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
          )}
          {mergedProps.showAxis !== false && (
            <>
              <XAxis
                dataKey={mergedProps.xKey || "name"}
                tickLine={false}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
            contentStyle={{
              fontSize: "12px",
              borderRadius: "10px",
              borderColor: "rgba(148, 163, 184, 0.45)",
            }}
          />
          {mergedProps.legend && <Legend />}
          {config.map((serie, index) => (
            <Bar
              key={serie.dataKey}
              dataKey={serie.dataKey}
              name={serie.label}
              fill={serie.color || colors[index % colors.length]}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderLineChart = () => {
    const series = mergedProps.series || [];
    const config = series.length > 0 ? series : [{ dataKey: mergedProps.valueKey || "value", label: mergedProps.valueKey || "Value" }];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          {mergedProps.showGrid !== false && (
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
          )}
          {mergedProps.showAxis !== false && (
            <>
              <XAxis
                dataKey={mergedProps.xKey || "name"}
                tickLine={false}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }}
              />
            </>
          )}
          <Tooltip
            cursor={{ strokeDasharray: "4 4" }}
            contentStyle={{
              fontSize: "12px",
              borderRadius: "10px",
              borderColor: "rgba(148, 163, 184, 0.45)",
            }}
          />
          {mergedProps.legend && <Legend />}
          {config.map((serie, index) => (
            <Line
              key={serie.dataKey}
              type={mergedProps.strokeCurve || "linear"}
              dataKey={serie.dataKey}
              name={serie.label}
              stroke={serie.color || colors[index % colors.length]}
              strokeWidth={serie.strokeWidth || 3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => {
    const nameKey = mergedProps.nameKey || "name";
    const valueKey = mergedProps.valueKey || "value";
    const innerRadius =
      normalizedType === "chart-donut" || mergedProps.donut
        ? mergedProps.innerRadius || "50%"
        : 0;
    const outerRadius = mergedProps.outerRadius || "80%";

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={4}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry[nameKey]}-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: "12px",
              borderRadius: "10px",
              borderColor: "rgba(148, 163, 184, 0.45)",
            }}
          />
          {mergedProps.legend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderKPICard = () => {
    const kpi = mergedProps.kpiData;
    if (!kpi) return null;

    const trendPositive = (kpi.trend || 0) >= 0;
    const TrendIcon = trendPositive ? TrendingUp : TrendingDown;

    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Activity className="w-8 h-8 text-blue-500 dark:text-blue-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
          {kpi.label}
        </p>
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-4xl font-bold text-slate-800 dark:text-slate-100">
            {kpi.value}
          </h2>
          {kpi.unit && (
            <span className="text-lg text-slate-600 dark:text-slate-300">
              {kpi.unit}
            </span>
          )}
        </div>
        
        {kpi.trend !== undefined && (
          <div className={`flex items-center gap-1 ${trendPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {Math.abs(kpi.trend)}%
            </span>
            {kpi.description && (
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                {kpi.description}
              </span>
            )}
          </div>
        )}
        
        {kpi.target && (
          <div className="mt-3 w-full">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Progress</span>
              <span>{typeof kpi.value === 'number' ? Math.round((kpi.value / kpi.target) * 100) : 0}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                style={{ 
                  width: `${typeof kpi.value === 'number' ? Math.min((kpi.value / kpi.target) * 100, 100) : 0}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTable = () => {
    const columns = mergedProps.columns || [];
    const showHeader = mergedProps.showHeader !== false;
    const striped = mergedProps.striped !== false;

    if (data.length === 0 || columns.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">
          Add data and columns to render table
        </div>
      );
    }

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-sm">
          {showHeader && (
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-2 text-${col.align || 'left'} font-semibold text-slate-700 dark:text-slate-200`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${
                  striped && rowIndex % 2 === 1 
                    ? 'bg-slate-50 dark:bg-slate-800/50' 
                    : ''
                } hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 text-${col.align || 'left'} text-slate-600 dark:text-slate-300`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMatrixChart = () => {
    const rows = mergedProps.matrixRows || [];
    const cols = mergedProps.matrixCols || [];
    const cellColors = mergedProps.cellColors || ["#fee2e2", "#fef3c7", "#dcfce7", "#86efac"];

    if (data.length === 0 || rows.length === 0 || cols.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">
          Add matrix data to render
        </div>
      );
    }

    const getCellValue = (row: string, col: string) => {
      const cell = data.find((d) => d.row === row && d.col === col);
      return cell?.value || 0;
    };

    const getCellColor = (value: number) => {
      const maxValue = Math.max(...data.map((d) => d.value || 0));
      const percentage = (value / maxValue) * 100;
      
      if (percentage >= 80) return cellColors[3] || "#86efac";
      if (percentage >= 60) return cellColors[2] || "#dcfce7";
      if (percentage >= 40) return cellColors[1] || "#fef3c7";
      return cellColors[0] || "#fee2e2";
    };

    return (
      <div className="overflow-auto h-full p-4">
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border border-slate-200 dark:border-slate-700"></th>
                {cols.map((col) => (
                  <th
                    key={col}
                    className="p-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800">
                    {row}
                  </td>
                  {cols.map((col) => {
                    const value = getCellValue(row, col);
                    return (
                      <td
                        key={`${row}-${col}`}
                        className="p-3 border border-slate-200 dark:border-slate-700 text-center text-sm font-medium"
                        style={{
                          backgroundColor: getCellColor(value),
                        }}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-white/90 dark:bg-slate-900/70 ${className || ""}`}
      style={{
        backdropFilter: "blur(4px)",
      }}
    >
      {showHeader && (mergedProps.title || mergedProps.description) && (
        <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800">
          {mergedProps.title && (
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {mergedProps.title}
            </p>
          )}
          {mergedProps.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {mergedProps.description}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 p-3 overflow-hidden">
        {data.length === 0 && normalizedType !== "kpi-card" ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
            Add data to render this {normalizedType.replace('-', ' ')}
          </div>
        ) : normalizedType === "chart-bar" ? (
          renderBarChart()
        ) : normalizedType === "chart-line" ? (
          renderLineChart()
        ) : normalizedType === "kpi-card" ? (
          renderKPICard()
        ) : normalizedType === "table" ? (
          renderTable()
        ) : normalizedType === "matrix-chart" ? (
          renderMatrixChart()
        ) : (
          renderPieChart()
        )}
      </div>
    </div>
  );
};

export default ChartElement;
