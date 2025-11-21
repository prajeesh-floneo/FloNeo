'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasWorkflow } from '@/lib/canvas-workflow-context'
import { AutoCompleteOption } from '../components/ui/autocomplete'

// Cache for storing fetched data
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Hook to fetch table names for the current app
 */
export function useTableSuggestions() {
  const { currentAppId } = useCanvasWorkflow()
  const [tables, setTables] = useState<AutoCompleteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    if (!currentAppId) {
      setTables([])
      return
    }

    const cacheKey = `tables_${currentAppId}`
    const cached = cache.get(cacheKey)

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setTables(cached.data)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        throw new Error('Authentication token not found')
      }
      const response = await fetch(`/api/database/${currentAppId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tables')
      }

      const data = await response.json()

      if (data.success && data.tables) {
        const tableOptions: AutoCompleteOption[] = data.tables.map((table: any) => ({
          value: table.name,
          label: table.name,
          description: `${table.rowCount || 0} rows`,
          metadata: table,
        }))

        setTables(tableOptions)
        
        // Cache the results
        cache.set(cacheKey, {
          data: tableOptions,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      console.error('Error fetching tables:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tables')
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [currentAppId])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  return { tables, loading, error, refetch: fetchTables }
}

/**
 * Hook to fetch column names for a specific table
 */
export function useColumnSuggestions(tableName?: string) {
  const { currentAppId } = useCanvasWorkflow()
  const [columns, setColumns] = useState<AutoCompleteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchColumns = useCallback(async () => {
    if (!currentAppId || !tableName) {
      setColumns([])
      return
    }

    const cacheKey = `columns_${currentAppId}_${tableName}`
    const cached = cache.get(cacheKey)

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setColumns(cached.data)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        throw new Error('Authentication token not found')
      }
      const response = await fetch(`/api/database/${currentAppId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch table info')
      }

      const data = await response.json()

      if (data.success && data.tables) {
        const table = data.tables.find((t: any) => t.name === tableName)
        
        if (table && table.columns) {
          const columnOptions: AutoCompleteOption[] = table.columns.map((col: any) => ({
            value: col.name,
            label: col.name,
            description: col.type || 'column',
            metadata: col,
          }))

          setColumns(columnOptions)
          
          // Cache the results
          cache.set(cacheKey, {
            data: columnOptions,
            timestamp: Date.now(),
          })
        }
      }
    } catch (err) {
      console.error('Error fetching columns:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch columns')
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [currentAppId, tableName])

  useEffect(() => {
    fetchColumns()
  }, [fetchColumns])

  return { columns, loading, error, refetch: fetchColumns }
}

/**
 * Hook to fetch page names for the current app
 */
export function usePageSuggestions() {
  const { pages } = useCanvasWorkflow()
  const [pageOptions, setPageOptions] = useState<AutoCompleteOption[]>([])

  useEffect(() => {
    if (pages && pages.length > 0) {
      const options: AutoCompleteOption[] = pages.map((page) => ({
        value: page.id,
        label: page.name || page.id,
        description: `Page ID: ${page.id}`,
        metadata: page,
      }))
      setPageOptions(options)
    } else {
      setPageOptions([])
    }
  }, [pages])

  return { pages: pageOptions, loading: false, error: null }
}

/**
 * Hook to fetch variable suggestions from previous blocks in workflow
 */
export function useVariableSuggestions(nodes: any[], currentNodeId: string) {
  const [variables, setVariables] = useState<AutoCompleteOption[]>([])

  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      setVariables([])
      return
    }

    // Find the current node index
    const currentIndex = nodes.findIndex((n) => n.id === currentNodeId)
    if (currentIndex === -1) {
      setVariables([])
      return
    }

    // Get all nodes before the current one
    const previousNodes = nodes.slice(0, currentIndex)

    // Extract variables from previous nodes
    const variableOptions: AutoCompleteOption[] = []

    previousNodes.forEach((node) => {
      const label = node.data?.label || ''

      // Add common variables based on block type
      if (label === 'db.find' || label === 'db.create' || label === 'db.update') {
        variableOptions.push({
          value: `{{${node.id}.data}}`,
          label: `${label} result (${node.id})`,
          description: 'Database operation result',
          metadata: { nodeId: node.id, type: 'db' },
        })
      } else if (label === 'http.request') {
        variableOptions.push({
          value: `{{${node.id}.response}}`,
          label: `HTTP response (${node.id})`,
          description: 'HTTP request response data',
          metadata: { nodeId: node.id, type: 'http' },
        })
      } else if (label === 'expr') {
        variableOptions.push({
          value: `{{${node.id}.result}}`,
          label: `Expression result (${node.id})`,
          description: 'Calculated expression value',
          metadata: { nodeId: node.id, type: 'expr' },
        })
      } else if (label === 'onLogin' || label === 'auth.verify') {
        variableOptions.push({
          value: `{{user.id}}`,
          label: 'User ID',
          description: 'Authenticated user ID',
          metadata: { type: 'auth' },
        })
        variableOptions.push({
          value: `{{user.email}}`,
          label: 'User Email',
          description: 'Authenticated user email',
          metadata: { type: 'auth' },
        })
      } else if (label === 'onSubmit' || label === 'isFilled') {
        variableOptions.push({
          value: `{{formData}}`,
          label: 'Form Data',
          description: 'Submitted form data',
          metadata: { type: 'form' },
        })
      }
    })

    // Add common context variables
    variableOptions.push(
      {
        value: '{{pageId}}',
        label: 'Current Page ID',
        description: 'ID of the current page',
        metadata: { type: 'context' },
      },
      {
        value: '{{timestamp}}',
        label: 'Current Timestamp',
        description: 'Current date and time',
        metadata: { type: 'context' },
      }
    )

    setVariables(variableOptions)
  }, [nodes, currentNodeId])

  return { variables, loading: false, error: null }
}

/**
 * Clear all cached data
 */
export function clearSuggestionsCache() {
  cache.clear()
}

