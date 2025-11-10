const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
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

// ===== BULK OPERATIONS =====

// PUT /api/canvas/:appId/elements/bulk - Bulk update elements
router.put('/:appId/elements/bulk', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { elements } = req.body; // Array of {elementId, updateData}

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

    const updatedElements = [];
    const historyEntries = [];

    // Process each element update
    for (const { elementId, updateData } of elements) {
      try {
        // Get current state for history
        const currentElement = await prisma.canvasElement.findUnique({
          where: { elementId }
        });

        if (currentElement) {
          // Update element
          const updatedElement = await prisma.canvasElement.update({
            where: { elementId },
            data: {
              ...(updateData.x !== undefined && { x: parseFloat(updateData.x) }),
              ...(updateData.y !== undefined && { y: parseFloat(updateData.y) }),
              ...(updateData.width !== undefined && { width: parseFloat(updateData.width) }),
              ...(updateData.height !== undefined && { height: parseFloat(updateData.height) }),
              ...(updateData.rotation !== undefined && { rotation: parseFloat(updateData.rotation) }),
              ...(updateData.zIndex !== undefined && { zIndex: parseInt(updateData.zIndex) }),
              ...(updateData.locked !== undefined && { locked: updateData.locked }),
              ...(updateData.visible !== undefined && { visible: updateData.visible }),
              ...(updateData.groupId !== undefined && { groupId: updateData.groupId }),
              ...(updateData.properties && { properties: updateData.properties }),
              ...(updateData.styles && { styles: updateData.styles })
            },
            include: {
              interactions: true,
              validations: true,
              children: true
            }
          });

          updatedElements.push(updatedElement);

          // Prepare history entry
          historyEntries.push({
            canvasId: currentElement.canvasId,
            action: 'element_bulk_update',
            elementId,
            oldState: currentElement,
            newState: updatedElement,
            userId
          });
        }
      } catch (elementError) {
        console.error(`Error updating element ${elementId}:`, elementError);
      }
    }

    // Create history entries
    if (historyEntries.length > 0) {
      await prisma.canvasHistory.createMany({
        data: historyEntries
      });
    }

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit('elements:bulk-updated', {
        appId: parseInt(appId),
        elements: updatedElements,
        updatedBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: updatedElements,
      message: `${updatedElements.length} elements updated successfully`
    });

  } catch (error) {
    console.error('Bulk update elements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update elements'
    });
  }
});

// DELETE /api/canvas/:appId/elements/bulk - Bulk delete elements
router.delete('/:appId/elements/bulk', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { elementIds } = req.body; // Array of element IDs

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

    // Get elements for history
    const elementsToDelete = await prisma.canvasElement.findMany({
      where: {
        elementId: { in: elementIds }
      },
      include: {
        interactions: true,
        validations: true,
        children: true
      }
    });

    // Delete elements
    await prisma.canvasElement.deleteMany({
      where: {
        elementId: { in: elementIds }
      }
    });

    // Create history entries
    const historyEntries = elementsToDelete.map(element => ({
      canvasId: element.canvasId,
      action: 'element_bulk_delete',
      elementId: element.elementId,
      oldState: element,
      userId
    }));

    if (historyEntries.length > 0) {
      await prisma.canvasHistory.createMany({
        data: historyEntries
      });
    }

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit('elements:bulk-deleted', {
        appId: parseInt(appId),
        elementIds,
        deletedBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: `${elementsToDelete.length} elements deleted successfully`
    });

  } catch (error) {
    console.error('Bulk delete elements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk delete elements'
    });
  }
});

// ===== GROUPING OPERATIONS =====

// POST /api/canvas/:appId/groups - Create element group
router.post('/:appId/groups', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;
    const { elementIds, groupName } = req.body;

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

    // Generate group ID
    const groupId = uuidv4();

    // Update elements to be part of the group
    const updatedElements = await prisma.canvasElement.updateMany({
      where: {
        elementId: { in: elementIds }
      },
      data: {
        groupId
      }
    });

    // Get updated elements for response
    const groupedElements = await prisma.canvasElement.findMany({
      where: {
        elementId: { in: elementIds }
      },
      include: {
        interactions: true,
        validations: true,
        children: true
      }
    });

    // Record history
    if (groupedElements.length > 0) {
      await prisma.canvasHistory.create({
        data: {
          canvasId: groupedElements[0].canvasId,
          action: 'elements_grouped',
          newState: { groupId, elementIds, groupName },
          userId
        }
      });
    }

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit('elements:grouped', {
        appId: parseInt(appId),
        groupId,
        elements: groupedElements,
        groupedBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        groupId,
        elements: groupedElements
      },
      message: 'Elements grouped successfully'
    });

  } catch (error) {
    console.error('Group elements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to group elements'
    });
  }
});

// DELETE /api/canvas/:appId/groups/:groupId - Ungroup elements
router.delete('/:appId/groups/:groupId', authenticateToken, async (req, res) => {
  try {
    const { appId, groupId } = req.params;
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

    // Get elements in the group
    const groupedElements = await prisma.canvasElement.findMany({
      where: { groupId },
      include: {
        interactions: true,
        validations: true,
        children: true
      }
    });

    // Remove group ID from elements
    await prisma.canvasElement.updateMany({
      where: { groupId },
      data: { groupId: null }
    });

    // Record history
    if (groupedElements.length > 0) {
      await prisma.canvasHistory.create({
        data: {
          canvasId: groupedElements[0].canvasId,
          action: 'elements_ungrouped',
          oldState: { groupId, elementIds: groupedElements.map(e => e.elementId) },
          userId
        }
      });
    }

    // Emit real-time update
    if (io) {
      io.to(`app:${appId}`).emit('elements:ungrouped', {
        appId: parseInt(appId),
        groupId,
        elements: groupedElements,
        ungroupedBy: userId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: groupedElements,
      message: 'Elements ungrouped successfully'
    });

  } catch (error) {
    console.error('Ungroup elements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ungroup elements'
    });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
