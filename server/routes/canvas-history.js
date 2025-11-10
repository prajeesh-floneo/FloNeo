const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

let io; // Socket.io instance

// Inject Socket.io instance
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// ===== CANVAS HISTORY MANAGEMENT =====

// GET /api/canvas/:appId/history - Get canvas history
router.get('/:appId/history', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50, action } = req.query;

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

    // Get canvas
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) }
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        message: 'Canvas not found'
      });
    }

    const where = { canvasId: canvas.id };
    if (action) {
      where.action = action;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [history, total] = await Promise.all([
      prisma.canvasHistory.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.canvasHistory.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get canvas history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve canvas history'
    });
  }
});

// POST /api/canvas/:appId/undo - Undo last action
router.post('/:appId/undo', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

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

    // Get canvas
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) }
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        message: 'Canvas not found'
      });
    }

    // Get the last action that can be undone
    const lastAction = await prisma.canvasHistory.findFirst({
      where: {
        canvasId: canvas.id,
        userId, // Only undo user's own actions
        action: {
          not: 'undo' // Don't undo an undo action
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastAction) {
      return res.status(400).json({
        success: false,
        message: 'No actions to undo'
      });
    }

    let undoResult = null;

    // Handle different action types
    switch (lastAction.action) {
      case 'element_create':
        // Delete the created element
        if (lastAction.elementId) {
          await prisma.canvasElement.delete({
            where: { elementId: lastAction.elementId }
          });
          undoResult = { action: 'element_deleted', elementId: lastAction.elementId };
        }
        break;

      case 'element_delete':
        // Recreate the deleted element
        if (lastAction.oldState && lastAction.elementId) {
          const elementData = lastAction.oldState;
          await prisma.canvasElement.create({
            data: {
              canvasId: canvas.id,
              elementId: lastAction.elementId,
              type: elementData.type,
              name: elementData.name,
              x: elementData.x,
              y: elementData.y,
              width: elementData.width,
              height: elementData.height,
              rotation: elementData.rotation,
              zIndex: elementData.zIndex,
              locked: elementData.locked,
              visible: elementData.visible,
              groupId: elementData.groupId,
              parentId: elementData.parentId,
              properties: elementData.properties,
              styles: elementData.styles,
              constraints: elementData.constraints
            }
          });
          undoResult = { action: 'element_restored', elementId: lastAction.elementId };
        }
        break;

      case 'element_update':
        // Restore element to previous state
        if (lastAction.oldState && lastAction.elementId) {
          const oldState = lastAction.oldState;
          await prisma.canvasElement.update({
            where: { elementId: lastAction.elementId },
            data: {
              name: oldState.name,
              x: oldState.x,
              y: oldState.y,
              width: oldState.width,
              height: oldState.height,
              rotation: oldState.rotation,
              zIndex: oldState.zIndex,
              locked: oldState.locked,
              visible: oldState.visible,
              groupId: oldState.groupId,
              parentId: oldState.parentId,
              properties: oldState.properties,
              styles: oldState.styles,
              constraints: oldState.constraints
            }
          });
          undoResult = { action: 'element_reverted', elementId: lastAction.elementId };
        }
        break;

      case 'canvas_update':
        // Restore canvas to previous state
        if (lastAction.oldState) {
          const oldState = lastAction.oldState;
          await prisma.canvas.update({
            where: { id: canvas.id },
            data: {
              name: oldState.name,
              description: oldState.description,
              width: oldState.width,
              height: oldState.height,
              background: oldState.background,
              gridEnabled: oldState.gridEnabled,
              snapEnabled: oldState.snapEnabled,
              zoomLevel: oldState.zoomLevel
            }
          });
          undoResult = { action: 'canvas_reverted' };
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Cannot undo action type: ${lastAction.action}`
        });
    }

    // Record the undo action
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: 'undo',
        elementId: lastAction.elementId,
        oldState: lastAction.newState,
        newState: lastAction.oldState,
        userId
      }
    });

    // Get updated canvas state
    const updatedCanvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
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
      io.to(`app:${appId}`).emit('canvas:undo', {
        appId: parseInt(appId),
        canvas: updatedCanvas,
        undoResult,
        undoneBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        canvas: updatedCanvas,
        undoResult
      },
      message: 'Action undone successfully'
    });

  } catch (error) {
    console.error('Undo action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to undo action'
    });
  }
});

// POST /api/canvas/:appId/redo - Redo last undone action
router.post('/:appId/redo', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

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

    // Get canvas
    const canvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) }
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        message: 'Canvas not found'
      });
    }

    // Get the last undo action that can be redone
    const lastUndo = await prisma.canvasHistory.findFirst({
      where: {
        canvasId: canvas.id,
        userId,
        action: 'undo'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastUndo) {
      return res.status(400).json({
        success: false,
        message: 'No actions to redo'
      });
    }

    let redoResult = null;

    // Redo is essentially applying the newState from the undo action
    if (lastUndo.elementId) {
      // Element-specific redo
      if (lastUndo.newState) {
        const newState = lastUndo.newState;
        await prisma.canvasElement.update({
          where: { elementId: lastUndo.elementId },
          data: {
            name: newState.name,
            x: newState.x,
            y: newState.y,
            width: newState.width,
            height: newState.height,
            rotation: newState.rotation,
            zIndex: newState.zIndex,
            locked: newState.locked,
            visible: newState.visible,
            groupId: newState.groupId,
            parentId: newState.parentId,
            properties: newState.properties,
            styles: newState.styles,
            constraints: newState.constraints
          }
        });
        redoResult = { action: 'element_redone', elementId: lastUndo.elementId };
      }
    } else {
      // Canvas-specific redo
      if (lastUndo.newState) {
        const newState = lastUndo.newState;
        await prisma.canvas.update({
          where: { id: canvas.id },
          data: {
            name: newState.name,
            description: newState.description,
            width: newState.width,
            height: newState.height,
            background: newState.background,
            gridEnabled: newState.gridEnabled,
            snapEnabled: newState.snapEnabled,
            zoomLevel: newState.zoomLevel
          }
        });
        redoResult = { action: 'canvas_redone' };
      }
    }

    // Record the redo action
    await prisma.canvasHistory.create({
      data: {
        canvasId: canvas.id,
        action: 'redo',
        elementId: lastUndo.elementId,
        oldState: lastUndo.oldState,
        newState: lastUndo.newState,
        userId
      }
    });

    // Get updated canvas state
    const updatedCanvas = await prisma.canvas.findUnique({
      where: { appId: parseInt(appId) },
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
      io.to(`app:${appId}`).emit('canvas:redo', {
        appId: parseInt(appId),
        canvas: updatedCanvas,
        redoResult,
        redoneBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        canvas: updatedCanvas,
        redoResult
      },
      message: 'Action redone successfully'
    });

  } catch (error) {
    console.error('Redo action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to redo action'
    });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
