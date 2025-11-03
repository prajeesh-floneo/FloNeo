"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Mail,
  Database,
  Users,
  ShoppingCart,
  Calendar,
  Bell,
  Shield,
  BarChart3,
  Webhook,
  Clock,
  GitBranch,
} from "lucide-react"

const workflowTemplates = [
  {
    id: "user-onboarding",
    name: "User Onboarding",
    description: "Welcome new users with email sequence and profile setup",
    icon: Users,
    category: "User Management",
    blocks: 8,
    color: "bg-blue-500/20 border-blue-500/30",
    textColor: "text-blue-400",
  },
  {
    id: "order-processing",
    name: "Order Processing",
    description: "Handle e-commerce orders from payment to fulfillment",
    icon: ShoppingCart,
    category: "E-commerce",
    blocks: 12,
    color: "bg-green-500/20 border-green-500/30",
    textColor: "text-green-400",
  },
  {
    id: "content-approval",
    name: "Content Approval",
    description: "Review and approve user-generated content with AI moderation",
    icon: FileText,
    category: "Content",
    blocks: 6,
    color: "bg-purple-500/20 border-purple-500/30",
    textColor: "text-purple-400",
  },
  {
    id: "lead-nurturing",
    name: "Lead Nurturing",
    description: "Automated email campaigns based on user behavior",
    icon: Mail,
    category: "Marketing",
    blocks: 10,
    color: "bg-pink-500/20 border-pink-500/30",
    textColor: "text-pink-400",
  },
  {
    id: "data-sync",
    name: "Data Synchronization",
    description: "Keep multiple databases in sync with real-time updates",
    icon: Database,
    category: "Data",
    blocks: 7,
    color: "bg-yellow-500/20 border-yellow-500/30",
    textColor: "text-yellow-400",
  },
  {
    id: "meeting-scheduler",
    name: "Meeting Scheduler",
    description: "Automated meeting booking with calendar integration",
    icon: Calendar,
    category: "Productivity",
    blocks: 9,
    color: "bg-orange-500/20 border-orange-500/30",
    textColor: "text-orange-400",
  },
  {
    id: "alert-system",
    name: "Alert System",
    description: "Monitor metrics and send notifications when thresholds are met",
    icon: Bell,
    category: "Monitoring",
    blocks: 5,
    color: "bg-red-500/20 border-red-500/30",
    textColor: "text-red-400",
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description: "Regular security checks and compliance reporting",
    icon: Shield,
    category: "Security",
    blocks: 11,
    color: "bg-indigo-500/20 border-indigo-500/30",
    textColor: "text-indigo-400",
  },
  {
    id: "analytics-report",
    name: "Analytics Report",
    description: "Generate and distribute weekly performance reports",
    icon: BarChart3,
    category: "Analytics",
    blocks: 8,
    color: "bg-cyan-500/20 border-cyan-500/30",
    textColor: "text-cyan-400",
  },
  {
    id: "webhook-processor",
    name: "Webhook Processor",
    description: "Process incoming webhooks and trigger appropriate actions",
    icon: Webhook,
    category: "Integration",
    blocks: 6,
    color: "bg-teal-500/20 border-teal-500/30",
    textColor: "text-teal-400",
  },
  {
    id: "scheduled-backup",
    name: "Scheduled Backup",
    description: "Automated daily backups with error handling and notifications",
    icon: Clock,
    category: "Maintenance",
    blocks: 4,
    color: "bg-slate-500/20 border-slate-500/30",
    textColor: "text-slate-400",
  },
  {
    id: "ab-testing",
    name: "A/B Testing",
    description: "Split traffic and analyze conversion rates automatically",
    icon: GitBranch,
    category: "Optimization",
    blocks: 9,
    color: "bg-violet-500/20 border-violet-500/30",
    textColor: "text-violet-400",
  },
]

const categories = ["All", ...Array.from(new Set(workflowTemplates.map((template) => template.category)))]

export function TemplateLibrary() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [draggedTemplate, setDraggedTemplate] = useState<string | null>(null)

  const filteredTemplates = workflowTemplates.filter(
    (template) => selectedCategory === "All" || template.category === selectedCategory,
  )

  const handleDragStart = (templateId: string) => {
    setDraggedTemplate(templateId)
  }

  const handleDragEnd = () => {
    setDraggedTemplate(null)
  }

  const handleTemplateClick = (templateId: string) => {
    console.log(`[v0] Loading template: ${templateId}`)
    // Template loading logic would go here
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Workflow Templates</h3>
        <Badge variant="outline" className="text-xs">
          {filteredTemplates.length} templates
        </Badge>
      </div>

      {/* Category Filter */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categories</h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
              {category !== "All" && (
                <Badge variant="secondary" className="ml-2 text-xs px-1 py-0 h-4">
                  {workflowTemplates.filter((t) => t.category === category).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="space-y-3">
        <div className="grid gap-3">
          {filteredTemplates.map((template) => {
            const IconComponent = template.icon
            return (
              <div
                key={template.id}
                draggable
                onDragStart={() => handleDragStart(template.id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleTemplateClick(template.id)}
                className={`workflow-block p-4 cursor-pointer ${template.color} ${
                  draggedTemplate === template.id ? "opacity-50" : ""
                } hover:scale-[1.02] transition-all duration-200`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background/50 flex-shrink-0">
                    <IconComponent className={`w-5 h-5 ${template.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className={`text-sm font-medium ${template.textColor} truncate`}>{template.name}</h5>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 ml-2">
                        {template.blocks}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2">
                        Use Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
