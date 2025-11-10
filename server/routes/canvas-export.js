const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { validateElement } = require('../utils/elementValidation');
const crypto = require('crypto');

// UUID v4 generator function
const uuidv4 = () => {
  return crypto.randomUUID();
};

const router = express.Router();
const prisma = new PrismaClient();

let io; // Socket.io instance

// Inject Socket.io instance
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// ===== CANVAS EXPORT =====

// GET /api/canvas/:appId/export - Export complete canvas layout
router.get('/:appId/export', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { format = 'json', includeHistory = false } = req.query;

    // Verify user owns the app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId
      }
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found or access denied'
      });
    }

    // Get complete canvas data
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
      include: {
        elements: {
          include: {
            interactions: true,
            validations: true,
            children: {
              include: {
                interactions: true,
                validations: true
              }
            }
          },
          orderBy: { zIndex: 'asc' }
        },
        history: includeHistory === 'true' ? {
          include: {
            user: {
              select: { id: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 100 // Limit history to last 100 actions
        } : false
      }
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        message: 'Canvas not found'
      });
    }

    // Prepare export data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      app: {
        id: app.id,
        name: app.name,
        description: app.description
      },
      canvas: {
        id: canvas.id,
        name: canvas.name,
        description: canvas.description,
        width: canvas.width,
        height: canvas.height,
        background: canvas.background,
        gridEnabled: canvas.gridEnabled,
        snapEnabled: canvas.snapEnabled,
        zoomLevel: canvas.zoomLevel,
        createdAt: canvas.createdAt,
        updatedAt: canvas.updatedAt
      },
      elements: canvas.elements.map(element => ({
        elementId: element.elementId,
        type: element.type,
        name: element.name,
        position: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotation: element.rotation,
          zIndex: element.zIndex
        },
        state: {
          locked: element.locked,
          visible: element.visible,
          groupId: element.groupId,
          parentId: element.parentId
        },
        properties: element.properties,
        styles: element.styles,
        constraints: element.constraints,
        interactions: element.interactions,
        validations: element.validations,
        children: element.children,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt
      })),
      ...(includeHistory === 'true' && { history: canvas.history })
    };

    // Handle different export formats
    switch (format.toLowerCase()) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${app.name}_canvas_${Date.now()}.json"`);
        res.json(exportData);
        break;

      case 'template':
        // Export as template format (simplified)
        const templateData = {
          name: `${app.name} Template`,
          description: `Template created from ${app.name}`,
          category: 'Custom',
          canvas: exportData.canvas,
          elements: exportData.elements.map(element => ({
            type: element.type,
            name: element.name,
            position: element.position,
            properties: element.properties,
            styles: element.styles,
            constraints: element.constraints
          }))
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${app.name}_template_${Date.now()}.json"`);
        res.json(templateData);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Use "json" or "template"'
        });
    }

  } catch (error) {
    console.error('Canvas export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export canvas'
    });
  }
});

// ===== CANVAS IMPORT =====

// POST /api/canvas/:appId/import - Import canvas layout
router.post('/:appId/import', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { canvasData, replaceExisting = false, validateElements = true } = req.body;

    // Verify user owns the app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId
      }
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found or access denied'
      });
    }

    // Validate import data structure
    if (!canvasData || !canvasData.canvas || !canvasData.elements) {
      return res.status(400).json({
        success: false,
        message: 'Invalid import data structure'
      });
    }

    // Validate elements if requested
    const validationErrors = [];
    if (validateElements) {
      for (const element of canvasData.elements) {
        const elementErrors = validateElement(element);
        if (elementErrors.length > 0) {
          validationErrors.push({
            elementId: element.elementId,
            errors: elementErrors
          });
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Element validation failed',
          validationErrors
        });
      }
    }

    // Get or create canvas
    let canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) }
    });

    if (!canvas) {
      // Create new canvas
      canvas = await prisma.canvas.create({
        data: {
          appId: parseInt(appId),
          name: canvasData.canvas.name || `${app.name} Canvas`,
          description: canvasData.canvas.description,
          width: canvasData.canvas.width || 1200,
          height: canvasData.canvas.height || 800,
          background: canvasData.canvas.background || { color: '#ffffff', opacity: 100 },
          gridEnabled: canvasData.canvas.gridEnabled !== undefined ? canvasData.canvas.gridEnabled : true,
          snapEnabled: canvasData.canvas.snapEnabled !== undefined ? canvasData.canvas.snapEnabled : true,
          zoomLevel: canvasData.canvas.zoomLevel || 1.0
        }
      });
    } else if (replaceExisting) {
      // Update existing canvas
      canvas = await prisma.canvas.update({
        where: { id: canvas.id },
        data: {
          name: canvasData.canvas.name || canvas.name,
          description: canvasData.canvas.description || canvas.description,
          width: canvasData.canvas.width || canvas.width,
          height: canvasData.canvas.height || canvas.height,
          background: canvasData.canvas.background || canvas.background,
          gridEnabled: canvasData.canvas.gridEnabled !== undefined ? canvasData.canvas.gridEnabled : canvas.gridEnabled,
          snapEnabled: canvasData.canvas.snapEnabled !== undefined ? canvasData.canvas.snapEnabled : canvas.snapEnabled,
          zoomLevel: canvasData.canvas.zoomLevel || canvas.zoomLevel
        }
      });

      // Delete existing elements if replacing
      await prisma.canvasElement.deleteMany({
        where: { canvasId: canvas.id }
      });
    }

    // Import elements
    const importedElements = [];
    const elementIdMapping = new Map(); // Map old IDs to new IDs

    // First pass: Create elements without parent relationships
    for (const elementData of canvasData.elements) {
      const newElementId = uuidv4();
      elementIdMapping.set(elementData.elementId, newElementId);

      const element = await prisma.canvasElement.create({
        data: {
          canvasId: canvas.id,
          elementId: newElementId,
          type: elementData.type,
          name: elementData.name,
          x: elementData.position?.x || 0,
          y: elementData.position?.y || 0,
          width: elementData.position?.width || 100,
          height: elementData.position?.height || 50,
          rotation: elementData.position?.rotation || 0,
          zIndex: elementData.position?.zIndex || 0,
          locked: elementData.state?.locked || false,
          visible: elementData.state?.visible !== undefined ? elementData.state.visible : true,
          groupId: elementData.state?.groupId,
          parentId: null, // Set in second pass
          properties: elementData.properties || {},
          styles: elementData.styles || {},
          constraints: elementData.constraints || {}
        }
      });

      importedElements.push(element);

      // Import interactions
      if (elementData.interactions) {
        for (const interaction of elementData.interactions) {
          await prisma.elementInteraction.create({
            data: {
              elementId: element.id,
              event: interaction.event,
              action: interaction.action
            }
          });
        }
      }

      // Import validations
      if (elementData.validations) {
        for (const validation of elementData.validations) {
          await prisma.elementValidation.create({
            data: {
              elementId: element.id,
              rule: validation.rule,
              value: validation.value,
              message: validation.message
            }
          });
        }
      }
    }

    // Second pass: Update parent relationships
    for (let i = 0; i < canvasData.elements.length; i++) {
      const elementData = canvasData.elements[i];
      const element = importedElements[i];

      if (elementData.state?.parentId) {
        const newParentId = elementIdMapping.get(elementData.state.parentId);
        if (newParentId) {
          const parentElement = await prisma.canvasElement.findUnique({
            where: { elementId: newParentId }
          });
          
          if (parentElement) {
            await prisma.canvasElement.update({
              where: { id: element.id },
              data: { parentId: parentElement.id }
            });
          }
        }
      }
    }

    // Record import in history
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: 'canvas_import',
        newState: {
          importedElements: importedElements.length,
          replaceExisting,
          importedAt: new Date()
        },
        userId
      }
    });

    // Get complete updated canvas
    const updatedCanvas = await prisma.canvas.findUnique({
      where: { id: canvas.id },
      include: {
        elements: {
          include: {
            interactions: true,
            validations: true,
            children: true
          },
          orderBy: { zIndex: 'asc' }
        }
      }
    });

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit('canvas:imported', {
        appId: parseInt(appId),
        canvas: updatedCanvas,
        importedElements: importedElements.length,
        importedBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: updatedCanvas,
      message: `Canvas imported successfully with ${importedElements.length} elements`
    });

  } catch (error) {
    console.error('Canvas import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import canvas'
    });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
