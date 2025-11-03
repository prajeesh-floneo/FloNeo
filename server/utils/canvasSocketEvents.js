// Real-time canvas collaboration events and utilities

/**
 * Initialize canvas-specific Socket.io events
 */
const initializeCanvasEvents = (io) => {
  
  // Global function to emit canvas updates
  global.emitCanvasUpdate = (appId, eventType, data) => {
    io.to(`app:${appId}`).emit(eventType, {
      appId: parseInt(appId),
      ...data,
      timestamp: new Date()
    });
    console.log(`🎨 Canvas event emitted: ${eventType} for app ${appId}`);
  };

  // Global function to emit element updates
  global.emitElementUpdate = (appId, eventType, elementData, userId) => {
    io.to(`app:${appId}`).emit(eventType, {
      appId: parseInt(appId),
      element: elementData,
      updatedBy: userId,
      timestamp: new Date()
    });
    console.log(`🔧 Element event emitted: ${eventType} for app ${appId}`);
  };

  // Global function to emit bulk element updates
  global.emitBulkElementUpdate = (appId, eventType, elementsData, userId) => {
    io.to(`app:${appId}`).emit(eventType, {
      appId: parseInt(appId),
      elements: elementsData,
      updatedBy: userId,
      timestamp: new Date()
    });
    console.log(`🔧 Bulk element event emitted: ${eventType} for app ${appId}`);
  };

  // Handle canvas-specific socket connections
  io.on('connection', (socket) => {
    
    // Join canvas room for real-time collaboration
    socket.on('canvas:join', async (data) => {
      try {
        const { appId } = data;
        
        // Verify user has access to this app (already authenticated via middleware)
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const app = await prisma.app.findFirst({
          where: {
            id: parseInt(appId),
            ownerId: socket.userId
          }
        });

        if (app) {
          socket.join(`app:${appId}`);
          socket.currentAppId = appId;
          
          // Notify others that user joined canvas
          socket.to(`app:${appId}`).emit('canvas:user-joined', {
            appId: parseInt(appId),
            user: {
              id: socket.userId,
              email: socket.userEmail
            },
            timestamp: new Date()
          });
          
          console.log(`🎨 User ${socket.userEmail} joined canvas for app ${appId}`);
        }
        
        await prisma.$disconnect();
      } catch (error) {
        console.error('Canvas join error:', error);
      }
    });

    // Leave canvas room
    socket.on('canvas:leave', (data) => {
      try {
        const { appId } = data;
        
        socket.leave(`app:${appId}`);
        
        // Notify others that user left canvas
        socket.to(`app:${appId}`).emit('canvas:user-left', {
          appId: parseInt(appId),
          user: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
        
        console.log(`🎨 User ${socket.userEmail} left canvas for app ${appId}`);
      } catch (error) {
        console.error('Canvas leave error:', error);
      }
    });

    // Handle real-time element selection
    socket.on('element:select', (data) => {
      try {
        const { appId, elementId } = data;
        
        socket.to(`app:${appId}`).emit('element:selected-by-user', {
          appId: parseInt(appId),
          elementId,
          selectedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element select error:', error);
      }
    });

    // Handle real-time element deselection
    socket.on('element:deselect', (data) => {
      try {
        const { appId, elementId } = data;
        
        socket.to(`app:${appId}`).emit('element:deselected-by-user', {
          appId: parseInt(appId),
          elementId,
          deselectedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element deselect error:', error);
      }
    });

    // Handle real-time cursor movement
    socket.on('cursor:move', (data) => {
      try {
        const { appId, x, y } = data;
        
        socket.to(`app:${appId}`).emit('cursor:user-moved', {
          appId: parseInt(appId),
          cursor: { x, y },
          user: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Cursor move error:', error);
      }
    });

    // Handle real-time element dragging
    socket.on('element:drag-start', (data) => {
      try {
        const { appId, elementId, startPosition } = data;
        
        socket.to(`app:${appId}`).emit('element:drag-started-by-user', {
          appId: parseInt(appId),
          elementId,
          startPosition,
          draggedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element drag start error:', error);
      }
    });

    socket.on('element:drag-move', (data) => {
      try {
        const { appId, elementId, currentPosition } = data;
        
        socket.to(`app:${appId}`).emit('element:drag-moved-by-user', {
          appId: parseInt(appId),
          elementId,
          currentPosition,
          draggedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element drag move error:', error);
      }
    });

    socket.on('element:drag-end', (data) => {
      try {
        const { appId, elementId, finalPosition } = data;
        
        socket.to(`app:${appId}`).emit('element:drag-ended-by-user', {
          appId: parseInt(appId),
          elementId,
          finalPosition,
          draggedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element drag end error:', error);
      }
    });

    // Handle real-time element resizing
    socket.on('element:resize-start', (data) => {
      try {
        const { appId, elementId, startSize } = data;
        
        socket.to(`app:${appId}`).emit('element:resize-started-by-user', {
          appId: parseInt(appId),
          elementId,
          startSize,
          resizedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element resize start error:', error);
      }
    });

    socket.on('element:resize-move', (data) => {
      try {
        const { appId, elementId, currentSize } = data;
        
        socket.to(`app:${appId}`).emit('element:resize-moved-by-user', {
          appId: parseInt(appId),
          elementId,
          currentSize,
          resizedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element resize move error:', error);
      }
    });

    socket.on('element:resize-end', (data) => {
      try {
        const { appId, elementId, finalSize } = data;
        
        socket.to(`app:${appId}`).emit('element:resize-ended-by-user', {
          appId: parseInt(appId),
          elementId,
          finalSize,
          resizedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element resize end error:', error);
      }
    });

    // Handle canvas zoom and pan
    socket.on('canvas:zoom', (data) => {
      try {
        const { appId, zoomLevel, centerPoint } = data;
        
        socket.to(`app:${appId}`).emit('canvas:zoomed-by-user', {
          appId: parseInt(appId),
          zoomLevel,
          centerPoint,
          zoomedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Canvas zoom error:', error);
      }
    });

    socket.on('canvas:pan', (data) => {
      try {
        const { appId, panOffset } = data;
        
        socket.to(`app:${appId}`).emit('canvas:panned-by-user', {
          appId: parseInt(appId),
          panOffset,
          pannedBy: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Canvas pan error:', error);
      }
    });

    // Handle typing indicators for text elements
    socket.on('element:typing-start', (data) => {
      try {
        const { appId, elementId } = data;
        
        socket.to(`app:${appId}`).emit('element:user-typing', {
          appId: parseInt(appId),
          elementId,
          typingUser: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element typing start error:', error);
      }
    });

    socket.on('element:typing-stop', (data) => {
      try {
        const { appId, elementId } = data;
        
        socket.to(`app:${appId}`).emit('element:user-stopped-typing', {
          appId: parseInt(appId),
          elementId,
          typingUser: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Element typing stop error:', error);
      }
    });

    // Handle disconnect - clean up canvas presence
    socket.on('disconnect', () => {
      if (socket.currentAppId) {
        socket.to(`app:${socket.currentAppId}`).emit('canvas:user-disconnected', {
          appId: parseInt(socket.currentAppId),
          user: {
            id: socket.userId,
            email: socket.userEmail
          },
          timestamp: new Date()
        });
        
        console.log(`🎨 User ${socket.userEmail} disconnected from canvas ${socket.currentAppId}`);
      }
    });
  });
};

/**
 * Canvas event types for reference
 */
const CANVAS_EVENTS = {
  // Canvas-level events
  CANVAS_UPDATED: 'canvas:updated',
  CANVAS_IMPORTED: 'canvas:imported',
  CANVAS_EXPORTED: 'canvas:exported',
  CANVAS_UNDO: 'canvas:undo',
  CANVAS_REDO: 'canvas:redo',
  
  // Element events
  ELEMENT_CREATED: 'element:created',
  ELEMENT_UPDATED: 'element:updated',
  ELEMENT_DELETED: 'element:deleted',
  ELEMENT_DUPLICATED: 'element:duplicated',
  
  // Bulk operations
  ELEMENTS_BULK_UPDATED: 'elements:bulk-updated',
  ELEMENTS_BULK_DELETED: 'elements:bulk-deleted',
  ELEMENTS_GROUPED: 'elements:grouped',
  ELEMENTS_UNGROUPED: 'elements:ungrouped',
  
  // Real-time collaboration
  USER_JOINED_CANVAS: 'canvas:user-joined',
  USER_LEFT_CANVAS: 'canvas:user-left',
  USER_CURSOR_MOVED: 'cursor:user-moved',
  ELEMENT_SELECTED: 'element:selected-by-user',
  ELEMENT_DESELECTED: 'element:deselected-by-user',
  ELEMENT_DRAG_STARTED: 'element:drag-started-by-user',
  ELEMENT_DRAG_MOVED: 'element:drag-moved-by-user',
  ELEMENT_DRAG_ENDED: 'element:drag-ended-by-user',
  ELEMENT_RESIZE_STARTED: 'element:resize-started-by-user',
  ELEMENT_RESIZE_MOVED: 'element:resize-moved-by-user',
  ELEMENT_RESIZE_ENDED: 'element:resize-ended-by-user',
  CANVAS_ZOOMED: 'canvas:zoomed-by-user',
  CANVAS_PANNED: 'canvas:panned-by-user',
  ELEMENT_TYPING: 'element:user-typing',
  ELEMENT_STOPPED_TYPING: 'element:user-stopped-typing'
};

module.exports = {
  initializeCanvasEvents,
  CANVAS_EVENTS
};
