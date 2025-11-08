import React from 'react';
import { get } from 'lodash';

interface TextDisplayProps {
  element: any;
  context?: Record<string, any>;
  isPreviewMode?: boolean;
  style?: React.CSSProperties;
}

export const TextDisplay: React.FC<TextDisplayProps> = ({
  element,
  context = {},
  isPreviewMode = false,
  style = {}
}) => {
  const getValue = () => {
    const bindingPath = element.properties?.bindingPath;
    
    // If no binding path, return fallback text
    if (!bindingPath) {
      return element.properties?.fallbackText || 'No data';
    }

    // If no context, return fallback text
    if (!context || Object.keys(context).length === 0) {
      return element.properties?.fallbackText || 'No data';
    }

    try {
      // Normalize array indices: "dbFindResult[0].name" -> "dbFindResult.0.name"
      const normalizedPath = bindingPath.replace(/\[(\d+)\]/g, '.$1');
      const value = get(context, normalizedPath);
      
      // If value is undefined or null, return fallback
      if (value === undefined || value === null) {
        return element.properties?.fallbackText || 'No data';
      }
      
      return value;
    } catch (error) {
      console.error('Error resolving binding path:', bindingPath, error);
      return element.properties?.fallbackText || 'Error';
    }
  };

  const formatValue = (value: any): string => {
    const format = element.properties?.format || 'text';
    
    // Handle null/undefined
    if (value === null || value === undefined) {
      return element.properties?.fallbackText || 'No data';
    }

    try {
      switch (format) {
        case 'currency':
          const num = Number(value);
          if (isNaN(num)) return 'Invalid';
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(num);
        
        case 'date':
          const date = new Date(value);
          if (isNaN(date.getTime())) return 'Invalid Date';
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        
        case 'datetime':
          const dt = new Date(value);
          if (isNaN(dt.getTime())) return 'Invalid Date';
          return dt.toLocaleString('en-US');
        
        case 'number':
          const n = Number(value);
          return isNaN(n) ? 'Invalid' : new Intl.NumberFormat('en-US').format(n);
        
        case 'percentage':
          const p = Number(value);
          if (isNaN(p)) return 'Invalid';
          return `${(p * 100).toFixed(2)}%`;
        
        case 'phone':
          const phone = String(value).replace(/\D/g, '');
          if (phone.length !== 10) return value;
          return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
        
        case 'uppercase':
          return String(value).toUpperCase();
        
        case 'lowercase':
          return String(value).toLowerCase();
        
        case 'capitalize':
          return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
        
        case 'text':
        default:
          return String(value);
      }
    } catch (error) {
      console.error(`Format error for ${format}:`, error);
      return 'Format Error';
    }
  };

  const displayValue = getValue();
  const formattedValue = formatValue(displayValue);

  // Merge element styles with provided style
  const mergedStyle: React.CSSProperties = {
    fontSize: `${element.properties?.fontSize || 14}px`,
    fontWeight: element.properties?.fontWeight || 'normal',
    color: element.properties?.color || '#000000',
    textAlign: (element.properties?.textAlign || 'left') as any,
    opacity: (element.opacity || 100) / 100,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...style
  };

  return (
    <div style={mergedStyle}>
      {formattedValue}
    </div>
  );
};

export default TextDisplay;

