'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Lightbulb, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { BlockRecommendation } from '../utils/block-recommendations'

interface BlockRecommendationPanelProps {
  recommendations: BlockRecommendation[]
  onAddBlock: (blockType: string, category: string) => void
  onDismiss: () => void
  position?: { x: number; y: number }
}

export function BlockRecommendationPanel({
  recommendations,
  onAddBlock,
  onDismiss,
  position,
}: BlockRecommendationPanelProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Show panel with a slight delay for smooth animation
    const timer = setTimeout(() => {
      setVisible(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  if (dismissed || recommendations.length === 0) {
    return null
  }

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => {
      setDismissed(true)
      onDismiss()
    }, 200)
  }

  const handleAddBlock = (blockType: string, category: string) => {
    onAddBlock(blockType, category)
    handleDismiss()
  }

  // Get category color
  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      Triggers: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      Conditions: 'bg-green-500/10 border-green-500/30 text-green-400',
      Actions: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      'AI Blocks': 'bg-pink-500/10 border-pink-500/30 text-pink-400',
      'Security & Governance': 'bg-red-500/10 border-red-500/30 text-red-400',
      'Utility & Data': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    }
    return colorMap[category] || 'bg-gray-500/10 border-gray-500/30 text-gray-400'
  }

  return (
    <div
      className={`
        fixed z-50 transition-all duration-200 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : {
              bottom: '24px',
              right: '24px',
            }
      }
    >
      <div className="bg-background/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Suggested Next Steps
              </h3>
              <p className="text-xs text-muted-foreground">
                Based on your workflow
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
            aria-label="Dismiss suggestions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recommendations List */}
        <div className="space-y-2">
          {recommendations.slice(0, 3).map((rec, index) => (
            <div
              key={index}
              className={`
                group relative overflow-hidden rounded-md border p-3
                transition-all duration-200 hover:shadow-md
                ${getCategoryColor(rec.category)}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {rec.label}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 line-clamp-2">
                    {rec.reason}
                  </p>
                  <span className="text-xs opacity-60 mt-1 inline-block">
                    {rec.category}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddBlock(rec.blockType, rec.category)}
                  className="flex-shrink-0 h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {recommendations.length > 3 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              +{recommendations.length - 3} more suggestions available
            </p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss suggestions
          </button>
        </div>
      </div>
    </div>
  )
}

