import type { CSSProperties } from 'react';

type PageStyle = {
  bgType?: 'solid' | 'gradient' | 'image' | 'image+gradient';
  solid?: { color?: string };
  gradient?: { angle?: number; stops?: { color: string; pos?: number }[] };
  image?: { url?: string; repeat?: string; size?: string; position?: string };
  border?: { width?: number; color?: string };
  radius?: number;
  shadow?: string;
};

// Legacy canvasBackground format support
type LegacyCanvasBackground = {
  type?: 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    type?: 'linear' | 'radial';
    colors?: string[];
    direction?: string;
  };
  image?: {
    url?: string;
    size?: 'cover' | 'contain' | 'repeat';
    position?: string;
  };
};

/**
 * Maps page style object to React CSSProperties for the canvas container.
 * Supports solid, gradient, image, and image+gradient backgrounds.
 * Also handles border, radius, and shadow.
 */
export function mapPageStyle(style?: PageStyle | LegacyCanvasBackground): CSSProperties {
  // Handle legacy canvasBackground format
  if (style && 'type' in style && (style.type === 'color' || style.type === 'gradient' || style.type === 'image')) {
    return mapLegacyCanvasBackground(style as LegacyCanvasBackground);
  }

  const s = (style as PageStyle) ?? {};
  const out: CSSProperties = {
    backgroundColor: 'transparent',
    backgroundImage: undefined,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    borderStyle: (s.border?.width ?? 0) > 0 ? 'solid' : 'none',
    borderWidth: s.border?.width ?? 0,
    borderColor: s.border?.color ?? 'transparent',
    borderRadius: s.radius ?? 0,
    boxShadow: s.shadow ?? 'none',
  };

  const solid = s.solid?.color ?? undefined;
  const grad = s.gradient;
  const img = s.image;

  const gradientCss = (g?: PageStyle['gradient']) => {
    if (!g || !g.stops || g.stops.length === 0) return undefined;
    const angle = typeof g.angle === 'number' ? g.angle : 180;
    const stops = g.stops
      .map((st) => {
        const pos = typeof st.pos === 'number' ? `${st.pos}%` : undefined;
        return pos ? `${st.color} ${pos}` : st.color;
      })
      .join(', ');
    return `linear-gradient(${angle}deg, ${stops})`;
  };

  switch (s.bgType) {
    case 'solid':
      if (solid) out.backgroundColor = solid;
      break;
    case 'gradient': {
      const g = gradientCss(grad);
      if (g) {
        out.backgroundImage = g;
        out.backgroundColor = 'transparent';
      }
      break;
    }
    case 'image': {
      if (img?.url) {
        out.backgroundImage = `url("${img.url}")`;
        if (img.size) out.backgroundSize = img.size;
        if (img.position) out.backgroundPosition = img.position;
        if (img.repeat) out.backgroundRepeat = img.repeat;
      }
      break;
    }
    case 'image+gradient': {
      const g = gradientCss(grad);
      if (img?.url && g) {
        out.backgroundImage = `${g}, url("${img.url}")`;
        out.backgroundSize = `${img.size ?? 'cover'}, ${img.size ?? 'cover'}`;
        out.backgroundPosition = `${img.position ?? 'center center'}, ${img.position ?? 'center center'}`;
        out.backgroundRepeat = `${img.repeat ?? 'no-repeat'}, ${img.repeat ?? 'no-repeat'}`;
      } else if (img?.url) {
        out.backgroundImage = `url("${img.url}")`;
      } else if (g) {
        out.backgroundImage = g;
      }
      break;
    }
    default:
      if (solid) out.backgroundColor = solid;
  }

  return out;
}

/**
 * Maps legacy canvasBackground format to React CSSProperties.
 * This handles the old format used in the editor.
 */
function mapLegacyCanvasBackground(bg: LegacyCanvasBackground): CSSProperties {
  const out: CSSProperties = {
    backgroundColor: 'transparent',
    backgroundImage: undefined,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    boxShadow: 'none',
  };

  switch (bg.type) {
    case 'color':
      if (bg.color) {
        out.backgroundColor = bg.color;
      }
      break;
    case 'gradient': {
      if (bg.gradient && bg.gradient.colors && bg.gradient.colors.length > 0) {
        const colors = bg.gradient.colors;
        const direction = bg.gradient.direction || '180deg';
        
        if (bg.gradient.type === 'radial') {
          out.backgroundImage = `radial-gradient(circle, ${colors.join(', ')})`;
        } else {
          out.backgroundImage = `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        out.backgroundColor = 'transparent';
      }
      break;
    }
    case 'image': {
      if (bg.image?.url) {
        out.backgroundImage = `url("${bg.image.url}")`;
        
        // Map size
        if (bg.image.size === 'cover') {
          out.backgroundSize = 'cover';
        } else if (bg.image.size === 'contain') {
          out.backgroundSize = 'contain';
        } else if (bg.image.size === 'repeat') {
          out.backgroundSize = 'auto';
          out.backgroundRepeat = 'repeat';
        }
        
        if (bg.image.position) {
          out.backgroundPosition = bg.image.position;
        }
      }
      break;
    }
  }

  return out;
}

/**
 * Get a hash of the page style for debugging purposes.
 */
export function getPageStyleHash(style?: PageStyle | LegacyCanvasBackground): string {
  if (!style) return 'no-style';
  
  const str = JSON.stringify(style);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

