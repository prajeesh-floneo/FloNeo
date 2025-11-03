const NodeCache = require('node-cache');

// Create cache instances with different TTL settings
const canvasCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Don't clone objects for better performance
});

const elementCache = new NodeCache({ 
  stdTTL: 180, // 3 minutes
  checkperiod: 60,
  useClones: false
});

const mediaCache = new NodeCache({ 
  stdTTL: 600, // 10 minutes for media files
  checkperiod: 120,
  useClones: false
});

/**
 * Canvas caching utilities
 */
class CanvasCacheManager {
  
  // Canvas-level caching
  static getCachedCanvas(appId) {
    const key = `canvas:${appId}`;
    return canvasCache.get(key);
  }

  static setCachedCanvas(appId, canvasData) {
    const key = `canvas:${appId}`;
    canvasCache.set(key, canvasData);
    console.log(`📦 Canvas cached for app ${appId}`);
  }

  static invalidateCanvas(appId) {
    const key = `canvas:${appId}`;
    canvasCache.del(key);
    console.log(`🗑️ Canvas cache invalidated for app ${appId}`);
  }

  // Element-level caching
  static getCachedElement(elementId) {
    const key = `element:${elementId}`;
    return elementCache.get(key);
  }

  static setCachedElement(elementId, elementData) {
    const key = `element:${elementId}`;
    elementCache.set(key, elementData);
  }

  static invalidateElement(elementId) {
    const key = `element:${elementId}`;
    elementCache.del(key);
  }

  static getCachedElements(appId) {
    const key = `elements:${appId}`;
    return elementCache.get(key);
  }

  static setCachedElements(appId, elementsData) {
    const key = `elements:${appId}`;
    elementCache.set(key, elementsData);
    console.log(`📦 Elements cached for app ${appId}`);
  }

  static invalidateElements(appId) {
    const key = `elements:${appId}`;
    elementCache.del(key);
    console.log(`🗑️ Elements cache invalidated for app ${appId}`);
  }

  // Media file caching
  static getCachedMediaList(userId, filters = {}) {
    const key = `media:${userId}:${JSON.stringify(filters)}`;
    return mediaCache.get(key);
  }

  static setCachedMediaList(userId, filters, mediaData) {
    const key = `media:${userId}:${JSON.stringify(filters)}`;
    mediaCache.set(key, mediaData);
  }

  static invalidateUserMedia(userId) {
    const keys = mediaCache.keys().filter(key => key.startsWith(`media:${userId}:`));
    mediaCache.del(keys);
    console.log(`🗑️ Media cache invalidated for user ${userId}`);
  }

  // Bulk invalidation for canvas updates
  static invalidateCanvasData(appId) {
    this.invalidateCanvas(appId);
    this.invalidateElements(appId);
    console.log(`🗑️ All canvas data invalidated for app ${appId}`);
  }

  // Cache statistics
  static getCacheStats() {
    return {
      canvas: {
        keys: canvasCache.keys().length,
        stats: canvasCache.getStats()
      },
      elements: {
        keys: elementCache.keys().length,
        stats: elementCache.getStats()
      },
      media: {
        keys: mediaCache.keys().length,
        stats: mediaCache.getStats()
      }
    };
  }

  // Clear all caches
  static clearAllCaches() {
    canvasCache.flushAll();
    elementCache.flushAll();
    mediaCache.flushAll();
    console.log('🗑️ All caches cleared');
  }
}

/**
 * Performance optimization utilities
 */
class CanvasPerformanceOptimizer {
  
  /**
   * Optimize canvas data for large canvases
   */
  static optimizeCanvasData(canvasData) {
    if (!canvasData || !canvasData.elements) return canvasData;

    // Sort elements by zIndex for efficient rendering
    const sortedElements = canvasData.elements.sort((a, b) => a.zIndex - b.zIndex);

    // Group elements by type for batch processing
    const elementsByType = {};
    sortedElements.forEach(element => {
      if (!elementsByType[element.type]) {
        elementsByType[element.type] = [];
      }
      elementsByType[element.type].push(element);
    });

    // Optimize element data
    const optimizedElements = sortedElements.map(element => ({
      ...element,
      // Remove unnecessary nested data for list views
      interactions: element.interactions?.length || 0,
      validations: element.validations?.length || 0,
      children: element.children?.length || 0
    }));

    return {
      ...canvasData,
      elements: optimizedElements,
      elementsByType,
      totalElements: sortedElements.length,
      optimizedAt: new Date()
    };
  }

  /**
   * Paginate elements for large canvases
   */
  static paginateElements(elements, page = 1, limit = 50) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      elements: elements.slice(startIndex, endIndex),
      pagination: {
        page,
        limit,
        total: elements.length,
        pages: Math.ceil(elements.length / limit),
        hasNext: endIndex < elements.length,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Filter elements by viewport for performance
   */
  static filterElementsByViewport(elements, viewport) {
    if (!viewport) return elements;

    const { x, y, width, height, zoom = 1 } = viewport;
    
    // Calculate visible area with some padding
    const padding = 100 / zoom; // Adjust padding based on zoom
    const visibleArea = {
      left: x - padding,
      top: y - padding,
      right: x + width + padding,
      bottom: y + height + padding
    };

    return elements.filter(element => {
      // Check if element intersects with visible area
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;

      return !(
        element.x > visibleArea.right ||
        elementRight < visibleArea.left ||
        element.y > visibleArea.bottom ||
        elementBottom < visibleArea.top
      );
    });
  }

  /**
   * Optimize element properties for transmission
   */
  static optimizeElementForTransmission(element, includeDetails = false) {
    const baseElement = {
      id: element.id,
      elementId: element.elementId,
      type: element.type,
      name: element.name,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      zIndex: element.zIndex,
      locked: element.locked,
      visible: element.visible,
      groupId: element.groupId,
      parentId: element.parentId,
      updatedAt: element.updatedAt
    };

    if (includeDetails) {
      return {
        ...baseElement,
        properties: element.properties,
        styles: element.styles,
        constraints: element.constraints,
        interactions: element.interactions,
        validations: element.validations,
        children: element.children
      };
    }

    return baseElement;
  }

  /**
   * Batch process element updates for better performance
   */
  static batchElementUpdates(updates) {
    // Group updates by type
    const updatesByType = {
      position: [],
      style: [],
      property: [],
      state: []
    };

    updates.forEach(update => {
      const { elementId, updateData } = update;
      
      if (updateData.x !== undefined || updateData.y !== undefined || 
          updateData.width !== undefined || updateData.height !== undefined) {
        updatesByType.position.push(update);
      }
      
      if (updateData.styles) {
        updatesByType.style.push(update);
      }
      
      if (updateData.properties) {
        updatesByType.property.push(update);
      }
      
      if (updateData.locked !== undefined || updateData.visible !== undefined) {
        updatesByType.state.push(update);
      }
    });

    return updatesByType;
  }

  /**
   * Calculate canvas performance metrics
   */
  static calculatePerformanceMetrics(canvasData) {
    if (!canvasData || !canvasData.elements) {
      return { elementCount: 0, complexity: 'low' };
    }

    const elementCount = canvasData.elements.length;
    const interactionCount = canvasData.elements.reduce((sum, el) => 
      sum + (el.interactions?.length || 0), 0);
    const validationCount = canvasData.elements.reduce((sum, el) => 
      sum + (el.validations?.length || 0), 0);

    let complexity = 'low';
    if (elementCount > 100 || interactionCount > 50) complexity = 'medium';
    if (elementCount > 500 || interactionCount > 200) complexity = 'high';
    if (elementCount > 1000 || interactionCount > 500) complexity = 'very-high';

    return {
      elementCount,
      interactionCount,
      validationCount,
      complexity,
      recommendedPageSize: complexity === 'very-high' ? 25 : 
                           complexity === 'high' ? 50 : 100
    };
  }
}

module.exports = {
  CanvasCacheManager,
  CanvasPerformanceOptimizer
};
