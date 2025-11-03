const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// GET /api/videos - List videos with category filter
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    // Build where clause
    const where = {};
    if (category) {
      where.category = category;
    }

    const videos = await prisma.video.findMany({
      where,
      select: {
        id: true,
        title: true,
        url: true,
        category: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Video list retrieved: ${videos.length} videos${category ? ` (category: ${category})` : ''}`);

    res.json({
      success: true,
      data: videos
    });

  } catch (error) {
    console.error('List videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list videos'
    });
  }
});

// POST /api/videos - Create new video (admin only)
router.post('/', async (req, res) => {
  try {
    const { title, url, category } = req.body;

    // Basic validation
    if (!title || !url || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, URL, and category are required'
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const video = await prisma.video.create({
      data: {
        title,
        url,
        category
      }
    });

    console.log(`Video created: ${title} (${category})`);

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: {
        id: video.id,
        title: video.title,
        url: video.url,
        category: video.category,
        createdAt: video.createdAt
      }
    });

  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create video'
    });
  }
});

module.exports = router;
