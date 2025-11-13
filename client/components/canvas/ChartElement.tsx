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

type ChartElementType = "chart-bar" | "chart-line" | "chart-pie" | "chart-donut";

interface ChartSeries {
  dataKey: string;
  label: string;
  color?: string;
  strokeWidth?: number;
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

      <div className="flex-1 p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
            Add data to render this chart
          </div>
        ) : normalizedType === "chart-bar" ? (
          renderBarChart()
        ) : normalizedType === "chart-line" ? (
          renderLineChart()
        ) : (
          renderPieChart()
        )}
      </div>
    </div>
  );
};

export default ChartElement;

