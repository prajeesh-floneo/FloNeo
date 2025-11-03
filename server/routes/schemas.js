const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// POST /api/schemas/:id/data - Store data for schema
router.post('/:id/data', async (req, res) => {
  try {
    const schemaId = parseInt(req.params.id);
    const { data } = req.body;

    // Validate data
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Data is required and must be an object'
      });
    }

    // Check if schema exists and user has access
    const schema = await prisma.appSchema.findFirst({
      where: { id: schemaId },
      include: {
        project: {
          select: {
            ownerId: true,
            members: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!schema) {
      return res.status(404).json({
        success: false,
        message: 'Schema not found'
      });
    }

    // Check access (owner or member)
    const userId = req.user.id;
    const hasAccess = schema.project.ownerId === userId || 
                     schema.project.members.some(member => member.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Store data
    const appData = await prisma.appData.create({
      data: {
        schemaId,
        data
      }
    });

    console.log(`Data stored for schema ${schemaId}: ${JSON.stringify(data)}`);

    res.status(201).json({
      success: true,
      message: 'Data stored successfully',
      data: {
        id: appData.id,
        schemaId: appData.schemaId,
        data: appData.data,
        createdAt: appData.createdAt
      }
    });

  } catch (error) {
    console.error('Store data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store data'
    });
  }
});

// GET /api/schemas/:id/data - Get data for schema
router.get('/:id/data', async (req, res) => {
  try {
    const schemaId = parseInt(req.params.id);

    // Check if schema exists and user has access
    const schema = await prisma.appSchema.findFirst({
      where: { id: schemaId },
      include: {
        project: {
          select: {
            ownerId: true,
            members: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!schema) {
      return res.status(404).json({
        success: false,
        message: 'Schema not found'
      });
    }

    // Check access (owner or member)
    const userId = req.user.id;
    const hasAccess = schema.project.ownerId === userId || 
                     schema.project.members.some(member => member.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get data
    const appData = await prisma.appData.findMany({
      where: { schemaId },
      select: {
        id: true,
        data: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: appData
    });

  } catch (error) {
    console.error('Get schema data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get schema data'
    });
  }
});

module.exports = router;
