"use client";

import React, { useState, useEffect } from "react";
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
import { X, Plus, GripVertical, Database, Code, Globe } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";

interface DataSource {
  name: string;
  type: string;
  from: string;
  workflowName: string;
  fields: Array<{
    name: string;
    type: string;
    sample: any;
    samples?: any[]; // Array of samples for index-based preview
  }>;
  isArray: boolean;
  arrayItemType?: string;
}

interface TemplateSegment {
  id: string;
  type: "data" | "text";
  dataSource?: string;
  field?: string;
  arrayIndex?: number;
  textValue?: string;
}

interface DataBindingBuilderProps {
  appId: string;
  elementId: string;
  currentBindingPath: string;
  onSave: (bindingPath: string) => void;
  onCancel: () => void;
}

export function DataBindingBuilder({
  appId,
  elementId,
  currentBindingPath,
  onSave,
  onCancel,
}: DataBindingBuilderProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<TemplateSegment[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("");
  const [arrayIndex, setArrayIndex] = useState<string>("0");

  // Fetch available data sources
  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        setLoading(true);
        const response = await authenticatedFetch(
          `/api/canvas/${appId}/elements/${elementId}/available-data`
        );
        const data = await response.json();

        if (data.success) {
          setDataSources(data.dataSources || []);
        }
      } catch (error) {
        console.error("Failed to fetch data sources:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDataSources();
  }, [appId, elementId]);

  // Parse existing binding path into segments
  useEffect(() => {
    if (currentBindingPath && currentBindingPath.trim()) {
      // Try to parse template syntax {{...}}
      const templateRegex = /\{\{([^}]+)\}\}/g;
      const matches = [...currentBindingPath.matchAll(templateRegex)];

      if (matches.length > 0) {
        // Has template syntax
        const newSegments: TemplateSegment[] = [];
        let lastIndex = 0;

        matches.forEach((match, idx) => {
          // Add text before this match
          if (match.index! > lastIndex) {
            const textBefore = currentBindingPath.substring(
              lastIndex,
              match.index
            );
            if (textBefore) {
              newSegments.push({
                id: `text-${idx}-before`,
                type: "text",
                textValue: textBefore,
              });
            }
          }

          // Add data segment
          const bindingPath = match[1].trim();
          const parsed = parseBindingPath(bindingPath);
          newSegments.push({
            id: `data-${idx}`,
            type: "data",
            dataSource: parsed.dataSource,
            field: parsed.field,
            arrayIndex: parsed.arrayIndex,
          });

          lastIndex = match.index! + match[0].length;
        });

        // Add remaining text
        if (lastIndex < currentBindingPath.length) {
          const textAfter = currentBindingPath.substring(lastIndex);
          if (textAfter) {
            newSegments.push({
              id: `text-end`,
              type: "text",
              textValue: textAfter,
            });
          }
        }

        setSegments(newSegments);
      } else {
        // Old syntax - convert to single data segment
        const parsed = parseBindingPath(currentBindingPath);
        setSegments([
          {
            id: "data-0",
            type: "data",
            dataSource: parsed.dataSource,
            field: parsed.field,
            arrayIndex: parsed.arrayIndex,
          },
        ]);
      }
    }
  }, [currentBindingPath]);

  // Parse binding path like "dbFindResult[0].name" into parts
  const parseBindingPath = (path: string) => {
    const arrayMatch = path.match(
      /^([a-zA-Z_$][a-zA-Z0-9_$]*)\[(\d+)\]\.(.+)$/
    );
    if (arrayMatch) {
      return {
        dataSource: arrayMatch[1],
        arrayIndex: parseInt(arrayMatch[2]),
        field: arrayMatch[3],
      };
    }

    const simpleMatch = path.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.(.+)$/);
    if (simpleMatch) {
      return {
        dataSource: simpleMatch[1],
        arrayIndex: undefined,
        field: simpleMatch[2],
      };
    }

    return {
      dataSource: path,
      arrayIndex: undefined,
      field: undefined,
    };
  };

  // Add a data field segment
  const addDataSegment = () => {
    if (!selectedDataSource || !selectedField) return;

    const dataSource = dataSources.find((ds) => ds.name === selectedDataSource);
    const newSegment: TemplateSegment = {
      id: `data-${Date.now()}`,
      type: "data",
      dataSource: selectedDataSource,
      field: selectedField,
      arrayIndex: dataSource?.isArray ? parseInt(arrayIndex) : undefined,
    };

    setSegments([...segments, newSegment]);
    setSelectedDataSource("");
    setSelectedField("");
    setArrayIndex("0");
  };

  // Add a text segment
  const addTextSegment = () => {
    const newSegment: TemplateSegment = {
      id: `text-${Date.now()}`,
      type: "text",
      textValue: "",
    };
    setSegments([...segments, newSegment]);
  };

  // Remove a segment
  const removeSegment = (id: string) => {
    setSegments(segments.filter((s) => s.id !== id));
  };

  // Update text segment value
  const updateTextSegment = (id: string, value: string) => {
    setSegments(
      segments.map((s) => (s.id === id ? { ...s, textValue: value } : s))
    );
  };

  // Build final binding path from segments
  const buildBindingPath = (): string => {
    if (segments.length === 0) return "";

    if (segments.length === 1 && segments[0].type === "data") {
      // Single data segment - use old syntax for backward compatibility
      const seg = segments[0];
      const dataSource = dataSources.find((ds) => ds.name === seg.dataSource);
      if (dataSource?.isArray && seg.arrayIndex !== undefined) {
        return `${seg.dataSource}[${seg.arrayIndex}].${seg.field}`;
      }
      return `${seg.dataSource}.${seg.field}`;
    }

    // Multiple segments - use template syntax
    return segments
      .map((seg) => {
        if (seg.type === "text") {
          return seg.textValue || "";
        } else {
          const dataSource = dataSources.find(
            (ds) => ds.name === seg.dataSource
          );
          if (dataSource?.isArray && seg.arrayIndex !== undefined) {
            return `{{${seg.dataSource}[${seg.arrayIndex}].${seg.field}}}`;
          }
          return `{{${seg.dataSource}.${seg.field}}}`;
        }
      })
      .join("");
  };

  // Get preview value for a segment
  const getSegmentPreview = (segment: TemplateSegment): string => {
    if (segment.type === "text") {
      return segment.textValue || "";
    }

    const dataSource = dataSources.find((ds) => ds.name === segment.dataSource);
    if (!dataSource) return "?";

    const field = dataSource.fields.find((f) => f.name === segment.field);
    if (!field) return "?";

    // If array index is specified and we have multiple samples, use that index
    if (dataSource.isArray && segment.arrayIndex !== undefined && field.samples && field.samples.length > segment.arrayIndex) {
      const sampleValue = field.samples[segment.arrayIndex];
      if (sampleValue !== null && sampleValue !== undefined) {
        return String(sampleValue);
      }
    }

    // Fallback to first sample or default
    if (field.sample !== null && field.sample !== undefined) {
      return String(field.sample);
    }

    return `(${field.type})`;
  };

  const handleSave = () => {
    const bindingPath = buildBindingPath();
    onSave(bindingPath);
  };

  const getDataSourceIcon = (type: string) => {
    if (type === "array" || type === "object") return Database;
    if (type === "string") return Code;
    return Globe;
  };

  const selectedDataSourceObj = dataSources.find(
    (ds) => ds.name === selectedDataSource
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Configure Data Binding
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">
                Loading available data...
              </p>
            </div>
          ) : (
            <>
              {/* Available Data Sources */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Available Data Sources
                </h3>
                {dataSources.length === 0 ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No data sources found. Add workflow blocks (like db.find)
                      to this element to make data available.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dataSources.map((ds, idx) => {
                      const Icon = getDataSourceIcon(ds.type);
                      return (
                        <div
                          key={idx}
                          className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3"
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {ds.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {ds.from} • {ds.workflowName}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                Fields:{" "}
                                {ds.fields.map((f) => f.name).join(", ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Data Field */}
              {dataSources.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Add Data Field
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Data Source</Label>
                      <Select
                        value={selectedDataSource}
                        onValueChange={setSelectedDataSource}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {dataSources.map((ds) => (
                            <SelectItem key={ds.name} value={ds.name}>
                              {ds.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDataSourceObj && (
                      <>
                        <div>
                          <Label className="text-xs">Field</Label>
                          <Select
                            value={selectedField}
                            onValueChange={setSelectedField}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDataSourceObj.fields.map((field) => (
                                <SelectItem key={field.name} value={field.name}>
                                  {field.name} ({field.type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedDataSourceObj.isArray && (
                          <div>
                            <Label className="text-xs">Array Index</Label>
                            <Select
                              value={arrayIndex}
                              onValueChange={setArrayIndex}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">
                                  First item [0]
                                </SelectItem>
                                <SelectItem value="1">
                                  Second item [1]
                                </SelectItem>
                                <SelectItem value="2">
                                  Third item [2]
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={addDataSegment}
                      disabled={!selectedDataSource || !selectedField}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Data Field
                    </Button>
                    <Button
                      onClick={addTextSegment}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Text
                    </Button>
                  </div>
                </div>
              )}

              {/* Template Preview */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Template Builder
                </h3>

                {segments.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded p-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No segments added yet. Add data fields or text above to
                      build your template.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {segments.map((segment, idx) => (
                      <div
                        key={segment.id}
                        className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

                        {segment.type === "data" ? (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {segment.dataSource}
                                  {segment.arrayIndex !== undefined &&
                                    `[${segment.arrayIndex}]`}
                                  .{segment.field}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Preview: "{getSegmentPreview(segment)}"
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <Input
                              type="text"
                              value={segment.textValue || ""}
                              onChange={(e) =>
                                updateTextSegment(segment.id, e.target.value)
                              }
                              placeholder="Enter text..."
                            />
                          </div>
                        )}

                        <button
                          onClick={() => removeSegment(segment.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final Preview */}
                {segments.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
                      Final Preview:
                    </div>
                    <div className="text-sm text-blue-900 dark:text-blue-100 font-mono break-all">
                      {segments.map((seg) => getSegmentPreview(seg)).join("")}
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      Binding Path:{" "}
                      <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                        {buildBindingPath()}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={onCancel} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={segments.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Apply Binding
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
