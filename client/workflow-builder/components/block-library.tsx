"use client";

import React, { useState, useEffect, memo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  MousePointer,
  FileText,
  Clock,
  Database,
  Webhook,
  CheckCircle,
  Calendar,
  Users,
  GitBranch,
  Calculator,
  Search,
  Upload,
  Download,
  Navigation,
  Medal as Modal,
  Bell,
  Mail,
  Shield,
  Play,
  BarChart3,
  Brain,
  Sparkles,
  Tag,
  FileSearch,
  Heart,
  Lock,
  Key,
  Eye,
  FileCheck,
  Settings,
  RefreshCw,
  Timer,
  Pause,
  CalendarIcon,
  Map,
  CheckSquare,
  Variable,
  HardDrive,
} from "lucide-react";

const blockCategories = [
  {
    title: "Triggers",
    color: "bg-blue-500/20 border-blue-500/30",
    textColor: "text-blue-400",
    blocks: [
      { name: "onPageLoad", icon: MousePointer, description: "Page opens" },
      { name: "onSubmit", icon: FileText, description: "Form submit" },
      { name: "onClick", icon: MousePointer, description: "Button click" },
      { name: "onDrop", icon: Navigation, description: "Card moved" },
      { name: "onRecordCreate", icon: Database, description: "DB insert" },
      { name: "onRecordUpdate", icon: Database, description: "DB update" },
      { name: "onSchedule", icon: Clock, description: "Cron time" },
      { name: "onLogin", icon: Users, description: "Auth success" },
      { name: "onWebhook", icon: Webhook, description: "HTTP request" },
    ],
  },
  {
    title: "Conditions",
    color: "bg-green-500/20 border-green-500/30",
    textColor: "text-green-400",
    blocks: [
      { name: "isFilled", icon: CheckCircle, description: "Required fields" },
      { name: "dateValid", icon: Calendar, description: "Date range" },
      { name: "match", icon: Search, description: "Compare values" },
      { name: "inList", icon: CheckSquare, description: "Enum check" },
      { name: "roleIs", icon: Users, description: "User role" },
      { name: "switch", icon: GitBranch, description: "Multi-route" },
      { name: "expr", icon: Calculator, description: "Custom rule" },
    ],
  },
  {
    title: "Actions",
    color: "bg-purple-500/20 border-purple-500/30",
    textColor: "text-purple-400",
    blocks: [
      { name: "db.find", icon: Search, description: "Query rows" },
      { name: "db.create", icon: Database, description: "Insert row" },
      { name: "db.update", icon: Database, description: "Update row" },
      { name: "db.upsert", icon: Database, description: "Create/update" },
      { name: "http.request", icon: Webhook, description: "Call REST API" },
      { name: "file.upload", icon: Upload, description: "Upload file" },
      { name: "file.download", icon: Download, description: "Download file" },
      {
        name: "page.redirect",
        icon: Navigation,
        description: "Redirect to a page",
      },
      { name: "ui.openModal", icon: Modal, description: "Open dialog" },
      { name: "notify.toast", icon: Bell, description: "Show toast" },
      { name: "email.send", icon: Mail, description: "Send email" },
      { name: "auth.verify", icon: Shield, description: "Check creds" },
      { name: "subflow.call", icon: Play, description: "Run subflow" },
      { name: "audit.log", icon: FileCheck, description: "Record event" },
    ],
  },
  {
    title: "AI Blocks",
    color: "bg-pink-500/20 border-pink-500/30",
    textColor: "text-pink-400",
    blocks: [
      { name: "ai.prompt", icon: Brain, description: "General LLM" },
      { name: "ai.summarize", icon: Sparkles, description: "Doc summary" },
      { name: "ai.classify", icon: Tag, description: "Label item" },
      { name: "ai.extract", icon: FileSearch, description: "Pull fields" },
      { name: "ai.sentiment", icon: Heart, description: "Mood score" },
      { name: "ai.guard", icon: Shield, description: "Safety check" },
      { name: "ai.search", icon: Search, description: "RAG chunks" },
      { name: "ai.embed", icon: Sparkles, description: "Embeddings" },
      { name: "ai.evaluate", icon: BarChart3, description: "Quality check" },
      { name: "ai.route", icon: GitBranch, description: "Path select" },
    ],
  },
  {
    title: "Security & Governance",
    color: "bg-red-500/20 border-red-500/30",
    textColor: "text-red-400",
    blocks: [
      { name: "auth.check", icon: Lock, description: "Route guard" },
      { name: "secret.get", icon: Key, description: "Read secrets" },
      { name: "pii.scan", icon: Eye, description: "Flag sensitive" },
      { name: "audit.log", icon: FileCheck, description: "Compliance trail" },
    ],
  },
  {
    title: "Utility & Data",
    color: "bg-yellow-500/20 border-yellow-500/30",
    textColor: "text-yellow-400",
    blocks: [
      { name: "map", icon: Map, description: "Transform fields" },
      { name: "validate", icon: CheckSquare, description: "Schema check" },
      { name: "setVar", icon: Variable, description: "Set variable" },
      { name: "cache.get", icon: HardDrive, description: "Quick store" },
    ],
  },
  {
    title: "Execution & Schedules",
    color: "bg-orange-500/20 border-orange-500/30",
    textColor: "text-orange-400",
    blocks: [
      { name: "exec.class", icon: Settings, description: "Execution type" },
      { name: "retry", icon: RefreshCw, description: "Retry logic" },
      { name: "backoff", icon: Timer, description: "Delay strategy" },
      { name: "wait", icon: Pause, description: "Pacing" },
      { name: "cron", icon: CalendarIcon, description: "Timed jobs" },
    ],
  },
];

const connectorTypes = [
  {
    name: "next",
    icon: Navigation,
    color: "text-blue-400",
    description: "Normal flow",
  },
  {
    name: "yes",
    icon: CheckCircle,
    color: "text-green-400",
    description: "True branch",
  },
  {
    name: "no",
    icon: CheckCircle,
    color: "text-red-400",
    description: "False branch",
  },
  {
    name: "onError",
    icon: Shield,
    color: "text-red-500",
    description: "Error path",
  },
  {
    name: "fork",
    icon: GitBranch,
    color: "text-purple-400",
    description: "Split paths",
  },
  {
    name: "join",
    icon: GitBranch,
    color: "text-purple-500",
    description: "Wait for all",
  },
  {
    name: "loopBack",
    icon: RefreshCw,
    color: "text-orange-400",
    description: "Iterate",
  },
];

interface BlockLibraryProps {
  filters: {
    searchQuery: string;
    detailedFilters: {
      trigger: boolean;
      action: boolean;
      condition: boolean;
      moreFilters: boolean;
    };
    categoryFilters: {
      versions: boolean;
      access: boolean;
      data: boolean;
      security: boolean;
    };
  };
}

function BlockLibraryComponent({ filters }: BlockLibraryProps) {
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);
  const [connectorPosition, setConnectorPosition] = useState({ x: 0, y: 0 });

  // Track re-renders for debugging (removed - was causing performance issues)
  // useEffect(() => {
  //   console.log('🔄 RENDER: Block Library component re-rendered');
  //   console.log('🔄 RENDER: Filters:', filters);
  //   console.log('🔄 RENDER: draggedBlock:', draggedBlock);
  // });

  const filteredCategories = blockCategories
    .filter((category) => {
      // Filter by detailed filters
      if (filters.detailedFilters.trigger && category.title !== "Triggers")
        return false;
      if (filters.detailedFilters.action && category.title !== "Actions")
        return false;
      if (filters.detailedFilters.condition && category.title !== "Conditions")
        return false;

      // If no detailed filters are active, show all categories
      const hasActiveDetailedFilters = Object.values(
        filters.detailedFilters
      ).some(Boolean);
      if (hasActiveDetailedFilters) {
        return (
          (filters.detailedFilters.trigger && category.title === "Triggers") ||
          (filters.detailedFilters.action && category.title === "Actions") ||
          (filters.detailedFilters.condition && category.title === "Conditions")
        );
      }

      return true;
    })
    .map((category) => ({
      ...category,
      blocks: category.blocks.filter(
        (block) =>
          block.name
            .toLowerCase()
            .includes(filters.searchQuery.toLowerCase()) ||
          block.description
            .toLowerCase()
            .includes(filters.searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.blocks.length > 0);

  // Create a reverse mapping from icon components to their string names
  const getIconName = (iconComponent: any): string => {
    const iconMap: Record<string, any> = {
      MousePointer,
      FileText,
      Clock,
      Database,
      Webhook,
      CheckCircle,
      Calendar,
      Users,
      GitBranch,
      Calculator,
      Search,
      Upload,
      Download,
      Navigation,
      Modal,
      Bell,
      Mail,
      Shield,
      Play,
      BarChart3,
      Brain,
      Sparkles,
      Tag,
      FileSearch,
      Heart,
      Lock,
      Key,
      Eye,
      FileCheck,
      Settings,
      RefreshCw,
      Timer,
      Pause,
      CalendarIcon,
      Map,
      CheckSquare,
      Variable,
      HardDrive,
    };

    // Find the icon name by comparing the component
    for (const [name, component] of Object.entries(iconMap)) {
      if (component === iconComponent) {
        return name;
      }
    }
    return "FileText"; // Default fallback
  };

  const handleDragStart = (
    event: React.DragEvent,
    block: any,
    category: string
  ) => {
    console.log(
      `🚀 DRAG START: Starting drag for ${category} node: ${block.name}`
    );
    console.log(`🚀 DRAG START: Event target:`, event.target);
    console.log(`🚀 DRAG START: Event currentTarget:`, event.currentTarget);
    console.log(
      `🚀 DRAG START: Document activeElement:`,
      document.activeElement
    );

    // Stop propagation to prevent interference from canvas element selection
    event.stopPropagation();
    console.log(`🚀 DRAG START: Event propagation stopped`);

    setDraggedBlock(block.name);

    // Get the correct icon name
    const iconName = getIconName(block.icon);
    console.log(`🚀 DRAG START: Icon name for ${block.name}:`, iconName);

    // Set drag data for React Flow
    event.dataTransfer.setData("application/reactflow", "workflowNode");
    const dragData = {
      name: block.name,
      description: block.description,
      category: category,
      icon: iconName,
    };
    const dragDataString = JSON.stringify(dragData);
    console.log(`🚀 DRAG START: Drag data for ${block.name}:`, dragDataString);

    event.dataTransfer.setData("application/json", dragDataString);
    event.dataTransfer.effectAllowed = "move";

    console.log(`✅ DRAG START: Drag data set successfully for ${block.name}`);

    // Add specific data type for condition nodes
    if (category === "Conditions") {
      const dataType = `condition.${block.name}`;
      event.dataTransfer.setData("data-type", dataType);
      console.log(
        `🚀 DRAG START: Dragging condition node: ${block.name}, data-type: ${dataType}`
      );
    }
  };

  const handleDragEnd = (event: React.DragEvent) => {
    console.log("Drag ended, effect:", event.dataTransfer.dropEffect);
    setDraggedBlock(null);
  };

  const handleConnectorDragStart = (event: React.DragEvent, connector: any) => {
    event.dataTransfer.setData("application/reactflow", "connector");
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        name: connector.name,
        description: connector.description,
        color: connector.color,
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const handleConnectorClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setConnectorPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setShowConnectors(!showConnectors);
  };

  return (
    <div
      className="h-full overflow-y-auto p-4 space-y-6 relative"
      style={{ pointerEvents: "auto", zIndex: 10 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Block Library</h3>
        <Badge variant="outline" className="text-xs">
          {filteredCategories.reduce((acc, cat) => acc + cat.blocks.length, 0)}{" "}
          blocks
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <h4 className="text-sm font-medium text-foreground">Connectors</h4>
          <Badge variant="secondary" className="text-xs">
            {connectorTypes.length}
          </Badge>
        </div>

        <button
          onClick={handleConnectorClick}
          className="w-full p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
        >
          <div className="flex items-center justify-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">
              Select Connector
            </span>
          </div>
        </button>
      </div>

      {filteredCategories.map((category) => (
        <div key={category.title} className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${category.color
                .split(" ")[0]
                .replace("/20", "")}`}
            />
            <h4 className="text-sm font-medium text-foreground">
              {category.title}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {category.blocks.length}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {category.blocks.map((block) => {
              const IconComponent = block.icon;
              return (
                <div
                  key={block.name}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, block, category.title)}
                  onDragEnd={handleDragEnd}
                  className={`workflow-block p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:scale-105 ${
                    category.color
                  } ${
                    draggedBlock === block.name ? "opacity-50 scale-95" : ""
                  }`}
                  title={block.description}
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                >
                  <div
                    className="text-center space-y-2"
                    style={{ pointerEvents: "none" }}
                  >
                    <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center bg-background/50">
                      <IconComponent
                        className={`w-4 h-4 ${category.textColor}`}
                      />
                    </div>
                    <div
                      className={`text-xs font-medium ${category.textColor}`}
                    >
                      {block.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showConnectors && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowConnectors(false)}
          />
          <div
            className="fixed z-50 bg-card/95 backdrop-blur-sm border border-border rounded-full p-2 shadow-2xl"
            style={{
              left: connectorPosition.x - 120,
              top: connectorPosition.y - 120,
              width: "240px",
              height: "240px",
            }}
          >
            <div className="relative w-full h-full">
              {connectorTypes.map((connector, index) => {
                const angle = (index * 360) / connectorTypes.length;
                const radius = 80;
                const x =
                  Math.cos(((angle - 90) * Math.PI) / 180) * radius + 120;
                const y =
                  Math.sin(((angle - 90) * Math.PI) / 180) * radius + 120;
                const IconComponent = connector.icon;

                return (
                  <div
                    key={connector.name}
                    draggable
                    onDragStart={(e) => handleConnectorDragStart(e, connector)}
                    className="absolute w-12 h-12 rounded-full bg-background border border-border hover:border-border/80 flex items-center justify-center transition-all hover:scale-110 group cursor-grab active:cursor-grabbing"
                    style={{
                      left: x - 24,
                      top: y - 24,
                    }}
                    onClick={() => {
                      console.log(`[v0] Selected connector: ${connector.name}`);
                      setShowConnectors(false);
                    }}
                    title={connector.description}
                  >
                    <IconComponent className={`w-5 h-5 ${connector.color}`} />
                  </div>
                );
              })}

              {/* Center circle */}
              <div
                className="absolute w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center"
                style={{ left: 116, top: 116 }}
              >
                <GitBranch className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Memoize BlockLibrary to prevent unnecessary re-renders
export const BlockLibrary = memo(
  BlockLibraryComponent,
  (prevProps, nextProps) => {
    // Custom comparison function - only re-render if filters actually change
    const filtersEqual =
      JSON.stringify(prevProps.filters) === JSON.stringify(nextProps.filters);
    console.log(
      "🔄 MEMO: BlockLibrary memo comparison, filtersEqual:",
      filtersEqual
    );
    return filtersEqual; // Return true to skip re-render
  }
);
