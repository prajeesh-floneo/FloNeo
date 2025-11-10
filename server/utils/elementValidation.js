// Element validation utilities for canvas elements

// Element type definitions with their specific properties and constraints
const ELEMENT_DEFINITIONS = {
  TEXT_FIELD: {
    requiredProperties: ['placeholder'],
    optionalProperties: ['value', 'maxlength', 'minlength', 'required', 'readonly', 'disabled', 'inputType', 'pattern'],
    constraints: {
      maxlength: { type: 'number', min: 1, max: 10000 },
      minlength: { type: 'number', min: 0, max: 1000 },
      inputType: { type: 'enum', values: ['text', 'email', 'password', 'number', 'tel', 'url'] }
    }
  },
  TEXT_AREA: {
    requiredProperties: ['placeholder'],
    optionalProperties: ['value', 'rows', 'cols', 'maxlength', 'required', 'readonly', 'disabled'],
    constraints: {
      rows: { type: 'number', min: 1, max: 50 },
      cols: { type: 'number', min: 10, max: 200 },
      maxlength: { type: 'number', min: 1, max: 50000 }
    }
  },
  DROPDOWN: {
    requiredProperties: ['options'],
    optionalProperties: ['value', 'defaultValue', 'multiple', 'disabled', 'required'],
    constraints: {
      options: { type: 'array', minItems: 1, maxItems: 1000 }
    }
  },
  CHECKBOX: {
    requiredProperties: ['name'],
    optionalProperties: ['checked', 'value', 'disabled', 'required'],
    constraints: {
      name: { type: 'string', minLength: 1, maxLength: 100 }
    }
  },
  RADIO_BUTTON: {
    requiredProperties: ['name', 'value'],
    optionalProperties: ['checked', 'disabled', 'required'],
    constraints: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      value: { type: 'string', minLength: 1, maxLength: 100 }
    }
  },
  PHONE_FIELD: {
    requiredProperties: ['placeholder'],
    optionalProperties: ['value', 'maxlength', 'minlength', 'inputType', 'pattern', 'required', 'disabled', 'countryCode'],
    constraints: {
      maxlength: { type: 'number', min: 7, max: 20 },
      minlength: { type: 'number', min: 7, max: 15 },
      countryCode: { type: 'string', pattern: '^\\+[1-9]\\d{0,3}$' }
    }
  },
  TOGGLE: {
    requiredProperties: [],
    optionalProperties: ['checked', 'disabled', 'value', 'defaultValue'],
    constraints: {}
  },
  DATE_PICKER: {
    requiredProperties: [],
    optionalProperties: ['value', 'min', 'max', 'required', 'disabled', 'format'],
    constraints: {
      format: { type: 'enum', values: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD-MM-YYYY'] }
    }
  },
  IMAGE: {
    requiredProperties: ['src'],
    optionalProperties: ['alt', 'title', 'loading'],
    constraints: {
      src: { type: 'string', minLength: 1, maxLength: 2000 },
      alt: { type: 'string', maxLength: 500 },
      loading: { type: 'enum', values: ['lazy', 'eager'] }
    }
  },
  BUTTON: {
    requiredProperties: ['text'],
    optionalProperties: ['type', 'disabled', 'onClick', 'style'],
    constraints: {
      text: { type: 'string', minLength: 1, maxLength: 100 },
      type: { type: 'enum', values: ['button', 'submit', 'reset'] }
    }
  },
  UPLOAD_MEDIA: {
    requiredProperties: [],
    optionalProperties: ['accept', 'multiple', 'required', 'disabled', 'maxSize'],
    constraints: {
      maxSize: { type: 'number', min: 1024, max: 100 * 1024 * 1024 }, // 1KB to 100MB
      accept: { type: 'string', maxLength: 500 }
    }
  },
  ADD_MEDIA: {
    requiredProperties: ['source'],
    optionalProperties: ['multiple', 'disabled', 'required'],
    constraints: {
      source: { type: 'string', minLength: 1, maxLength: 500 }
    }
  },
  SHAPE: {
    requiredProperties: ['type'],
    optionalProperties: ['color', 'size', 'rotation', 'border'],
    constraints: {
      type: { type: 'enum', values: ['rectangle', 'circle', 'triangle', 'line', 'arrow', 'polygon'] },
      color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      size: { type: 'number', min: 1, max: 10000 }
    }
  }
};

// General style constraints
const STYLE_CONSTRAINTS = {
  opacity: { type: 'number', min: 0, max: 100 },
  cornerRadius: { type: 'number', min: 0, max: 1000 },
  fill: {
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    opacity: { type: 'number', min: 0, max: 100 }
  },
  stroke: {
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    opacity: { type: 'number', min: 0, max: 100 },
    weight: { type: 'number', min: 0, max: 100 },
    position: { type: 'enum', values: ['inside', 'outside', 'center'] }
  }
};

// Position and dimension constraints
const POSITION_CONSTRAINTS = {
  x: { type: 'number', min: -10000, max: 10000 },
  y: { type: 'number', min: -10000, max: 10000 },
  width: { type: 'number', min: 1, max: 10000 },
  height: { type: 'number', min: 1, max: 10000 },
  rotation: { type: 'number', min: -360, max: 360 },
  zIndex: { type: 'number', min: -1000, max: 1000 }
};

/**
 * Validate element properties based on element type
 */
const validateElementProperties = (elementType, properties) => {
  const errors = [];
  const definition = ELEMENT_DEFINITIONS[elementType];

  if (!definition) {
    errors.push(`Unknown element type: ${elementType}`);
    return errors;
  }

  // Check required properties
  for (const requiredProp of definition.requiredProperties) {
    if (!properties.hasOwnProperty(requiredProp) || properties[requiredProp] === null || properties[requiredProp] === undefined) {
      errors.push(`Missing required property: ${requiredProp}`);
    }
  }

  // Validate property constraints
  for (const [propName, propValue] of Object.entries(properties)) {
    const constraint = definition.constraints[propName];
    if (constraint) {
      const propErrors = validatePropertyConstraint(propName, propValue, constraint);
      errors.push(...propErrors);
    }
  }

  return errors;
};

/**
 * Validate element styles
 */
const validateElementStyles = (styles) => {
  const errors = [];

  for (const [styleName, styleValue] of Object.entries(styles)) {
    if (styleName === 'fill' || styleName === 'stroke') {
      if (typeof styleValue === 'object') {
        for (const [subProp, subValue] of Object.entries(styleValue)) {
          const constraint = STYLE_CONSTRAINTS[styleName][subProp];
          if (constraint) {
            const propErrors = validatePropertyConstraint(`${styleName}.${subProp}`, subValue, constraint);
            errors.push(...propErrors);
          }
        }
      }
    } else {
      const constraint = STYLE_CONSTRAINTS[styleName];
      if (constraint) {
        const propErrors = validatePropertyConstraint(styleName, styleValue, constraint);
        errors.push(...propErrors);
      }
    }
  }

  return errors;
};

/**
 * Validate element position and dimensions
 */
const validateElementPosition = (elementData) => {
  const errors = [];
  const { x, y, width, height, rotation, zIndex } = elementData;

  const positionData = { x, y, width, height, rotation, zIndex };

  for (const [propName, propValue] of Object.entries(positionData)) {
    if (propValue !== undefined && propValue !== null) {
      const constraint = POSITION_CONSTRAINTS[propName];
      if (constraint) {
        const propErrors = validatePropertyConstraint(propName, propValue, constraint);
        errors.push(...propErrors);
      }
    }
  }

  return errors;
};

/**
 * Validate a single property against its constraint
 */
const validatePropertyConstraint = (propName, propValue, constraint) => {
  const errors = [];

  switch (constraint.type) {
    case 'string':
      if (typeof propValue !== 'string') {
        errors.push(`${propName} must be a string`);
      } else {
        if (constraint.minLength && propValue.length < constraint.minLength) {
          errors.push(`${propName} must be at least ${constraint.minLength} characters long`);
        }
        if (constraint.maxLength && propValue.length > constraint.maxLength) {
          errors.push(`${propName} must be at most ${constraint.maxLength} characters long`);
        }
        if (constraint.pattern && !new RegExp(constraint.pattern).test(propValue)) {
          errors.push(`${propName} format is invalid`);
        }
      }
      break;

    case 'number':
      if (typeof propValue !== 'number' || isNaN(propValue)) {
        errors.push(`${propName} must be a valid number`);
      } else {
        if (constraint.min !== undefined && propValue < constraint.min) {
          errors.push(`${propName} must be at least ${constraint.min}`);
        }
        if (constraint.max !== undefined && propValue > constraint.max) {
          errors.push(`${propName} must be at most ${constraint.max}`);
        }
      }
      break;

    case 'array':
      if (!Array.isArray(propValue)) {
        errors.push(`${propName} must be an array`);
      } else {
        if (constraint.minItems && propValue.length < constraint.minItems) {
          errors.push(`${propName} must have at least ${constraint.minItems} items`);
        }
        if (constraint.maxItems && propValue.length > constraint.maxItems) {
          errors.push(`${propName} must have at most ${constraint.maxItems} items`);
        }
      }
      break;

    case 'enum':
      if (!constraint.values.includes(propValue)) {
        errors.push(`${propName} must be one of: ${constraint.values.join(', ')}`);
      }
      break;

    default:
      errors.push(`Unknown constraint type for ${propName}: ${constraint.type}`);
  }

  return errors;
};

/**
 * Validate complete element data
 */
const validateElement = (elementData) => {
  const errors = [];

  // Validate element type
  if (!elementData.type || !ELEMENT_DEFINITIONS[elementData.type]) {
    errors.push('Invalid or missing element type');
    return errors;
  }

  // Validate properties
  if (elementData.properties) {
    const propErrors = validateElementProperties(elementData.type, elementData.properties);
    errors.push(...propErrors);
  }

  // Validate styles
  if (elementData.styles) {
    const styleErrors = validateElementStyles(elementData.styles);
    errors.push(...styleErrors);
  }

  // Validate position and dimensions
  const positionErrors = validateElementPosition(elementData);
  errors.push(...positionErrors);

  return errors;
};

/**
 * Get element definition for a specific type
 */
const getElementDefinition = (elementType) => {
  return ELEMENT_DEFINITIONS[elementType] || null;
};

/**
 * Get all available element types
 */
const getAvailableElementTypes = () => {
  return Object.keys(ELEMENT_DEFINITIONS);
};

module.exports = {
  validateElement,
  validateElementProperties,
  validateElementStyles,
  validateElementPosition,
  getElementDefinition,
  getAvailableElementTypes,
  ELEMENT_DEFINITIONS,
  STYLE_CONSTRAINTS,
  POSITION_CONSTRAINTS
};
