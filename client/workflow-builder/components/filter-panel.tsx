"use client"

import type React from "react"
import { Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface FilterPanelProps {
  filters: {
    searchQuery: string
    detailedFilters: {
      trigger: boolean
      action: boolean
      condition: boolean
      moreFilters: boolean
    }
    categoryFilters: {
      versions: boolean
      access: boolean
      data: boolean
      security: boolean
    }
  }
  onFiltersChange: (filters: any) => void
}

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchQuery: e.target.value,
    })
  }

  const toggleDetailedFilter = (filterKey: string) => {
    onFiltersChange({
      ...filters,
      detailedFilters: {
        ...filters.detailedFilters,
        [filterKey]: !filters.detailedFilters[filterKey as keyof typeof filters.detailedFilters],
      },
    })
  }

  const toggleCategoryFilter = (filterKey: string) => {
    onFiltersChange({
      ...filters,
      categoryFilters: {
        ...filters.categoryFilters,
        [filterKey]: !filters.categoryFilters[filterKey as keyof typeof filters.categoryFilters],
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search blocks..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="pl-10 bg-background/50"
        />
      </div>

      {/* Detailed Filters */}
      <div className="glass rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Detailed Filters</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={filters.detailedFilters.trigger ? "default" : "outline"}
            size="sm"
            className="justify-between h-8 text-xs bg-background/50"
            onClick={() => toggleDetailedFilter("trigger")}
          >
            <span>Trigger</span>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                9
              </Badge>
              <ChevronDown className="w-3 h-3" />
            </div>
          </Button>

          <Button
            variant={filters.detailedFilters.action ? "default" : "outline"}
            size="sm"
            className="justify-between h-8 text-xs bg-background/50"
            onClick={() => toggleDetailedFilter("action")}
          >
            <span>Action</span>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                14
              </Badge>
              <ChevronDown className="w-3 h-3" />
            </div>
          </Button>

          <Button
            variant={filters.detailedFilters.condition ? "default" : "outline"}
            size="sm"
            className="justify-between h-8 text-xs bg-background/50"
            onClick={() => toggleDetailedFilter("condition")}
          >
            <span>Condition</span>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                7
              </Badge>
              <ChevronDown className="w-3 h-3" />
            </div>
          </Button>

          <Button
            variant={filters.detailedFilters.moreFilters ? "default" : "outline"}
            size="sm"
            className="justify-between h-8 text-xs bg-background/50"
            onClick={() => toggleDetailedFilter("moreFilters")}
          >
            <span>More Filters</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Search Filters */}
      <div className="glass rounded-lg p-3 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categories</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters.categoryFilters).map(([key, active]) => (
            <Button
              key={key}
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleCategoryFilter(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              {active && <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
