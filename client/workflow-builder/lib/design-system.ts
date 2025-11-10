// Design System Configuration
// This file contains all design tokens, colors, spacing, and styling patterns

export const designSystem = {
  // Color Palette
  colors: {
    // Primary brand colors
    primary: {
      50: "#f0f9ff",
      100: "#e0f2fe",
      200: "#bae6fd",
      300: "#7dd3fc",
      400: "#38bdf8",
      500: "#0ea5e9",
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },

    // Neutral colors
    neutral: {
      50: "#fafafa",
      100: "#f5f5f5",
      200: "#e5e5e5",
      300: "#d4d4d4",
      400: "#a3a3a3",
      500: "#737373",
      600: "#525252",
      700: "#404040",
      800: "#262626",
      900: "#171717",
    },

    // Semantic colors
    success: {
      50: "#f0fdf4",
      500: "#22c55e",
      600: "#16a34a",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
      600: "#d97706",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },

    // Block category colors
    blocks: {
      triggers: {
        bg: "bg-blue-500/20",
        border: "border-blue-500/30",
        text: "text-blue-400",
        dot: "bg-blue-500",
      },
      conditions: {
        bg: "bg-green-500/20",
        border: "border-green-500/30",
        text: "text-green-400",
        dot: "bg-green-500",
      },
      actions: {
        bg: "bg-purple-500/20",
        border: "border-purple-500/30",
        text: "text-purple-400",
        dot: "bg-purple-500",
      },
      ai: {
        bg: "bg-pink-500/20",
        border: "border-pink-500/30",
        text: "text-pink-400",
        dot: "bg-pink-500",
      },
      security: {
        bg: "bg-red-500/20",
        border: "border-red-500/30",
        text: "text-red-400",
        dot: "bg-red-500",
      },
      utility: {
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
        text: "text-yellow-400",
        dot: "bg-yellow-500",
      },
      execution: {
        bg: "bg-orange-500/20",
        border: "border-orange-500/30",
        text: "text-orange-400",
        dot: "bg-orange-500",
      },
      connectors: {
        bg: "bg-cyan-500/20",
        border: "border-cyan-500/30",
        text: "text-cyan-400",
        dot: "bg-cyan-500",
      },
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // Spacing
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
    "3xl": "3rem",
  },

  // Border radius
  borderRadius: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },

  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },

  // Animation
  animation: {
    duration: {
      fast: "150ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
    },
  },

  // Component patterns
  components: {
    button: {
      base: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
      variants: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      sizes: {
        sm: "h-8 px-3 text-xs gap-2",
        md: "h-9 px-4 py-2 gap-2",
        lg: "h-10 px-8 gap-2",
      },
      success: "bg-green-600 hover:bg-green-700 text-white",
    },

    card: {
      base: "rounded-lg border bg-card text-card-foreground shadow-sm",
      glass: "backdrop-blur-sm bg-background/80 border border-border/50",
    },

    badge: {
      base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      variants: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground",
      },
      info: "flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md",
    },

    input: {
      base: "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      number: "w-12 px-2 py-1 text-sm border border-border rounded text-center bg-background",
      select: "px-2 py-1 text-sm border border-border rounded bg-background",
    },

    icon: {
      xs: "w-3 h-3",
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
      xl: "w-8 h-8",
      empty: "w-16 h-16 text-muted-foreground mx-auto mb-4",
      badge: "w-4 h-4 text-blue-500",
      success: "w-4 h-4 text-green-500",
      primary: "w-4 h-4 text-blue-500",
    },

    text: {
      label: "text-sm text-muted-foreground",
      value: "text-sm font-medium",
      type: "text-xs text-muted-foreground",
      heading: "text-lg font-medium text-foreground mb-2",
      helper: "text-sm text-muted-foreground",
    },

    dropdown: {
      trigger: "min-w-[200px] justify-between",
      content: "absolute top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-10",
      item: "w-full px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer",
    },

    toggle: {
      base: "w-10 h-6 rounded-full relative transition-colors",
      active: "bg-green-500",
      inactive: "bg-muted",
      thumb: "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
      thumbActive: "translate-x-5",
      thumbInactive: "translate-x-1",
    },

    tab: {
      active: "text-foreground",
      inactive: "text-muted-foreground",
    },

    block: {
      base: "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
      selected: "ring-2 ring-primary",
    },

    filter: {
      container: "space-y-4 p-4",
      section: "space-y-2",
      button: "w-full justify-start text-left",
      active: "bg-primary text-primary-foreground",
    },
  },

  // Layout patterns
  layout: {
    container: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
    grid: {
      cols2: "grid grid-cols-2 gap-4",
      cols3: "grid grid-cols-3 gap-4",
      cols4: "grid grid-cols-4 gap-4",
    },
    flex: {
      center: "flex items-center justify-center",
      between: "flex items-center justify-between",
      start: "flex items-center justify-start gap-2",
    },
    dataScreen: {
      container: "flex flex-col h-full bg-background",
      header: "p-4 border-b border-border bg-card/30",
      toolbar: "flex items-center gap-2 p-4 border-b border-border bg-card/30",
      tableHeader: "flex items-center gap-4 p-4 border-b border-border bg-muted/30",
      content: "flex-1 flex flex-col items-center justify-center p-8",
      footer: "flex items-center justify-between p-4 border-t border-border bg-card/30",
      emptyState: "text-center",
    },
    workflowBuilder: {
      container: "flex h-screen bg-background",
      header: "flex items-center justify-between p-4 border-b border-border bg-card/30",
      sidebar: "w-80 border-r border-border bg-card/30 flex flex-col",
      canvas: "flex-1 relative overflow-hidden",
      splitHorizontal: "flex flex-col h-full",
      splitVertical: "flex h-full",
    },
  },
} as const

// Utility functions for design system
export const getBlockCategoryStyles = (category: keyof typeof designSystem.colors.blocks) => {
  return designSystem.colors.blocks[category]
}

export const getComponentStyles = (
  component: keyof typeof designSystem.components,
  variant?: string,
  size?: string,
) => {
  const comp = designSystem.components[component]
  if (!comp) return ""

  let styles = ""

  // Only add base styles if the component has a base property
  if ("base" in comp && typeof comp.base === "string") {
    styles = comp.base
  }

  if (variant && "variants" in comp && comp.variants) {
    styles += ` ${comp.variants[variant as keyof typeof comp.variants] || ""}`
  }

  if (size && "sizes" in comp && comp.sizes) {
    styles += ` ${comp.sizes[size as keyof typeof comp.sizes] || ""}`
  }

  return styles
}
