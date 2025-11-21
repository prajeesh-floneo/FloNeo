"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Palette,
  Type,
  Move,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { useCanvasWorkflow } from "@/lib/canvas-workflow-context";
import { authenticatedFetch } from "@/lib/auth";

const DEFAULT_CHART_COLORS = ["#2563eb", "#7c3aed", "#22c55e", "#f97316", "#14b8a6"];
const CHART_ELEMENT_TYPES = new Set([
  "chart-bar",
  "chart-line",
  "chart-pie",
  "chart-donut",
]);

interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, any>;
  rotation: number;
  opacity: number;
  pageId: string;
  zIndex: number;
}

interface ElementGroup {
  id: string;
  name: string;
  elementIds: string[];
  collapsed: boolean;
  type: "regular" | "form";
  properties?: {
    submitButtonId?: string;
    formName?: string;
  };
}

interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
  groups: ElementGroup[];
  visible: boolean;
  canvasBackground: {
    type: "color" | "gradient" | "image";
    color?: string;
    gradient?: {
      type: "linear" | "radial";
      colors: string[];
      direction?: string;
    };
    image?: {
      url: string;
      size: "cover" | "contain" | "repeat";
      position: string;
    };
  };
  // Optional canvas size metadata for alignment helpers
  canvasWidth?: number;
  canvasHeight?: number;
}

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  currentPage: Page | null;
  showCanvasProperties: boolean;
  onUpdateElement: (property: string, value: any) => void;
  onUpdateElementTransform: (property: string, value: number) => void;
  onUpdateCanvasBackground: (
    background: Partial<Page["canvasBackground"]>
  ) => void;
  onDeleteElement: () => void;
  onDuplicateElement: () => void;
  onToggleElementVisibility: () => void;
  onToggleElementLock: () => void;
  onMoveElementLayer: (direction: "up" | "down") => void;
}

export function PropertiesPanel({
  selectedElement,
  currentPage,
  showCanvasProperties,
  onUpdateElement,
  onUpdateElementTransform,
  onUpdateCanvasBackground,
  onDeleteElement,
  onDuplicateElement,
  onToggleElementVisibility,
  onToggleElementLock,
  onMoveElementLayer,
}: PropertiesPanelProps) {
  const { currentAppId } = useCanvasWorkflow();
  const normalizedSelectedType = selectedElement?.type?.toLowerCase() || "";
  const isChartElement = CHART_ELEMENT_TYPES.has(normalizedSelectedType);
  const isPieOrDonut =
    normalizedSelectedType === "chart-pie" || normalizedSelectedType === "chart-donut";
  const isLineOrBar =
    normalizedSelectedType === "chart-line" || normalizedSelectedType === "chart-bar";

  // Database tables / columns state for chart binding
  const [dbTables, setDbTables] = useState<Array<{ name: string; columns?: Array<{ name: string; type: string }> }>>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableColumns, setTableColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [dataWarning, setDataWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isChartElement) {
      setTableColumns([]);
      setDataWarning(null);
      setTableDataLoading(false);
    }
  }, [isChartElement]);

  useEffect(() => {
    // Load tables when panel mounts (if app id available)
    const load = async () => {
      if (!currentAppId) return;
      try {
        setTablesLoading(true);
        const resp = await authenticatedFetch(`/api/database/${currentAppId}`);
        const json = await resp.json();
        setDbTables(json.tables || []);
      } catch (err) {
        console.warn("Failed to load DB tables for properties panel", err);
      } finally {
        setTablesLoading(false);
      }
    };

    load();
  }, [currentAppId]);

  const fetchTableColumns = useCallback(async (tableName: string) => {
    if (!currentAppId || !tableName || !isChartElement) return;
    try {
      setTableDataLoading(true);
      const timestamp = Date.now();
      const encodedTableName = encodeURIComponent(tableName);
      const resp = await authenticatedFetch(
        `/api/database/${currentAppId}/tables/${encodedTableName}/data?page=1&limit=1&_t=${timestamp}`
      );
      const json = await resp.json();
      let cols: any[] = [];
      if (json.columns && Array.isArray(json.columns)) {
        cols = json.columns.map((c: any) => ({ name: c.name, type: c.type || "TEXT" }));
      } else if (json.columns && typeof json.columns === "object") {
        cols = Object.entries(json.columns).map(([k, v]) => ({ name: k, type: (v && v.type) || "TEXT" }));
      } else if (json.data && json.data.length > 0) {
        cols = Object.keys(json.data[0]).map((k) => ({ name: k, type: "TEXT" }));
      } else {
        // Fall back to dbTables metadata
        const meta = dbTables.find((t) => t.name === tableName);
        cols = (meta?.columns || []).map((c: any) => ({ name: c.name, type: c.type || "TEXT" }));
      }

      setTableColumns(cols);
    } catch (err) {
      console.warn("Failed to fetch table columns", err);
      setTableColumns([]);
    } finally {
      setTableDataLoading(false);
    }
  }, [currentAppId, dbTables, isChartElement]);

  const fetchTableData = async (tableName: string, xKey?: string, yKey?: string) => {
    if (!currentAppId || !tableName || !isChartElement) return;
    if (!xKey || !yKey) {
      onUpdateElement("data", []);
      setDataWarning(null);
      return;
    }

    try {
      setTableDataLoading(true);
      setDataWarning(null);
      const params = new URLSearchParams({
        xKey,
        yKey,
        chartType: selectedElement?.type || "chart-line",
        limit: "500",
        _t: Date.now().toString(),
      });

      const encodedTableName = encodeURIComponent(tableName);
      const resp = await authenticatedFetch(
        `/api/chart-data/${currentAppId}/tables/${encodedTableName}?${params.toString()}`
      );
      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || "Failed to fetch chart data");
      }

      onUpdateElement("data", json.data || []);

      if (json?.metadata?.yColumnType) {
        onUpdateElement("yColumnType", json.metadata.yColumnType);
      }

      if (Array.isArray(json.columns) && json.columns.length > 0) {
        setTableColumns(json.columns);
      }

      if (Array.isArray(json.warnings) && json.warnings.length > 0) {
        setDataWarning(json.warnings.join(". "));
      } else {
        setDataWarning(null);
      }
    } catch (err) {
      console.warn("Failed to fetch chart data", err);
      const message = err instanceof Error ? err.message : "Failed to load data";
      setDataWarning(message);
      onUpdateElement("data", []);
    } finally {
      setTableDataLoading(false);
    }
  };

  useEffect(() => {
    const tableName = selectedElement?.properties?.tableName;
    if (!currentAppId || !tableName || !isChartElement) {
      if (!tableName) {
        setTableColumns([]);
      }
      return;
    }

    fetchTableColumns(tableName);
  }, [currentAppId, fetchTableColumns, isChartElement, selectedElement?.properties?.tableName]);
  const renderGeneralProperties = () => {
    const isDisabled = !selectedElement;
    const alignHorizontally = (dir: "left" | "center" | "right") => {
      if (!selectedElement) return;
      onUpdateElement("horizontalAlign", dir);
      if (!currentPage?.canvasWidth) return;
      const canvasW = currentPage.canvasWidth;
      const newX =
        dir === "left"
          ? 0
          : dir === "right"
          ? Math.max(0, canvasW - selectedElement.width)
          : Math.max(0, Math.round((canvasW - selectedElement.width) / 2));
      onUpdateElementTransform("x", newX);
    };
    const alignVertically = (dir: "top" | "center" | "bottom") => {
      if (!selectedElement) return;
      onUpdateElement("verticalAlign", dir);
      if (!currentPage?.canvasHeight) return;
      const canvasH = currentPage.canvasHeight;
      const newY =
        dir === "top"
          ? 0
          : dir === "bottom"
          ? Math.max(0, canvasH - selectedElement.height)
          : Math.max(0, Math.round((canvasH - selectedElement.height) / 2));
      onUpdateElementTransform("y", newY);
    };
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon />
            General Properties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Alignment */}
          <div className="space-y-3">
            <Label>Alignment</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Horizontal
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.horizontalAlign === "left"
                        ? "default"
                        : "outline"
                    }
                    className="w-8 h-8 p-0"
                    disabled={isDisabled}
                    onClick={() => alignHorizontally("left")}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.horizontalAlign === "center"
                        ? "default"
                        : "outline"
                    }
                    className="w-8 h-8 p-0"
                    disabled={isDisabled}
                    onClick={() => alignHorizontally("center")}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.horizontalAlign === "right"
                        ? "default"
                        : "outline"
                    }
                    className="w-8 h-8 p-0"
                    disabled={isDisabled}
                    onClick={() => alignHorizontally("right")}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Vertical
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.verticalAlign === "top"
                        ? "default"
                        : "outline"
                    }
                    className="px-2"
                    disabled={isDisabled}
                    onClick={() => alignVertically("top")}
                  >
                    Top
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.verticalAlign === "center"
                        ? "default"
                        : "outline"
                    }
                    className="px-2"
                    disabled={isDisabled}
                    onClick={() => alignVertically("center")}
                  >
                    Center
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedElement?.properties?.verticalAlign === "bottom"
                        ? "default"
                        : "outline"
                    }
                    className="px-2"
                    disabled={isDisabled}
                    onClick={() => alignVertically("bottom")}
                  >
                    Bottom
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label>Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  value={selectedElement ? Math.round(selectedElement.x) : 0}
                  onChange={(e) =>
                    onUpdateElementTransform(
                      "x",
                      Number.parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={isDisabled}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  value={selectedElement ? Math.round(selectedElement.y) : 0}
                  onChange={(e) =>
                    onUpdateElementTransform(
                      "y",
                      Number.parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={isDisabled}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Layout / Dimensions */}
          <div className="space-y-2">
            <Label>Layout / Dimensions</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">W</Label>
                <Input
                  type="number"
                  value={
                    selectedElement ? Math.round(selectedElement.width) : 0
                  }
                  onChange={(e) =>
                    onUpdateElementTransform(
                      "width",
                      Number.parseFloat(e.target.value) || 1
                    )
                  }
                  disabled={isDisabled}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs">H</Label>
                <Input
                  type="number"
                  value={
                    selectedElement ? Math.round(selectedElement.height) : 0
                  }
                  onChange={(e) =>
                    onUpdateElementTransform(
                      "height",
                      Number.parseFloat(e.target.value) || 1
                    )
                  }
                  disabled={isDisabled}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <RotateCw className="w-3 h-3" />
              Rotation: {selectedElement ? selectedElement.rotation : 0}°
            </Label>
            <Slider
              value={[selectedElement ? selectedElement.rotation : 0]}
              onValueChange={([value]) =>
                onUpdateElementTransform("rotation", value)
              }
              min={-180}
              max={180}
              step={1}
              className="mt-1"
              disabled={isDisabled}
            />
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <Label>
              Opacity: {selectedElement ? selectedElement.opacity : 100}%
            </Label>
            <Slider
              value={[selectedElement ? selectedElement.opacity : 100]}
              onValueChange={([value]) =>
                onUpdateElementTransform("opacity", value)
              }
              min={0}
              max={100}
              step={1}
              className="mt-1"
              disabled={isDisabled}
            />
          </div>

          {/* Corner radius */}
          <div>
            <Label>Corner radius</Label>
            <Input
              type="number"
              value={
                selectedElement
                  ? selectedElement.properties.borderRadius || 0
                  : 0
              }
              onChange={(e) =>
                onUpdateElement(
                  "borderRadius",
                  Number.parseInt(e.target.value) || 0
                )
              }
              disabled={isDisabled}
              className="w-full"
            />
          </div>

          {/* Placeholders for Fill / Stroke / Effects to maintain layout; real layering can be added later */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Fill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="color"
                  disabled={isDisabled}
                  value={
                    selectedElement?.properties?.backgroundColor || "#ffffff"
                  }
                  onChange={(e) =>
                    onUpdateElement("backgroundColor", e.target.value)
                  }
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="text"
                  disabled={isDisabled}
                  value={
                    selectedElement?.properties?.backgroundColor || "#ffffff"
                  }
                  onChange={(e) =>
                    onUpdateElement("backgroundColor", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Stroke</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="color"
                  disabled={isDisabled}
                  value={selectedElement?.properties?.borderColor || "#000000"}
                  onChange={(e) =>
                    onUpdateElement("borderColor", e.target.value)
                  }
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="number"
                  disabled={isDisabled}
                  value={selectedElement?.properties?.borderWidth || 0}
                  onChange={(e) =>
                    onUpdateElement(
                      "borderWidth",
                      Number.parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="Weight"
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Effects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  disabled={isDisabled}
                  checked={!!selectedElement?.properties?.shadow}
                  onCheckedChange={(v) => onUpdateElement("shadow", v)}
                />
                <Label>Drop shadow</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  disabled={isDisabled}
                  checked={!!selectedElement?.properties?.backgroundBlur}
                  onCheckedChange={(v) => onUpdateElement("backgroundBlur", v)}
                />
                <Label>Background blur</Label>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    );
  };
  const renderCanvasProperties = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Canvas Background
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Background Type</Label>
          <Select
            value={currentPage?.canvasBackground.type || "color"}
            onValueChange={(value: "color" | "gradient" | "image") =>
              onUpdateCanvasBackground({ type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="color">Solid Color</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {currentPage?.canvasBackground.type === "color" && (
          <div>
            <Label>Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={currentPage.canvasBackground.color || "#ffffff"}
                onChange={(e) =>
                  onUpdateCanvasBackground({ color: e.target.value })
                }
                className="w-16 h-10 p-1 border rounded"
              />
              <Input
                type="text"
                value={currentPage.canvasBackground.color || "#ffffff"}
                onChange={(e) =>
                  onUpdateCanvasBackground({ color: e.target.value })
                }
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        )}

        {currentPage?.canvasBackground.type === "gradient" && (
          <div className="space-y-3">
            <div>
              <Label>Gradient Type</Label>
              <Select
                value={currentPage.canvasBackground.gradient?.type || "linear"}
                onValueChange={(value: "linear" | "radial") =>
                  onUpdateCanvasBackground({
                    gradient: {
                      type: value,
                      colors: currentPage.canvasBackground.gradient?.colors || [
                        "#ffffff",
                        "#000000",
                      ],
                      direction:
                        currentPage.canvasBackground.gradient?.direction ||
                        "45deg",
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {currentPage.canvasBackground.gradient?.type === "linear" && (
              <div>
                <Label>Direction</Label>
                <Select
                  value={
                    currentPage.canvasBackground.gradient?.direction || "45deg"
                  }
                  onValueChange={(value) =>
                    onUpdateCanvasBackground({
                      gradient: {
                        type:
                          currentPage.canvasBackground.gradient?.type ||
                          "linear",
                        direction: value,
                        colors: currentPage.canvasBackground.gradient
                          ?.colors || ["#ffffff", "#000000"],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0deg">Top to Bottom</SelectItem>
                    <SelectItem value="90deg">Left to Right</SelectItem>
                    <SelectItem value="45deg">Diagonal ↗</SelectItem>
                    <SelectItem value="135deg">Diagonal ↖</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Color 1</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={
                    currentPage.canvasBackground.gradient?.colors?.[0] ||
                    "#ffffff"
                  }
                  onChange={(e) => {
                    const colors = [
                      ...(currentPage.canvasBackground.gradient?.colors || [
                        "#ffffff",
                        "#000000",
                      ]),
                    ];
                    colors[0] = e.target.value;
                    onUpdateCanvasBackground({
                      gradient: {
                        ...currentPage.canvasBackground.gradient,
                        colors,
                        type:
                          currentPage.canvasBackground.gradient?.type ||
                          "linear",
                      },
                    });
                  }}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="text"
                  value={
                    currentPage.canvasBackground.gradient?.colors?.[0] ||
                    "#ffffff"
                  }
                  onChange={(e) => {
                    const colors = [
                      ...(currentPage.canvasBackground.gradient?.colors || [
                        "#ffffff",
                        "#000000",
                      ]),
                    ];
                    colors[0] = e.target.value;
                    onUpdateCanvasBackground({
                      gradient: {
                        ...currentPage.canvasBackground.gradient,
                        colors,
                        type:
                          currentPage.canvasBackground.gradient?.type ||
                          "linear",
                      },
                    });
                  }}
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label>Color 2</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={
                    currentPage.canvasBackground.gradient?.colors?.[1] ||
                    "#000000"
                  }
                  onChange={(e) => {
                    const colors = [
                      ...(currentPage.canvasBackground.gradient?.colors || [
                        "#ffffff",
                        "#000000",
                      ]),
                    ];
                    colors[1] = e.target.value;
                    onUpdateCanvasBackground({
                      gradient: {
                        ...currentPage.canvasBackground.gradient,
                        colors,
                        type:
                          currentPage.canvasBackground.gradient?.type ||
                          "linear",
                      },
                    });
                  }}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="text"
                  value={
                    currentPage.canvasBackground.gradient?.colors?.[1] ||
                    "#000000"
                  }
                  onChange={(e) => {
                    const colors = [
                      ...(currentPage.canvasBackground.gradient?.colors || [
                        "#ffffff",
                        "#000000",
                      ]),
                    ];
                    colors[1] = e.target.value;
                    onUpdateCanvasBackground({
                      gradient: {
                        ...currentPage.canvasBackground.gradient,
                        colors,
                        type:
                          currentPage.canvasBackground.gradient?.type ||
                          "linear",
                      },
                    });
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}

        {currentPage?.canvasBackground.type === "image" && (
          <div className="space-y-3">
            <div>
              <Label>Image URL</Label>
              <Input
                type="text"
                value={currentPage.canvasBackground.image?.url || ""}
                onChange={(e) =>
                  onUpdateCanvasBackground({
                    image: {
                      ...currentPage.canvasBackground.image,
                      url: e.target.value,
                      size: currentPage.canvasBackground.image?.size || "cover",
                      position:
                        currentPage.canvasBackground.image?.position ||
                        "center",
                    },
                  })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <Label>Image Size</Label>
              <Select
                value={currentPage.canvasBackground.image?.size || "cover"}
                onValueChange={(value: "cover" | "contain" | "repeat") =>
                  onUpdateCanvasBackground({
                    image: {
                      ...currentPage.canvasBackground.image,
                      size: value,
                      url: currentPage.canvasBackground.image?.url || "",
                      position:
                        currentPage.canvasBackground.image?.position ||
                        "center",
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="repeat">Repeat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Image Position</Label>
              <Select
                value={currentPage.canvasBackground.image?.position || "center"}
                onValueChange={(value) =>
                  onUpdateCanvasBackground({
                    image: {
                      ...currentPage.canvasBackground.image,
                      position: value,
                      url: currentPage.canvasBackground.image?.url || "",
                      size: currentPage.canvasBackground.image?.size || "cover",
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="top left">Top Left</SelectItem>
                  <SelectItem value="top right">Top Right</SelectItem>
                  <SelectItem value="bottom left">Bottom Left</SelectItem>
                  <SelectItem value="bottom right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderElementProperties = () => {
    if (!selectedElement) {
      return (
        <div className="flex items-center justify-center h-32 text-gray-500">
          Select an element to edit its properties
        </div>
      );
    }

    const resolvedChartColors =
      Array.isArray(selectedElement.properties?.colors) &&
      selectedElement.properties.colors.length > 0
        ? selectedElement.properties.colors
        : DEFAULT_CHART_COLORS;

    const getMutableChartColors = () =>
      Array.isArray(selectedElement.properties?.colors) &&
      selectedElement.properties.colors.length > 0
        ? [...selectedElement.properties.colors]
        : [...DEFAULT_CHART_COLORS];

    const handleSliceColorChange = (value: string, index: number) => {
      const nextColors = getMutableChartColors();
      nextColors[index] = value;
      onUpdateElement("colors", nextColors);
    };

    const handleAddSliceColor = () => {
      const basePalette = [...DEFAULT_CHART_COLORS, "#0ea5e9", "#f43f5e", "#facc15"];
      const nextColors = getMutableChartColors();
      const suggested = basePalette[nextColors.length % basePalette.length];
      onUpdateElement("colors", [...nextColors, suggested]);
    };

    const handleRemoveSliceColor = (index: number) => {
      const nextColors = getMutableChartColors();
      if (nextColors.length <= 2) return;
      nextColors.splice(index, 1);
      onUpdateElement("colors", [...nextColors]);
    };

    return (
      <div className="space-y-4">
        {/* Element Actions */}
        <Card className="border-0 shadow-sm bg-gray-50/50">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {/* Action Buttons Row */}
              <div className="flex gap-3 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onToggleElementVisibility}
                  className="w-10 h-10 p-0 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  title={selectedElement.properties.hidden ? "Show" : "Hide"}
                >
                  {selectedElement.properties.hidden ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onToggleElementLock}
                  className="w-10 h-10 p-0 hover:bg-orange-50 hover:border-orange-200 transition-colors"
                  title={selectedElement.properties.locked ? "Unlock" : "Lock"}
                >
                  {selectedElement.properties.locked ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Unlock className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDuplicateElement}
                  className="w-10 h-10 p-0 hover:bg-green-50 hover:border-green-200 transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-5 h-5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDeleteElement}
                  className="w-10 h-10 p-0 hover:bg-red-50 hover:border-red-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>

              {/* Layering Controls Row */}
              <div className="flex gap-3 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMoveElementLayer("up")}
                  className="w-10 h-10 p-0 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  title="Bring Forward"
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMoveElementLayer("down")}
                  className="w-10 h-10 p-0 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  title="Send Backward"
                >
                  <ArrowDown className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="transform" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transform">Transform</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <TabsContent value="transform" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Move className="w-4 h-4" />
                  Position & Size
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X Position</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.x)}
                      onChange={(e) =>
                        onUpdateElementTransform(
                          "x",
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Y Position</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.y)}
                      onChange={(e) =>
                        onUpdateElementTransform(
                          "y",
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Width</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.width)}
                      onChange={(e) =>
                        onUpdateElementTransform(
                          "width",
                          Number.parseFloat(e.target.value) || 1
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Height</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedElement.height)}
                      onChange={(e) =>
                        onUpdateElementTransform(
                          "height",
                          Number.parseFloat(e.target.value) || 1
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <RotateCw className="w-3 h-3" />
                    Rotation: {selectedElement.rotation}°
                  </Label>
                  <Slider
                    value={[selectedElement.rotation]}
                    onValueChange={([value]) =>
                      onUpdateElementTransform("rotation", value)
                    }
                    min={-180}
                    max={180}
                    step={1}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Opacity: {selectedElement.opacity}%</Label>
                  <Slider
                    value={[selectedElement.opacity]}
                    onValueChange={([value]) =>
                      onUpdateElementTransform("opacity", value)
                    }
                    min={0}
                    max={100}
                    step={1}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="style" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(selectedElement.type === "textfield" ||
                  selectedElement.type === "textarea" ||
                  selectedElement.type === "button" ||
                  selectedElement.type === "rectangle" ||
                  selectedElement.type === "circle") && (
                  <div>
                    <Label>Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={
                          selectedElement.properties.backgroundColor ||
                          "#ffffff"
                        }
                        onChange={(e) =>
                          onUpdateElement("backgroundColor", e.target.value)
                        }
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        type="text"
                        value={
                          selectedElement.properties.backgroundColor ||
                          "#ffffff"
                        }
                        onChange={(e) =>
                          onUpdateElement("backgroundColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}

                {(selectedElement.type === "textfield" ||
                  selectedElement.type === "textarea" ||
                  selectedElement.type === "button") && (
                  <div>
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={selectedElement.properties.color || "#000000"}
                        onChange={(e) =>
                          onUpdateElement("color", e.target.value)
                        }
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        type="text"
                        value={selectedElement.properties.color || "#000000"}
                        onChange={(e) =>
                          onUpdateElement("color", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}

                {(selectedElement.type === "textfield" ||
                  selectedElement.type === "textarea" ||
                  selectedElement.type === "button" ||
                  selectedElement.type === "TEXT_FIELD" ||
                  selectedElement.type === "text" ||
                  (selectedElement.type === "SHAPE" &&
                    selectedElement.properties.text !== undefined)) && (
                  <>
                    <div>
                      <Label>Font Family</Label>
                      <Select
                        value={
                          selectedElement.properties.fontFamily ||
                          "Poppins, system-ui, sans-serif"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontFamily", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Poppins, system-ui, sans-serif">
                            Poppins
                          </SelectItem>
                          <SelectItem value="Arial, sans-serif">
                            Arial
                          </SelectItem>
                          <SelectItem value="Helvetica, sans-serif">
                            Helvetica
                          </SelectItem>
                          <SelectItem value="Times New Roman, serif">
                            Times New Roman
                          </SelectItem>
                          <SelectItem value="Georgia, serif">
                            Georgia
                          </SelectItem>
                          <SelectItem value="Courier New, monospace">
                            Courier New
                          </SelectItem>
                          <SelectItem value="Verdana, sans-serif">
                            Verdana
                          </SelectItem>
                          <SelectItem value="Trebuchet MS, sans-serif">
                            Trebuchet MS
                          </SelectItem>
                          <SelectItem value="Impact, sans-serif">
                            Impact
                          </SelectItem>
                          <SelectItem value="Comic Sans MS, cursive">
                            Comic Sans MS
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.fontSize || 16}
                        onChange={(e) =>
                          onUpdateElement(
                            "fontSize",
                            Number.parseInt(e.target.value) || 16
                          )
                        }
                        min={8}
                        max={72}
                      />
                    </div>

                    <div>
                      <Label>Font Weight</Label>
                      <Select
                        value={
                          selectedElement.properties.fontWeight || "normal"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontWeight", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="600">Semi Bold</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="800">Extra Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Font Style</Label>
                      <Select
                        value={selectedElement.properties.fontStyle || "normal"}
                        onValueChange={(value) =>
                          onUpdateElement("fontStyle", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="italic">Italic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Text Decoration</Label>
                      <Select
                        value={
                          selectedElement.properties.textDecoration || "none"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("textDecoration", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="underline">Underline</SelectItem>
                          <SelectItem value="line-through">
                            Strikethrough
                          </SelectItem>
                          <SelectItem value="overline">Overline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Text Alignment</Label>
                      <Select
                        value={selectedElement.properties.textAlign || "left"}
                        onValueChange={(value) =>
                          onUpdateElement("textAlign", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="justify">Justify</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Text Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Line Height</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.lineHeight || 1.5}
                        onChange={(e) =>
                          onUpdateElement(
                            "lineHeight",
                            Number.parseFloat(e.target.value) || 1.5
                          )
                        }
                        min={0.5}
                        max={3}
                        step={0.1}
                      />
                    </div>

                    <div>
                      <Label>Letter Spacing (px)</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.letterSpacing || 0}
                        onChange={(e) =>
                          onUpdateElement(
                            "letterSpacing",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        min={-5}
                        max={10}
                        step={0.1}
                      />
                    </div>

                    <div>
                      <Label>Text Align</Label>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={
                            selectedElement.properties.textAlign === "left"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => onUpdateElement("textAlign", "left")}
                        >
                          <AlignLeft className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            selectedElement.properties.textAlign === "center"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => onUpdateElement("textAlign", "center")}
                        >
                          <AlignCenter className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            selectedElement.properties.textAlign === "right"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => onUpdateElement("textAlign", "right")}
                        >
                          <AlignRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Checkbox Style Properties */}
                {selectedElement.type === "checkbox" && (
                  <>
                    <div>
                      <Label>Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.size || 16}
                        onChange={(e) =>
                          onUpdateElement(
                            "size",
                            Number.parseInt(e.target.value) || 16
                          )
                        }
                        min={12}
                        max={32}
                      />
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Checked Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.checkedColor || "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("checkedColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.checkedColor || "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("checkedColor", e.target.value)
                          }
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 4}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 4
                          )
                        }
                        min={0}
                        max={16}
                      />
                    </div>
                  </>
                )}

                {/* Radio Button Style Properties */}
                {selectedElement.type === "radiobutton" && (
                  <>
                    <div>
                      <Label>Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.size || 16}
                        onChange={(e) =>
                          onUpdateElement(
                            "size",
                            Number.parseInt(e.target.value) || 16
                          )
                        }
                        min={12}
                        max={32}
                      />
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Selected Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.selectedColor ||
                            "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("selectedColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.selectedColor ||
                            "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("selectedColor", e.target.value)
                          }
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Dropdown/Select Style Properties */}
                {selectedElement.type === "dropdown" && (
                  <>
                    <div>
                      <Label>Font Family</Label>
                      <Select
                        value={
                          selectedElement.properties.fontFamily ||
                          "Poppins, system-ui, sans-serif"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontFamily", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Poppins, system-ui, sans-serif">
                            Poppins
                          </SelectItem>
                          <SelectItem value="Arial, sans-serif">
                            Arial
                          </SelectItem>
                          <SelectItem value="Helvetica, sans-serif">
                            Helvetica
                          </SelectItem>
                          <SelectItem value="Times New Roman, serif">
                            Times New Roman
                          </SelectItem>
                          <SelectItem value="Georgia, serif">
                            Georgia
                          </SelectItem>
                          <SelectItem value="Courier New, monospace">
                            Courier New
                          </SelectItem>
                          <SelectItem value="Verdana, sans-serif">
                            Verdana
                          </SelectItem>
                          <SelectItem value="Trebuchet MS, sans-serif">
                            Trebuchet MS
                          </SelectItem>
                          <SelectItem value="Impact, sans-serif">
                            Impact
                          </SelectItem>
                          <SelectItem value="Comic Sans MS, cursive">
                            Comic Sans MS
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.fontSize || 14}
                        onChange={(e) =>
                          onUpdateElement(
                            "fontSize",
                            Number.parseInt(e.target.value) || 14
                          )
                        }
                        min={8}
                        max={72}
                      />
                    </div>
                    <div>
                      <Label>Font Weight</Label>
                      <Select
                        value={
                          selectedElement.properties.fontWeight || "normal"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontWeight", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="600">Semi Bold</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="800">Extra Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Text Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Background Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderWidth || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderWidth",
                            Number.parseInt(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 6}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 6
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Padding</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.padding || 8}
                        onChange={(e) =>
                          onUpdateElement(
                            "padding",
                            Number.parseInt(e.target.value) || 8
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                  </>
                )}

                {/* Toggle/Switch Style Properties */}
                {selectedElement.type === "toggle" && (
                  <>
                    <div>
                      <Label>Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.size || 20}
                        onChange={(e) =>
                          onUpdateElement(
                            "size",
                            Number.parseInt(e.target.value) || 20
                          )
                        }
                        min={16}
                        max={40}
                      />
                    </div>
                    <div>
                      <Label>Background Color (Off)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColorOff ||
                            "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement(
                              "backgroundColorOff",
                              e.target.value
                            )
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColorOff ||
                            "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement(
                              "backgroundColorOff",
                              e.target.value
                            )
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Background Color (On)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColorOn ||
                            "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColorOn", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColorOn ||
                            "#3b82f6"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColorOn", e.target.value)
                          }
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Toggle Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.toggleColor || "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("toggleColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.toggleColor || "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("toggleColor", e.target.value)
                          }
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 12}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 12
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                  </>
                )}

                {/* Phone Field Style Properties */}
                {selectedElement.type === "phone" && (
                  <>
                    <div>
                      <Label>Font Family</Label>
                      <Select
                        value={
                          selectedElement.properties.fontFamily ||
                          "Poppins, system-ui, sans-serif"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontFamily", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Poppins, system-ui, sans-serif">
                            Poppins
                          </SelectItem>
                          <SelectItem value="Arial, sans-serif">
                            Arial
                          </SelectItem>
                          <SelectItem value="Helvetica, sans-serif">
                            Helvetica
                          </SelectItem>
                          <SelectItem value="Times New Roman, serif">
                            Times New Roman
                          </SelectItem>
                          <SelectItem value="Georgia, serif">
                            Georgia
                          </SelectItem>
                          <SelectItem value="Courier New, monospace">
                            Courier New
                          </SelectItem>
                          <SelectItem value="Verdana, sans-serif">
                            Verdana
                          </SelectItem>
                          <SelectItem value="Trebuchet MS, sans-serif">
                            Trebuchet MS
                          </SelectItem>
                          <SelectItem value="Impact, sans-serif">
                            Impact
                          </SelectItem>
                          <SelectItem value="Comic Sans MS, cursive">
                            Comic Sans MS
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.fontSize || 14}
                        onChange={(e) =>
                          onUpdateElement(
                            "fontSize",
                            Number.parseInt(e.target.value) || 14
                          )
                        }
                        min={8}
                        max={72}
                      />
                    </div>
                    <div>
                      <Label>Font Weight</Label>
                      <Select
                        value={
                          selectedElement.properties.fontWeight || "normal"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontWeight", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="600">Semi Bold</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="800">Extra Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Text Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Background Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderWidth || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderWidth",
                            Number.parseInt(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 6}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 6
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Padding</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.padding || 8}
                        onChange={(e) =>
                          onUpdateElement(
                            "padding",
                            Number.parseInt(e.target.value) || 8
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Placeholder Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.placeholderColor ||
                            "#9ca3af"
                          }
                          onChange={(e) =>
                            onUpdateElement("placeholderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.placeholderColor ||
                            "#9ca3af"
                          }
                          onChange={(e) =>
                            onUpdateElement("placeholderColor", e.target.value)
                          }
                          placeholder="#9ca3af"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Date Picker Style Properties */}
                {(selectedElement.type === "calendar" ||
                  selectedElement.type === "date") && (
                  <>
                    <div>
                      <Label>Font Family</Label>
                      <Select
                        value={
                          selectedElement.properties.fontFamily ||
                          "Poppins, system-ui, sans-serif"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontFamily", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Poppins, system-ui, sans-serif">
                            Poppins
                          </SelectItem>
                          <SelectItem value="Arial, sans-serif">
                            Arial
                          </SelectItem>
                          <SelectItem value="Helvetica, sans-serif">
                            Helvetica
                          </SelectItem>
                          <SelectItem value="Times New Roman, serif">
                            Times New Roman
                          </SelectItem>
                          <SelectItem value="Georgia, serif">
                            Georgia
                          </SelectItem>
                          <SelectItem value="Courier New, monospace">
                            Courier New
                          </SelectItem>
                          <SelectItem value="Verdana, sans-serif">
                            Verdana
                          </SelectItem>
                          <SelectItem value="Trebuchet MS, sans-serif">
                            Trebuchet MS
                          </SelectItem>
                          <SelectItem value="Impact, sans-serif">
                            Impact
                          </SelectItem>
                          <SelectItem value="Comic Sans MS, cursive">
                            Comic Sans MS
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.fontSize || 14}
                        onChange={(e) =>
                          onUpdateElement(
                            "fontSize",
                            Number.parseInt(e.target.value) || 14
                          )
                        }
                        min={8}
                        max={72}
                      />
                    </div>
                    <div>
                      <Label>Font Weight</Label>
                      <Select
                        value={
                          selectedElement.properties.fontWeight || "normal"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("fontWeight", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="600">Semi Bold</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="800">Extra Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Text Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={selectedElement.properties.color || "#000000"}
                          onChange={(e) =>
                            onUpdateElement("color", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Background Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderWidth || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderWidth",
                            Number.parseInt(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 6}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 6
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Padding</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.padding || 8}
                        onChange={(e) =>
                          onUpdateElement(
                            "padding",
                            Number.parseInt(e.target.value) || 8
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Calendar Icon Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.iconColor || "#6b7280"
                          }
                          onChange={(e) =>
                            onUpdateElement("iconColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.iconColor || "#6b7280"
                          }
                          onChange={(e) =>
                            onUpdateElement("iconColor", e.target.value)
                          }
                          placeholder="#6b7280"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Line Style Properties */}
                {selectedElement.type === "line" && (
                  <>
                    <div>
                      <Label>Stroke Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.strokeColor || "#000000"
                          }
                          onChange={(e) =>
                            onUpdateElement("strokeColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.strokeColor || "#000000"
                          }
                          onChange={(e) =>
                            onUpdateElement("strokeColor", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Stroke Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.strokeWidth || 2}
                        onChange={(e) =>
                          onUpdateElement(
                            "strokeWidth",
                            Number.parseInt(e.target.value) || 2
                          )
                        }
                        min={1}
                        max={20}
                      />
                    </div>
                    <div>
                      <Label>Stroke Style</Label>
                      <Select
                        value={
                          selectedElement.properties.strokeStyle || "solid"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("strokeStyle", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="dashed">Dashed</SelectItem>
                          <SelectItem value="dotted">Dotted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Opacity</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.strokeOpacity || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "strokeOpacity",
                            Number.parseFloat(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </>
                )}

                {/* Arrow Style Properties */}
                {selectedElement.type === "arrow" && (
                  <>
                    <div>
                      <Label>Stroke Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.strokeColor || "#000000"
                          }
                          onChange={(e) =>
                            onUpdateElement("strokeColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.strokeColor || "#000000"
                          }
                          onChange={(e) =>
                            onUpdateElement("strokeColor", e.target.value)
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Stroke Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.strokeWidth || 2}
                        onChange={(e) =>
                          onUpdateElement(
                            "strokeWidth",
                            Number.parseInt(e.target.value) || 2
                          )
                        }
                        min={1}
                        max={20}
                      />
                    </div>
                    <div>
                      <Label>Stroke Style</Label>
                      <Select
                        value={
                          selectedElement.properties.strokeStyle || "solid"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("strokeStyle", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="dashed">Dashed</SelectItem>
                          <SelectItem value="dotted">Dotted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Arrow Head Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.arrowHeadSize || 8}
                        onChange={(e) =>
                          onUpdateElement(
                            "arrowHeadSize",
                            Number.parseInt(e.target.value) || 8
                          )
                        }
                        min={4}
                        max={20}
                      />
                    </div>
                    <div>
                      <Label>Arrow Head Style</Label>
                      <Select
                        value={
                          selectedElement.properties.arrowHeadStyle ||
                          "triangle"
                        }
                        onValueChange={(value) =>
                          onUpdateElement("arrowHeadStyle", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="triangle">Triangle</SelectItem>
                          <SelectItem value="circle">Circle</SelectItem>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="diamond">Diamond</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Opacity</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.strokeOpacity || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "strokeOpacity",
                            Number.parseFloat(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </>
                )}

                {/* Icon Style Properties */}
                {selectedElement.type.startsWith("icon-") && (
                  <>
                    <div>
                      <Label>Icon Size</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.iconSize || 16}
                        onChange={(e) =>
                          onUpdateElement(
                            "iconSize",
                            Number.parseInt(e.target.value) || 16
                          )
                        }
                        min={8}
                        max={128}
                      />
                    </div>
                    <div>
                      <Label>Icon Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.iconColor || "#6b7280"
                          }
                          onChange={(e) =>
                            onUpdateElement("iconColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.iconColor || "#6b7280"
                          }
                          onChange={(e) =>
                            onUpdateElement("iconColor", e.target.value)
                          }
                          placeholder="#6b7280"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Background Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "transparent"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.backgroundColor ||
                            "transparent"
                          }
                          onChange={(e) =>
                            onUpdateElement("backgroundColor", e.target.value)
                          }
                          placeholder="transparent"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderRadius || 0}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderRadius",
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Padding</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.padding || 0}
                        onChange={(e) =>
                          onUpdateElement(
                            "padding",
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        max={50}
                      />
                    </div>
                    <div>
                      <Label>Opacity</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.iconOpacity || 1}
                        onChange={(e) =>
                          onUpdateElement(
                            "iconOpacity",
                            Number.parseFloat(e.target.value) || 1
                          )
                        }
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                    <div>
                      <Label>Rotation (degrees)</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.iconRotation || 0}
                        onChange={(e) =>
                          onUpdateElement(
                            "iconRotation",
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        max={360}
                      />
                    </div>
                    <div>
                      <Label>Border Width</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.borderWidth || 0}
                        onChange={(e) =>
                          onUpdateElement(
                            "borderWidth",
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          className="w-12 h-8 p-1 border rounded cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={
                            selectedElement.properties.borderColor || "#d1d5db"
                          }
                          onChange={(e) =>
                            onUpdateElement("borderColor", e.target.value)
                          }
                          placeholder="#d1d5db"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </>
                )}

                {(selectedElement.type === "button" ||
                  selectedElement.type === "textfield" ||
                  selectedElement.type === "textarea" ||
                  selectedElement.type === "rectangle") && (
                  <div>
                    <Label>Border Radius</Label>
                    <Input
                      type="number"
                      value={selectedElement.properties.borderRadius || 0}
                      onChange={(e) =>
                        onUpdateElement(
                          "borderRadius",
                          Number.parseInt(e.target.value) || 0
                        )
                      }
                      min={0}
                      max={50}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Element Name */}
                <div>
                  <Label>Element Name</Label>
                  <Input
                    type="text"
                    value={selectedElement.properties.name || ""}
                    onChange={(e) => onUpdateElement("name", e.target.value)}
                    placeholder="Enter element name..."
                  />
                </div>
                {(() => {
                  const isButton =
                    selectedElement.type === "button" ||
                    selectedElement.type === "BUTTON";
                  console.log(
                    "🔍 DEBUG: selectedElement.type =",
                    selectedElement.type
                  );
                  console.log("🔍 DEBUG: isButton =", isButton);
                  console.log("🔍 DEBUG: selectedElement =", selectedElement);
                  return isButton ? (
                    <>
                      <div>
                        <Label>Button Text</Label>
                        <Input
                          type="text"
                          value={selectedElement.properties.text || "Button"}
                          onChange={(e) =>
                            onUpdateElement("text", e.target.value)
                          }
                        />
                      </div>

                      {/* Submit Button Section */}
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <input
                            type="checkbox"
                            id="isSubmitButton"
                            checked={
                              selectedElement.properties.isSubmitButton || false
                            }
                            onChange={(e) =>
                              onUpdateElement(
                                "isSubmitButton",
                                e.target.checked
                              )
                            }
                            className="w-4 h-4 cursor-pointer"
                          />
                          <Label
                            htmlFor="isSubmitButton"
                            className="cursor-pointer font-medium"
                          >
                            Mark as Submit Button
                          </Label>
                        </div>

                        {/* Show form group selector if submit button is checked */}
                        {selectedElement.properties.isSubmitButton && (
                          <div>
                            <Label>Select Form Group</Label>
                            <select
                              value={
                                selectedElement.properties.formGroupId || ""
                              }
                              onChange={(e) =>
                                onUpdateElement("formGroupId", e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">
                                -- Select a form group --
                              </option>
                              {currentPage?.groups
                                ?.filter((g) => g.type === "form")
                                .map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null;
                })()}

                {(selectedElement.type === "TEXT_FIELD" ||
                  selectedElement.type === "text" ||
                  (selectedElement.type === "SHAPE" &&
                    selectedElement.properties.text !== undefined)) && (
                  <div>
                    <Label>Text Content</Label>
                    <textarea
                      value={
                        selectedElement.properties.text || "Click to edit text"
                      }
                      onChange={(e) => onUpdateElement("text", e.target.value)}
                      className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                      placeholder="Enter text content..."
                    />
                  </div>
                )}

                {(selectedElement.type === "textfield" ||
                  selectedElement.type === "textarea") && (
                  <>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        type="text"
                        value={selectedElement.properties.placeholder || ""}
                        onChange={(e) =>
                          onUpdateElement("placeholder", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Default Value</Label>
                      <Input
                        type="text"
                        value={selectedElement.properties.value || ""}
                        onChange={(e) =>
                          onUpdateElement("value", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}

                {selectedElement.type === "textarea" && (
                  <div>
                    <Label>Rows</Label>
                    <Input
                      type="number"
                      value={selectedElement.properties.rows || 4}
                      onChange={(e) =>
                        onUpdateElement(
                          "rows",
                          Number.parseInt(e.target.value) || 4
                        )
                      }
                      min={1}
                      max={20}
                    />
                  </div>
                )}

                {(selectedElement.type === "checkbox" ||
                  selectedElement.type === "radiobutton" ||
                  selectedElement.type === "toggle") && (
                  <>
                    <div>
                      <Label>Label</Label>
                      <Input
                        type="text"
                        value={selectedElement.properties.label || ""}
                        onChange={(e) =>
                          onUpdateElement("label", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={selectedElement.properties.checked || false}
                        onCheckedChange={(checked) =>
                          onUpdateElement("checked", checked)
                        }
                      />
                      <Label>Checked by default</Label>
                    </div>
                  </>
                )}

                {selectedElement.type === "dropdown" && (
                  <>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        type="text"
                        value={
                          selectedElement.properties.placeholder ||
                          "Select option"
                        }
                        onChange={(e) =>
                          onUpdateElement("placeholder", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Options (one per line)</Label>
                      <textarea
                        className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        rows={4}
                        value={(selectedElement.properties.options || []).join(
                          "\n"
                        )}
                        onChange={(e) =>
                          onUpdateElement(
                            "options",
                            e.target.value.split("\n").filter(Boolean)
                          )
                        }
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  </>
                )}

                {selectedElement.type === "phone" && (
                  <div>
                    <Label>Placeholder</Label>
                    <Input
                      type="text"
                      value={
                        selectedElement.properties.placeholder || "Phone number"
                      }
                      onChange={(e) =>
                        onUpdateElement("placeholder", e.target.value)
                      }
                    />
                  </div>
                )}

                {selectedElement.type === "password" && (
                  <>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        type="text"
                        value={
                          selectedElement.properties.placeholder ||
                          "Enter password"
                        }
                        onChange={(e) =>
                          onUpdateElement("placeholder", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="password-required"
                        checked={selectedElement.properties.required || false}
                        onChange={(e) =>
                          onUpdateElement("required", e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="password-required">Required Field</Label>
                    </div>
                    <div>
                      <Label>Minimum Length</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.minLength || 8}
                        onChange={(e) =>
                          onUpdateElement("minLength", parseInt(e.target.value))
                        }
                        min="1"
                        max="128"
                      />
                    </div>
                    <div>
                      <Label>Maximum Length</Label>
                      <Input
                        type="number"
                        value={selectedElement.properties.maxLength || 128}
                        onChange={(e) =>
                          onUpdateElement("maxLength", parseInt(e.target.value))
                        }
                        min="1"
                        max="256"
                      />
                    </div>
                  </>
                )}

                {/* Chart specific content */}
                {(selectedElement.type === "chart-bar" ||
                  selectedElement.type === "chart-line" ||
                  selectedElement.type === "chart-pie" ||
                  selectedElement.type === "chart-donut") && (
                  <>
                    {/* Database binding section */}
                    <div className="space-y-2">
                      <Label>Table</Label>
                      <Select
                        value={selectedElement.properties.tableName || ""}
                        onValueChange={(value) => {
                          onUpdateElement("tableName", value);
                          onUpdateElement("xKey", undefined);
                          onUpdateElement("valueKey", undefined);
                          onUpdateElement("yKey", undefined);
                          onUpdateElement("nameKey", undefined);
                          onUpdateElement("series", undefined);
                          onUpdateElement("data", []);
                          setTableColumns([]);
                          setDataWarning(null);
                          fetchTableColumns(value);
                        }}
                        disabled={tablesLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tablesLoading ? "Loading tables..." : "Select table"} />
                        </SelectTrigger>
                        <SelectContent>
                          {dbTables.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              {tablesLoading ? "Loading tables..." : "No tables available"}
                            </div>
                          ) : (
                            dbTables.map((table) => (
                              <SelectItem key={table.name} value={table.name}>
                                {table.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {selectedElement.type === "chart-line" || selectedElement.type === "chart-bar" ? (
                        <>
                          <div>
                            <Label>X-Axis Column</Label>
                            <Select
                              value={selectedElement.properties.xKey || ""}
                              onValueChange={(value) => {
                                onUpdateElement("xKey", value);
                                if (selectedElement.properties.tableName && (selectedElement.properties.valueKey || selectedElement.properties.yKey)) {
                                  fetchTableData(
                                    selectedElement.properties.tableName,
                                    value,
                                    selectedElement.properties.valueKey || selectedElement.properties.yKey
                                  );
                                }
                              }}
                              disabled={!selectedElement.properties.tableName || tableColumns.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tableDataLoading ? "Loading columns..." : "Select column"} />
                              </SelectTrigger>
                              <SelectContent>
                                {tableColumns.map((column) => (
                                  <SelectItem key={column.name} value={column.name}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Y-Axis Column</Label>
                            <Select
                              value={selectedElement.properties.valueKey || selectedElement.properties.yKey || ""}
                              onValueChange={(value) => {
                                onUpdateElement("valueKey", value);
                                onUpdateElement("yKey", value);
                                if (selectedElement.properties.tableName && selectedElement.properties.xKey) {
                                  fetchTableData(
                                    selectedElement.properties.tableName,
                                    selectedElement.properties.xKey,
                                    value
                                  );
                                }
                              }}
                              disabled={!selectedElement.properties.tableName || tableColumns.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tableDataLoading ? "Loading columns..." : "Select column"} />
                              </SelectTrigger>
                              <SelectContent>
                                {tableColumns.map((column) => (
                                  <SelectItem key={column.name} value={column.name}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label>Label Column</Label>
                            <Select
                              value={selectedElement.properties.nameKey || ""}
                              onValueChange={(value) => {
                                onUpdateElement("nameKey", value);
                                  onUpdateElement("xKey", value);
                                if (selectedElement.properties.tableName && (selectedElement.properties.valueKey || selectedElement.properties.yKey)) {
                                  fetchTableData(
                                    selectedElement.properties.tableName,
                                    value,
                                    selectedElement.properties.valueKey || selectedElement.properties.yKey
                                  );
                                }
                              }}
                              disabled={!selectedElement.properties.tableName || tableColumns.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tableDataLoading ? "Loading columns..." : "Select column"} />
                              </SelectTrigger>
                              <SelectContent>
                                {tableColumns.map((column) => (
                                  <SelectItem key={column.name} value={column.name}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Value Column</Label>
                            <Select
                              value={selectedElement.properties.valueKey || selectedElement.properties.yKey || ""}
                              onValueChange={(value) => {
                                onUpdateElement("valueKey", value);
                                onUpdateElement("yKey", value);
                                const labelKey = selectedElement.properties.nameKey || selectedElement.properties.xKey;
                                if (selectedElement.properties.tableName && labelKey) {
                                  fetchTableData(
                                    selectedElement.properties.tableName,
                                    labelKey,
                                    value
                                  );
                                }
                              }}
                              disabled={!selectedElement.properties.tableName || tableColumns.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tableDataLoading ? "Loading columns..." : "Select column"} />
                              </SelectTrigger>
                              <SelectContent>
                                {tableColumns.map((column) => (
                                  <SelectItem key={column.name} value={column.name}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    {selectedElement.type === "chart-line" && (
                      <div className="space-y-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={selectedElement.properties.showMarkers ?? true}
                            onCheckedChange={(val) => onUpdateElement("showMarkers", val)}
                          />
                          <Label>Show Line Markers</Label>
                        </div>
                        <div>
                          <Label>Line Color</Label>
                          <Input
                            type="color"
                            value={selectedElement.properties.lineColor || "#2563eb"}
                            onChange={(e) => onUpdateElement("lineColor", e.target.value)}
                            className="w-16 h-10 p-1 border rounded"
                          />
                        </div>
                      </div>
                    )}

                    {selectedElement.type === "chart-bar" && (
                      <div className="space-y-2">
                        <div>
                          <Label>Bar Width</Label>
                          <Input
                            type="number"
                            min={4}
                            max={100}
                            value={selectedElement.properties.barWidth || ""}
                            onChange={(e) =>
                              onUpdateElement(
                                "barWidth",
                                e.target.value === "" ? undefined : Number(e.target.value)
                              )
                            }
                            placeholder="Auto"
                          />
                        </div>
                        <div>
                          <Label>Bar Color</Label>
                          <Input
                            type="color"
                            value={selectedElement.properties.barColor || "#2563eb"}
                            onChange={(e) => onUpdateElement("barColor", e.target.value)}
                            className="w-16 h-10 p-1 border rounded"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedElement.type === "chart-pie" || selectedElement.type === "chart-donut") && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={selectedElement.properties.legend ?? true}
                          onCheckedChange={(checked) => onUpdateElement("legend", checked)}
                        />
                        <Label>Show Legend</Label>
                      </div>
                    )}

                    {isPieOrDonut && (
                      <div className="space-y-2">
                        <Label>Slice Colors</Label>
                        <div className="space-y-2">
                          {resolvedChartColors.map((color, index) => (
                            <div key={`${index}-${color}`} className="flex items-center gap-2">
                              <Input
                                type="color"
                                value={color}
                                onChange={(e) => handleSliceColorChange(e.target.value, index)}
                                className="w-16 h-10 p-1 border rounded"
                              />
                              <Input
                                type="text"
                                value={color}
                                onChange={(e) => handleSliceColorChange(e.target.value, index)}
                                className="flex-1"
                              />
                              {resolvedChartColors.length > 2 && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRemoveSliceColor(index)}
                                  aria-label="Remove color"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleAddSliceColor}
                          disabled={resolvedChartColors.length >= 8}
                        >
                          Add Color
                        </Button>
                      </div>
                    )}

                    {dataWarning && (
                      <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-md p-2">
                        {dataWarning}
                      </div>
                    )}

                    {/* Chart Title */}
                    <div>
                      <Label>Chart Title</Label>
                      <Input
                        type="text"
                        value={
                          selectedElement.properties.title || "Monthly Revenue"
                        }
                        onChange={(e) =>
                          onUpdateElement("title", e.target.value)
                        }
                        placeholder="Enter chart title..."
                      />
                    </div>

                    {/* Chart Description */}
                    <div>
                      <Label>Description</Label>
                      <Input
                        type="text"
                        value={selectedElement.properties.description || ""}
                        onChange={(e) =>
                          onUpdateElement("description", e.target.value)
                        }
                        placeholder="Enter description..."
                      />
                    </div>

                    {/* Show Header Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={selectedElement.properties.showHeader ?? true}
                        onCheckedChange={(checked) =>
                          onUpdateElement("showHeader", checked)
                        }
                      />
                      <Label>Show Header</Label>
                    </div>

                    {/* Show Legend Toggle */}
                    {selectedElement.type !== "chart-pie" && selectedElement.type !== "chart-donut" && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={selectedElement.properties.legend ?? true}
                          onCheckedChange={(checked) =>
                            onUpdateElement("legend", checked)
                          }
                        />
                        <Label>Show Legend</Label>
                      </div>
                    )}

                    {isLineOrBar && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={selectedElement.properties.showAxis ?? true}
                          onCheckedChange={(checked) =>
                            onUpdateElement("showAxis", checked)
                          }
                        />
                        <Label>Show Axes</Label>
                      </div>
                    )}

                    {/* Show Grid Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={selectedElement.properties.showGrid ?? true}
                        onCheckedChange={(checked) =>
                          onUpdateElement("showGrid", checked)
                        }
                      />
                      <Label>Show Grid</Label>
                    </div>

                    {/* Chart Data - JSON input */}
                   {/* Chart Data - JSON input */}
<div>
  <Label>Chart Data (JSON)</Label>
  <textarea
    className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    rows={8}
    value={
      selectedElement.properties.data
        ? JSON.stringify(selectedElement.properties.data, null, 2)
        : ''
    }
    onChange={(e) => {
      try {
        const parsedData = JSON.parse(e.target.value);
        onUpdateElement('data', parsedData);  // ✅ Pass parsed object, not string
      } catch (error) {
        // Invalid JSON - you can optionally show error message
        console.log('Invalid JSON:', error);
      }
    }}
    placeholder='[{"month": "Jan", "desktop": 186, "mobile": 80}]'
  />
</div>

                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto h-full flex-shrink-0">
      <div className="space-y-4">
        {renderGeneralProperties()}
        {selectedElement
          ? renderElementProperties()
          : showCanvasProperties
          ? renderCanvasProperties()
          : null}
      </div>
    </div>
  );
}