const request = require('supertest');
const app = require('../index');
const nock = require('nock');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Stats API', () => {
  let authToken;
  let testUser;
  let testProjects = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'statstest@example.com',
        password: '$2b$12$LQv3c1yqBwEHFl5L5KcYCOqkUYvDADpVWKpbOxhG9yxdoABhdxm2G', // hashed "password123"
        role: 'admin',
        verified: true
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create 10 test projects: 5 DRAFT, 5 RUNNING
    const projectPromises = [];
    
    for (let i = 1; i <= 5; i++) {
      projectPromises.push(
        prisma.project.create({
          data: {
            name: `Draft Project ${i}`,
            description: `Test draft project ${i}`,
            status: 'DRAFT',
            ownerId: testUser.id
          }
        })
      );
    }

    for (let i = 1; i <= 5; i++) {
      projectPromises.push(
        prisma.project.create({
          data: {
            name: `Running Project ${i}`,
            description: `Test running project ${i}`,
            status: 'RUNNING',
            ownerId: testUser.id
          }
        })
      );
    }

    testProjects = await Promise.all(projectPromises);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.project.deleteMany({
      where: {
        ownerId: testUser.id
      }
    });

    await prisma.user.delete({
      where: { id: testUser.id }
    });

    await prisma.$disconnect();
  });

  describe('GET /api/stats', () => {
    it('should return platform statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalProjects');
      expect(response.body.data).toHaveProperty('draftProjects');
      expect(response.body.data).toHaveProperty('activeProjects');
      expect(response.body.data).toHaveProperty('timelines');

      // Check that we have at least our test projects
      expect(response.body.data.totalProjects).toBeGreaterThanOrEqual(10);
      expect(response.body.data.draftProjects).toBeGreaterThanOrEqual(5);
      expect(response.body.data.activeProjects).toBeGreaterThanOrEqual(5);

      // Check timeline structure
      expect(Array.isArray(response.body.data.timelines)).toBe(true);
      expect(response.body.data.timelines).toHaveLength(7); // 7 days

      response.body.data.timelines.forEach(timeline => {
        expect(timeline).toHaveProperty('date');
        expect(timeline).toHaveProperty('count');
        expect(typeof timeline.date).toBe('string');
        expect(typeof timeline.count).toBe('number');
      });
    });

    it('should return cached results on second call', async () => {
      // First call
      const response1 = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response1.body.cached).toBe(false);

      // Second call should be cached
      const response2 = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response2.body.cached).toBe(true);
      expect(response2.body.responseTime).toBeLessThan(50); // Cached should be faster
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/stats')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/stats')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle missing authorization header', async () => {
      await request(app)
        .get('/api/stats')
        .expect(401);
    });

    it('should handle malformed authorization header', async () => {
      await request(app)
        .get('/api/stats')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllTimers();
  });
});
