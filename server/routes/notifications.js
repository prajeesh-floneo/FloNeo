const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth');
// Admin functionality removed - developer-only platform
const { validate } = require('../utils/validation');
const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// Admin notification sending removed - developer-only platform

// GET /api/notifications/read - Mark user's notifications as read and return them
router.get('/read', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all unread notifications for the user
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId: userId,
        read: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Mark all user's unread notifications as read
    await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false
      },
      data: {
        read: true
      }
    });

    console.log(`Notifications marked read for user ${userId}`);

    // Return the notifications that were marked as read
    const notifications = unreadNotifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      message: notification.message,
      read: true, // Now marked as read
      createdAt: notification.createdAt
    }));

    res.json({
      success: true,
      message: `${notifications.length} notifications marked as read`,
      data: notifications
    });

  } catch (error) {
    console.error('Read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read notifications'
    });
  }
});

// GET /api/notifications - Get user's notifications (optional endpoint)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, unreadOnly = false } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      userId: userId
    };

    if (unreadOnly === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take,
      select: {
        id: true,
        type: true,
        message: true,
        read: true,
        createdAt: true
      }
    });

    const total = await prisma.notification.count({ where });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
});

module.exports = router;
