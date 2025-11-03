"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown, Filter, MoreHorizontal, Plus, RefreshCw, Shield, Zap, Database, Clock, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { designSystem } from "../lib/design-system"

export function DataScreen() {
  const [selectedSchema, setSelectedSchema] = useState("public")
  const [isSchemaDropdownOpen, setIsSchemaDropdownOpen] = useState(false)
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [isSortActive, setIsSortActive] = useState(false)
  const [isRLSActive, setIsRLSActive] = useState(false)
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(100)

  const schemas = ["public", "auth", "storage", "realtime"]

  const handleSchemaChange = (schema: string) => {
    setSelectedSchema(schema)
    setIsSchemaDropdownOpen(false)
  }

  const handleCSVImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        console.log("CSV file selected:", file.name)
        // Frontend simulation - would integrate with actual backend
      }
    }
    input.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === "text/csv") {
      console.log("CSV file dropped:", files[0].name)
      // Frontend simulation - would integrate with actual backend
    }
  }

  return (
    <div className={designSystem.layout.dataScreen.container}>
      {/* Schema Selector Header */}
      <div className={designSystem.layout.dataScreen.header}>
        <div className="relative inline-block">
          <Button
            variant="outline"
            onClick={() => setIsSchemaDropdownOpen(!isSchemaDropdownOpen)}
            className={designSystem.components.dropdown.trigger}
          >
            <div className={designSystem.layout.flex.start}>
              <Database className={designSystem.components.icon.sm} />
              <span className={designSystem.components.text.label}>schema</span>
              <span className={designSystem.components.text.value}>{selectedSchema}</span>
            </div>
            <ChevronDown className={designSystem.components.icon.sm} />
          </Button>
          {isSchemaDropdownOpen && (
            <div className={designSystem.components.dropdown.content}>
              {schemas.map((schema) => (
                <button
                  key={schema}
                  className={designSystem.components.dropdown.item}
                  onClick={() => handleSchemaChange(schema)}
                >
                  {schema}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={designSystem.layout.dataScreen.toolbar}>
        <Button
          variant={isFilterActive ? "default" : "outline"}
          size="sm"
          onClick={() => setIsFilterActive(!isFilterActive)}
        >
          <Filter className={designSystem.components.icon.sm} />
          Filter
        </Button>

        <Button variant={isSortActive ? "default" : "outline"} size="sm" onClick={() => setIsSortActive(!isSortActive)}>
          <MoreHorizontal className={designSystem.components.icon.sm} />
          Sort
        </Button>

        <Button variant="default" size="sm" className={designSystem.components.button.success}>
          <Plus className={designSystem.components.icon.sm} />
          Insert
        </Button>

        <Button variant={isRLSActive ? "default" : "outline"} size="sm" onClick={() => setIsRLSActive(!isRLSActive)}>
          <Shield className={designSystem.components.icon.sm} />
          Add RLS policy
        </Button>

        <div className={designSystem.components.badge.info}>
          <Key className={designSystem.components.icon.badge} />
          <span className={designSystem.components.text.label}>Role</span>
          <span className={designSystem.components.text.value}>postgres</span>
        </div>

        <div className={designSystem.layout.flex.start}>
          <Zap className={designSystem.components.icon.success} />
          <span className={designSystem.components.text.label}>Enable Realtime</span>
          <button
            onClick={() => setIsRealtimeEnabled(!isRealtimeEnabled)}
            className={`${designSystem.components.toggle.base} ${
              isRealtimeEnabled ? designSystem.components.toggle.active : designSystem.components.toggle.inactive
            }`}
          >
            <div
              className={`${designSystem.components.toggle.thumb} ${
                isRealtimeEnabled
                  ? designSystem.components.toggle.thumbActive
                  : designSystem.components.toggle.thumbInactive
              }`}
            />
          </button>
        </div>

        <Button variant="outline" size="sm">
          <RefreshCw className={designSystem.components.icon.sm} />
        </Button>
      </div>

      {/* Table Header */}
      <div className={designSystem.layout.dataScreen.tableHeader}>
        <div className={designSystem.layout.flex.start}>
          <Key className={designSystem.components.icon.success} />
          <span className={designSystem.components.text.value}>id</span>
          <span className={designSystem.components.text.type}>int8</span>
        </div>
        <div className={designSystem.layout.flex.start}>
          <Clock className={designSystem.components.icon.primary} />
          <span className={designSystem.components.text.value}>created_at</span>
          <span className={designSystem.components.text.type}>timestamptz</span>
        </div>
        <Button variant="ghost" size="sm">
          <Plus className={designSystem.components.icon.sm} />
        </Button>
      </div>

      {/* Table Content */}
      <div className={designSystem.layout.dataScreen.content} onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className={designSystem.layout.dataScreen.emptyState}>
          <div className="mb-6">
            <Database className={designSystem.components.icon.empty} />
            <h2 className={designSystem.components.text.heading}>This table is empty</h2>
          </div>

          <div className="space-y-3">
            <Button onClick={handleCSVImport}>Import data from CSV</Button>
            <p className={designSystem.components.text.helper}>or drag and drop a CSV file here</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={designSystem.layout.dataScreen.footer}>
        <div className={designSystem.layout.flex.start}>
          <div className={designSystem.layout.flex.start}>
            <Button variant="ghost" size="sm" disabled={currentPage === 1}>
              Previous
            </Button>

            <span className={designSystem.components.text.label}>Page</span>

            <input
              type="number"
              value={currentPage}
              onChange={(e) => setCurrentPage(Math.max(1, Number.parseInt(e.target.value) || 1))}
              className={designSystem.components.input.number}
              min="1"
            />

            <span className={designSystem.components.text.label}>of 1</span>

            <Button variant="ghost" size="sm" disabled={currentPage >= 1}>
              Next
            </Button>
          </div>

          <div className={designSystem.layout.flex.start}>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number.parseInt(e.target.value))}
              className={designSystem.components.input.select}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={200}>200 rows</option>
              <option value={500}>500 rows</option>
            </select>

            <span className={designSystem.components.text.label}>0 records</span>
          </div>
        </div>

        <div className={designSystem.layout.flex.start}>
          <Button variant="ghost" size="sm" className={designSystem.components.tab.active}>
            Data
          </Button>

          <Button variant="ghost" size="sm" className={designSystem.components.tab.inactive}>
            Definition
          </Button>
        </div>
      </div>
    </div>
  )
}
