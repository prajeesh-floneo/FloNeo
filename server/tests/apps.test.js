const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

describe('App Management APIs', () => {
  let authToken;
  let testUserId;
  let testAppId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('testpass123', 12);
    const testUser = await prisma.user.create({
      data: {
        email: 'test-apps@example.com',
        password: hashedPassword,
        role: 'developer',
        verified: true
      }
    });
    testUserId = testUser.id;

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test-apps@example.com',
        password: 'testpass123'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.app.deleteMany({ where: { ownerId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('POST /api/apps', () => {
    it('should create a new app successfully', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test App',
          description: 'A test application'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.name).toBe('Test App');
      expect(response.body.data.app.status).toBe('Draft');
      expect(response.body.data.app.ownerId).toBe(testUserId);

      testAppId = response.body.data.app.id;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/apps')
        .send({
          name: 'Unauthorized App'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'App without name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/apps', () => {
    it('should list user apps with pagination', async () => {
      const response = await request(app)
        .get('/api/apps')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.apps).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    it('should filter apps by status', async () => {
      const response = await request(app)
        .get('/api/apps?status=Draft')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.apps.every(app => app.status === 'Draft')).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/apps');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/apps/:id/status', () => {
    it('should get app status and metrics', async () => {
      const response = await request(app)
        .get(`/api/apps/${testAppId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.id).toBe(testAppId);
      expect(response.body.data.metrics).toHaveProperty('activeDays');
      expect(response.body.data.metrics).toHaveProperty('users');
      expect(response.body.data.metrics).toHaveProperty('traffic');
    });

    it('should return 404 for non-existent app', async () => {
      const response = await request(app)
        .get('/api/apps/99999/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/apps/${testAppId}/status`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/apps/:id/status', () => {
    it('should update app status successfully', async () => {
      const response = await request(app)
        .put(`/api/apps/${testAppId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Published'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.status).toBe('Published');
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .put(`/api/apps/${testAppId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'InvalidStatus'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent app', async () => {
      const response = await request(app)
        .put('/api/apps/99999/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Active'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/templates', () => {
    it('should list available templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toBeInstanceOf(Array);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/templates');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
