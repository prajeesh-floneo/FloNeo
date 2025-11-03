// Design System Configuration
// Edit this file to change the entire project's theme

export const designSystem = {
  // Primary Colors
  colors: {
    primary: "#3B82F6", // Blue instead of orange
    secondary: "#2ECC71",
    accent: "#FFC107",
    highlight: "#FF4FCB",

    // Text Colors
    text: {
      primary: "#000000",
      secondary: "#4A4A4A",
      muted: "#9CA3AF",
      white: "#FFFFFF",
    },

    // Background Colors
    background: {
      primary: "#F0F4F8", // Light blue-gray background
      secondary: "#FFFFFF",
      card: "#FFFFFF",
      glass: "rgba(255, 255, 255, 0.25)",
    },

    // Border Colors
    border: {
      primary: "#E5E7EB",
      secondary: "#D1D5DB",
      focus: "#FF6B35",
      glass: "rgba(255, 255, 255, 0.3)",
    },
  },

  // Typography System with Poppins
  typography: {
    fontFamily: {
      primary: "Poppins, system-ui, sans-serif",
      secondary: "Poppins, system-ui, sans-serif",
    },

    // Typography Scale
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
    },

    fontWeight: {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },

    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.625",
    },

    // Typography Chart
    headings: {
      h1: {
        fontSize: "2.25rem", // 36px
        fontWeight: "700",
        lineHeight: "1.25",
        letterSpacing: "-0.025em",
      },
      h2: {
        fontSize: "1.875rem", // 30px
        fontWeight: "600",
        lineHeight: "1.25",
        letterSpacing: "-0.025em",
      },
      h3: {
        fontSize: "1.5rem", // 24px
        fontWeight: "600",
        lineHeight: "1.25",
      },
      h4: {
        fontSize: "1.25rem", // 20px
        fontWeight: "600",
        lineHeight: "1.25",
      },
    },

    body: {
      large: {
        fontSize: "1.125rem", // 18px
        fontWeight: "400",
        lineHeight: "1.625",
      },
      base: {
        fontSize: "1rem", // 16px
        fontWeight: "400",
        lineHeight: "1.5",
      },
      small: {
        fontSize: "0.875rem", // 14px
        fontWeight: "400",
        lineHeight: "1.5",
      },
      caption: {
        fontSize: "0.75rem", // 12px
        fontWeight: "400",
        lineHeight: "1.5",
      },
    },
  },

  // Spacing & Layout System
  spacing: {
    // Perfect spacing scale
    scale: {
      "0": "0",
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "5": "20px",
      "6": "24px",
      "8": "32px",
      "10": "40px",
      "12": "48px",
      "16": "64px",
      "20": "80px",
      "24": "96px",
    },

    borderRadius: {
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "32px",
    },

    padding: {
      sm: "12px",
      md: "16px",
      lg: "24px",
      xl: "32px",
      "2xl": "48px",
    },

    gap: {
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
      "2xl": "48px",
    },
  },

  // Component Styles
  components: {
    // Glassmorphism card
    glassCard: {
      background: "rgba(255, 255, 255, 0.25)",
      backdropBlur: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      shadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
      borderRadius: "20px",
    },

    // Glassy nav strip style
    glassNavStrip: {
      background: "rgba(255, 255, 255, 0.2)",
      backdropBlur: "blur(15px)",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      shadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
      borderRadius: "16px",
    },

    // Glassy icon circle style
    glassIconCircle: {
      background: "rgba(255, 255, 255, 0.3)",
      backdropBlur: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.4)",
      shadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
      borderRadius: "50%",
    },

    // Regular card
    card: {
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      borderRadius: "16px",
    },

    // Input styles
    input: {
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      height: "48px",
      focusBorder: "#FF6B35",
      padding: "12px 16px",
    },

    // Button styles
    button: {
      primary: {
        background: "#3B82F6",
        color: "#FFFFFF",
        borderRadius: "12px",
        height: "48px",
        fontWeight: "500",
      },
      secondary: {
        background: "#FFFFFF",
        color: "#4A4A4A",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        height: "48px",
        fontWeight: "500",
      },
    },

    // Sidebar glass effect
    sidebar: {
      background: "rgba(255, 255, 255, 0.15)",
      backdropBlur: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      shadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
    },
  },
}

// CSS Custom Properties Generator
export const generateCSSVariables = () => {
  return `
    :root {
      --color-primary: ${designSystem.colors.primary};
      --color-secondary: ${designSystem.colors.secondary};
      --color-accent: ${designSystem.colors.accent};
      --color-highlight: ${designSystem.colors.highlight};
      
      --text-primary: ${designSystem.colors.text.primary};
      --text-secondary: ${designSystem.colors.text.secondary};
      --text-muted: ${designSystem.colors.text.muted};
      --text-white: ${designSystem.colors.text.white};
      
      --bg-primary: ${designSystem.colors.background.primary};
      --bg-secondary: ${designSystem.colors.background.secondary};
      --bg-card: ${designSystem.colors.background.card};
      --bg-glass: ${designSystem.colors.background.glass};
      
      --border-primary: ${designSystem.colors.border.primary};
      --border-secondary: ${designSystem.colors.border.secondary};
      --border-focus: ${designSystem.colors.border.focus};
      --border-glass: ${designSystem.colors.border.glass};
      
      --font-primary: ${designSystem.typography.fontFamily.primary};
      --font-secondary: ${designSystem.typography.fontFamily.secondary};
      
      --radius-sm: ${designSystem.spacing.borderRadius.sm};
      --radius-md: ${designSystem.spacing.borderRadius.md};
      --radius-lg: ${designSystem.spacing.borderRadius.lg};
      --radius-xl: ${designSystem.spacing.borderRadius.xl};
      --radius-2xl: ${designSystem.spacing.borderRadius["2xl"]};
      --radius-3xl: ${designSystem.spacing.borderRadius["3xl"]};
    }
  `
}
