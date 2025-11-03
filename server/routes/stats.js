const express = require('express');
const { PrismaClient } = require('@prisma/client');
const NodeCache = require('node-cache');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Cache with 60 seconds TTL
const cache = new NodeCache({ stdTTL: 60 });

// All routes require authentication
router.use(authenticateToken);

// GET /api/stats - Get platform statistics
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'platform_stats';
    const startTime = Date.now();
    
    // Check cache first
    const cachedStats = cache.get(cacheKey);
    if (cachedStats) {
      const responseTime = Date.now() - startTime;
      console.log(`Stats retrieved from cache: total ${cachedStats.totalProjects} (${responseTime}ms)`);
      return res.json({
        success: true,
        data: cachedStats,
        cached: true,
        responseTime: responseTime
      });
    }

    // Get total projects count
    const totalProjects = await prisma.project.count({
      where: {
        deletedAt: null
      }
    });

    // Get draft projects count
    const draftProjects = await prisma.project.count({
      where: {
        status: 'DRAFT',
        deletedAt: null
      }
    });

    // Get active (running) projects count
    const activeProjects = await prisma.project.count({
      where: {
        status: 'RUNNING',
        deletedAt: null
      }
    });

    // Get daily creation counts for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyProjects = await prisma.project.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: sevenDaysAgo
        },
        deletedAt: null
      },
      _count: {
        id: true
      }
    });

    // Process timeline data
    const timelines = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = dailyProjects.filter(project => {
        const projectDate = new Date(project.createdAt).toISOString().split('T')[0];
        return projectDate === dateStr;
      }).reduce((sum, project) => sum + project._count.id, 0);
      
      timelines.push({
        date: dateStr,
        count: count
      });
    }

    const stats = {
      totalProjects,
      draftProjects,
      activeProjects,
      timelines
    };

    // Cache the results
    cache.set(cacheKey, stats);
    
    const responseTime = Date.now() - startTime;
    console.log(`Stats retrieved from database: total ${totalProjects} (${responseTime}ms)`);

    res.json({
      success: true,
      data: stats,
      cached: false,
      responseTime: responseTime
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;
