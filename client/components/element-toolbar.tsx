"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Type,
  Square,
  Circle,
  ImageIcon,
  Calendar,
  Phone,
  CheckSquare,
  ToggleLeft,
  Upload,
  ChevronDown,
  Triangle,
  Minus,
  ArrowRight,
  Star,
  Heart,
  Zap,
  Hand,
  Layers,
  Palette,
  Settings,
  EyeOff,
  Lock,
  Eye,
  Unlock,
  // Icon category icons
  Minimize2,
  Maximize2,
  X,
  RefreshCw,
  Info,
  HelpCircle,
  Search,
  Plus,
  Edit,
  Trash2,
  Save,
  Download,
  Home,
  ArrowLeft,
  ArrowRight as Forward,
} from "lucide-react";

interface ElementType {
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  category: "form" | "media" | "shapes" | "layout" | "icons" | "dashboard";
  description?: string;
}

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
  groupId?: string;
}

interface ElementGroup {
  id: string;
  name: string;
  elementIds: string[];
  collapsed: boolean;
}

interface ElementToolbarProps {
  onDragStart: (e: React.DragEvent, elementType: string) => void;
  canvasElements: CanvasElement[];
  selectedElement: CanvasElement | null;
  onSelectElement: (element: CanvasElement) => void;
  onUpdateElementProperty: (property: string, value: any) => void;
  onCreateGroup?: () => void;
  onUngroupElements?: (groupId: string) => void;
  selectedGroup?: ElementGroup | null;
}

// Helper function to generate user-friendly element names
const getElementDisplayName = (
  element: CanvasElement,
  allElements: CanvasElement[]
): string => {
  const elementType =
    element.type.charAt(0).toUpperCase() + element.type.slice(1);

  // Count elements of the same type to generate sequential numbers
  const sameTypeElements = allElements
    .filter((el) => el.type === element.type)
    .sort((a, b) => {
      // Sort by creation time (extracted from ID timestamp)
      const aTime = parseInt(a.id.split("-").pop() || "0");
      const bTime = parseInt(b.id.split("-").pop() || "0");
      return aTime - bTime;
    });

  const elementIndex = sameTypeElements.findIndex((el) => el.id === element.id);
  const displayNumber = elementIndex + 1;

  return `${elementType} ${displayNumber}`;
};

export function ElementToolbar({
  onDragStart,
  canvasElements,
  selectedElement,
  onSelectElement,
  onUpdateElementProperty,
  onCreateGroup,
  onUngroupElements,
  selectedGroup,
}: ElementToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<
    "form" | "media" | "shapes" | "layout" | "icons" | "dashboard"
  >("form");

  const elementTypes: ElementType[] = [
    // Form Elements
    {
      type: "textfield",
      icon: Type,
      label: "Text Field",
      category: "form",
      description: "Single line text input",
    },
    {
      type: "textarea",
      icon: Type,
      label: "Text Area",
      category: "form",
      description: "Multi-line text input",
    },
    {
      type: "button",
      icon: Square,
      label: "Button",
      category: "form",
      description: "Clickable button element",
    },
    {
      type: "checkbox",
      icon: CheckSquare,
      label: "Checkbox",
      category: "form",
      description: "Boolean selection input",
    },
    {
      type: "radiobutton",
      icon: Circle,
      label: "Radio Button",
      category: "form",
      description: "Single choice selection",
    },
    {
      type: "dropdown",
      icon: ChevronDown,
      label: "Dropdown",
      category: "form",
      description: "Select from options",
    },
    {
      type: "toggle",
      icon: ToggleLeft,
      label: "Toggle Switch",
      category: "form",
      description: "On/off switch control",
    },
    {
      type: "phone",
      icon: Phone,
      label: "Phone Field",
      category: "form",
      description: "Phone number input",
    },
    {
      type: "password",
      icon: Lock,
      label: "Password Field",
      category: "form",
      description: "Secure password input",
    },
    {
      type: "calendar",
      icon: Calendar,
      label: "Date Picker",
      category: "form",
      description: "Date selection input",
    },

    // Media Elements
    {
      type: "upload",
      icon: Upload,
      label: "File Upload",
      category: "media",
      description: "File upload component",
    },
    {
      type: "addfile",
      icon: Upload,
      label: "Add File",
      category: "media",
      description: "Drag & drop any file",
    },

    // Shape Elements
    {
      type: "rectangle",
      icon: Square,
      label: "Rectangle",
      category: "shapes",
      description: "Basic rectangle shape",
    },
    {
      type: "circle",
      icon: Circle,
      label: "Circle",
      category: "shapes",
      description: "Basic circle shape",
    },
    {
      type: "triangle",
      icon: Triangle,
      label: "Triangle",
      category: "shapes",
      description: "Basic triangle shape",
    },
    {
      type: "line",
      icon: Minus,
      label: "Line",
      category: "shapes",
      description: "Straight line element",
    },
    {
      type: "arrow",
      icon: ArrowRight,
      label: "Arrow",
      category: "shapes",
      description: "Arrow shape",
    },
    {
      type: "star",
      icon: Star,
      label: "Star",
      category: "shapes",
      description: "Star shape",
    },
    {
      type: "heart",
      icon: Heart,
      label: "Heart",
      category: "shapes",
      description: "Heart shape",
    },

    // Layout Elements
    {
      type: "frame",
      icon: Layers,
      label: "Frame",
      category: "layout",
      description: "Layout frame container",
    },
    {
      type: "divider",
      icon: Minus,
      label: "Divider",
      category: "layout",
      description: "Section divider",
    },

    // Icon Elements - Window Controls
    {
      type: "icon-minimize",
      icon: Minimize2,
      label: "Minimize",
      category: "icons",
      description: "Window minimize icon",
    },
    {
      type: "icon-maximize",
      icon: Maximize2,
      label: "Maximize",
      category: "icons",
      description: "Window maximize/restore icon",
    },
    {
      type: "icon-close",
      icon: X,
      label: "Close",
      category: "icons",
      description: "Window close icon",
    },

    // Icon Elements - App Utilities
    {
      type: "icon-settings",
      icon: Settings,
      label: "Settings",
      category: "icons",
      description: "Settings/configuration icon",
    },
    {
      type: "icon-refresh",
      icon: RefreshCw,
      label: "Refresh",
      category: "icons",
      description: "Refresh/reload icon",
    },
    {
      type: "icon-info",
      icon: Info,
      label: "Info",
      category: "icons",
      description: "Information icon",
    },
    {
      type: "icon-help",
      icon: HelpCircle,
      label: "Help",
      category: "icons",
      description: "Help/support icon",
    },
    {
      type: "icon-search",
      icon: Search,
      label: "Search",
      category: "icons",
      description: "Search icon",
    },

    // Icon Elements - Data Actions
    {
      type: "icon-add",
      icon: Plus,
      label: "Add",
      category: "icons",
      description: "Add/create icon",
    },
    {
      type: "icon-edit",
      icon: Edit,
      label: "Edit",
      category: "icons",
      description: "Edit/modify icon",
    },
    {
      type: "icon-delete",
      icon: Trash2,
      label: "Delete",
      category: "icons",
      description: "Delete/trash icon",
    },
    {
      type: "icon-save",
      icon: Save,
      label: "Save",
      category: "icons",
      description: "Save icon",
    },
    {
      type: "icon-download",
      icon: Download,
      label: "Download",
      category: "icons",
      description: "Download icon",
    },
    {
      type: "icon-upload",
      icon: Upload,
      label: "Upload",
      category: "icons",
      description: "Upload icon",
    },

    // Icon Elements - Navigation
    {
      type: "icon-home",
      icon: Home,
      label: "Home",
      category: "icons",
      description: "Home/dashboard icon",
    },
    {
      type: "icon-back",
      icon: ArrowLeft,
      label: "Back",
      category: "icons",
      description: "Back/previous icon",
    },
    {
      type: "icon-forward",
      icon: Forward,
      label: "Forward",
      category: "icons",
      description: "Forward/next icon",
    },
  ];

  const categories = [
    {
      id: "form" as const,
      label: "Form",
      icon: Type,
      description: "Input and form controls",
    },
    {
      id: "media" as const,
      label: "Media",
      icon: ImageIcon,
      description: "Images and media elements",
    },
    {
      id: "shapes" as const,
      label: "Shapes",
      icon: Circle,
      description: "Basic geometric shapes",
    },
    {
      id: "layout" as const,
      label: "Layers",
      icon: Layers,
      description: "Layers and structure elements",
    },
    {
      id: "icons" as const,
      label: "Icons",
      icon: Star,
      description: "UI and action icons",
    },
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: Settings,
      description: "Dashboard components (coming soon)",
    },
  ];

  const filteredElements = elementTypes.filter(
    (element) => element.category === activeCategory
  );

  const handleElementDragStart = (e: React.DragEvent, elementType: string) => {
    e.dataTransfer.effectAllowed = "copy";
    onDragStart(e, elementType);
  };

  const renderElementCard = (element: ElementType) => {
    const Icon = element.icon;
    return (
      <div
        key={element.type}
        draggable
        onDragStart={(e) => handleElementDragStart(e, element.type)}
        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-grab active:cursor-grabbing active:scale-95"
        title={element.description}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-all duration-200 group-hover:scale-110">
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
            {element.label}
          </span>
        </div>

        {/* Drag indicator */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Hand className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Elements
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Drag elements onto the canvas
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(value) => setActiveCategory(value as any)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-2 gap-1 h-auto p-1 dark:bg-gray-800">
            {categories.slice(0, 2).map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex flex-col items-center gap-1 py-2 px-2 text-xs data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <Icon className="w-3 h-3" />
                  {category.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsList className="grid w-full grid-cols-2 gap-1 h-auto p-1 mt-1 dark:bg-gray-800">
            {categories.slice(2).map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex flex-col items-center gap-1 py-2 px-2 text-xs data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <Icon className="w-3 h-3" />
                  {category.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Elements Grid */}
        <div className="flex-1 px-4 pb-4 min-h-0 flex flex-col">
          {categories.map((category) => (
            <TabsContent
              key={category.id}
              value={category.id}
              className="mt-4 flex-1 min-h-0 flex flex-col"
            >
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {category.label}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {category.description}
                </p>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 pr-2 pb-2">
                  {elementTypes
                    .filter((element) => element.category === category.id)
                    .map(renderElementCard)}
                </div>

                {/* Layers section for Layout tab */}
                {category.id === "layout" && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          Layers
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {onCreateGroup && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onCreateGroup}
                            className="h-6 px-2 text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                            title="Group selected elements"
                          >
                            Group
                          </Button>
                        )}
                        {selectedGroup && onUngroupElements && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUngroupElements(selectedGroup.id)}
                            className="h-6 px-2 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/40"
                            title="Ungroup selected group"
                          >
                            Ungroup
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Click to select • Double-click to rename
                    </div>

                    <ScrollArea className="h-32">
                      <div className="space-y-0.5">
                        {canvasElements
                          .filter((element) => {
                            const elementType = elementTypes.find(
                              (et) => et.type === element.type
                            );
                            const isLayoutElement =
                              elementType?.category === "layout";
                            return (
                              !isLayoutElement || !element.properties.hidden
                            );
                          })
                          .sort((a, b) => b.zIndex - a.zIndex)
                          .map((element) => {
                            const isSelected =
                              selectedElement?.id === element.id;
                            const isHidden = element.properties.hidden;
                            const isLocked = element.properties.locked;

                            return (
                              <div
                                key={element.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-all duration-200 hover:scale-102 ${
                                  isSelected
                                    ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                                onClick={() => onSelectElement(element)}
                              >
                                {/* Element Icon */}
                                <div className="w-4 h-4 flex items-center justify-center dark:text-gray-300">
                                  {element.type === "textfield" && (
                                    <Type className="w-3 h-3" />
                                  )}
                                  {element.type === "textarea" && (
                                    <Type className="w-3 h-3" />
                                  )}
                                  {element.type === "button" && (
                                    <Square className="w-3 h-3" />
                                  )}
                                  {element.type === "checkbox" && (
                                    <CheckSquare className="w-3 h-3" />
                                  )}
                                  {element.type === "radiobutton" && (
                                    <Circle className="w-3 h-3" />
                                  )}
                                  {element.type === "dropdown" && (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                  {element.type === "toggle" && (
                                    <ToggleLeft className="w-3 h-3" />
                                  )}
                                  {element.type === "phone" && (
                                    <Phone className="w-3 h-3" />
                                  )}
                                  {element.type === "calendar" && (
                                    <Calendar className="w-3 h-3" />
                                  )}
                                  {element.type === "upload" && (
                                    <Upload className="w-3 h-3" />
                                  )}
                                  {element.type === "media" && (
                                    <ImageIcon className="w-3 h-3" />
                                  )}
                                  {element.type === "rectangle" && (
                                    <Square className="w-3 h-3" />
                                  )}
                                  {element.type === "circle" && (
                                    <Circle className="w-3 h-3" />
                                  )}
                                  {element.type === "triangle" && (
                                    <Triangle className="w-3 h-3" />
                                  )}
                                  {element.type === "line" && (
                                    <Minus className="w-3 h-3" />
                                  )}
                                  {element.type === "arrow" && (
                                    <ArrowRight className="w-3 h-3" />
                                  )}
                                  {element.type === "star" && (
                                    <Star className="w-3 h-3" />
                                  )}
                                  {element.type === "heart" && (
                                    <Heart className="w-3 h-3" />
                                  )}
                                  {element.type === "frame" && (
                                    <Layers className="w-3 h-3" />
                                  )}
                                  {element.type === "divider" && (
                                    <Minus className="w-3 h-3" />
                                  )}
                                </div>

                                {/* Element Name */}
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 px-1 py-0.5 rounded transition-colors duration-200"
                                    onDoubleClick={() => {
                                      const newName = prompt(
                                        "Enter new name:",
                                        element.properties.name || ""
                                      );
                                      if (newName !== null) {
                                        onUpdateElementProperty(
                                          "name",
                                          newName
                                        );
                                      }
                                    }}
                                    title={
                                      element.properties.name ||
                                      getElementDisplayName(
                                        element,
                                        canvasElements
                                      )
                                    }
                                  >
                                    {element.properties.name ||
                                      getElementDisplayName(
                                        element,
                                        canvasElements
                                      )}
                                  </div>
                                  <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {Math.round(element.width)} ×{" "}
                                    {Math.round(element.height)}
                                  </div>
                                </div>

                                {/* Element Status Icons and Controls */}
                                <div className="flex items-center gap-1">
                                  {/* Visibility Toggle */}
                                  <button
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateElementProperty(
                                        "hidden",
                                        !isHidden
                                      );
                                    }}
                                    title={isHidden ? "Show" : "Hide"}
                                  >
                                    {isHidden ? (
                                      <EyeOff className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                    ) : (
                                      <Eye className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                    )}
                                  </button>

                                  {/* Lock Toggle */}
                                  <button
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateElementProperty(
                                        "locked",
                                        !isLocked
                                      );
                                    }}
                                    title={isLocked ? "Unlock" : "Lock"}
                                  >
                                    {isLocked ? (
                                      <Lock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                    ) : (
                                      <Unlock className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                    )}
                                  </button>

                                  {/* Group Indicator */}
                                  {element.groupId && (
                                    <div
                                      className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"
                                      title="Grouped"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs bg-transparent dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 hover:scale-105 transition-all duration-200"
            onClick={() => {
              // Add functionality for templates
            }}
          >
            <Settings className="w-3 h-3 mr-2" />
            Element Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs bg-transparent dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 hover:scale-105 transition-all duration-200"
            onClick={() => {
              // Add functionality for custom elements
            }}
          >
            <Zap className="w-3 h-3 mr-2" />
            Custom Elements
          </Button>
        </div>
      </div>
    </div>
  );
}
