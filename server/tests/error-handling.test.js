/**
 * Error Handling Tests for FloNeo LCNC Platform
 * Tests consistent error responses across all API endpoints
 */

const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Error Handling Tests', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Create test user and get auth token
    const testUser = await prisma.user.upsert({
      where: { email: 'error-test@developer.com' },
      update: {},
      create: {
        email: 'error-test@developer.com',
        password: '$2a$10$test.hash.for.error.testing',
        role: 'developer',
        verified: true
      }
    });
    testUserId = testUser.id;

    // Login to get token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'error-test@developer.com',
        password: 'test123'
      });

    if (loginResponse.body.success) {
      authToken = loginResponse.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.app.deleteMany({ where: { ownerId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe('Authentication Errors', () => {
    test('POST /auth/login - Invalid credentials (401)', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password',
        error: {
          code: 'INVALID_CREDENTIALS',
          statusCode: 401
        }
      });
      expect(response.body.error.timestamp).toBeDefined();
    });

    test('POST /auth/login - Missing required fields (400)', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Missing required fields: password',
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          statusCode: 400
        }
      });
    });

    test('POST /auth/login - Invalid email format (400)', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email-format',
          password: 'test123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email format provided',
        error: {
          code: 'INVALID_EMAIL_FORMAT',
          statusCode: 400
        }
      });
    });

    test('POST /auth/logout - Missing token (400)', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token required in Authorization header',
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          statusCode: 400
        }
      });
    });
  });

  describe('Authorization Errors', () => {
    test('GET /api/apps - Missing token (401)', async () => {
      const response = await request(app)
        .get('/api/apps');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401
        }
      });
    });

    test('GET /api/apps - Invalid token (401)', async () => {
      const response = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid authentication token provided',
        error: {
          code: 'INVALID_TOKEN',
          statusCode: 401
        }
      });
    });
  });

  describe('App Management Errors', () => {
    test('POST /api/apps - Missing required fields (400)', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test app without name'
          // Missing name field
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Missing required fields: name',
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          statusCode: 400
        }
      });
    });

    test('POST /api/apps - Invalid template ID (404)', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test App',
          description: 'Test description',
          templateId: 99999 // Non-existent template
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Template not found',
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          statusCode: 404
        }
      });
    });

    test('GET /api/apps/:id/status - Invalid app ID format (400)', async () => {
      const response = await request(app)
        .get('/api/apps/invalid-id/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid APP provided. Must be a positive integer',
        error: {
          code: 'INVALID_APP_ID',
          statusCode: 400
        }
      });
    });

    test('GET /api/apps/:id/status - App not found (404)', async () => {
      const response = await request(app)
        .get('/api/apps/99999/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'App not found or you do not have permission to access it',
        error: {
          code: 'APP_NOT_FOUND',
          statusCode: 404
        }
      });
    });
  });

  describe('Template Errors', () => {
    test('GET /api/templates - Missing token (401)', async () => {
      const response = await request(app)
        .get('/api/templates');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401
        }
      });
    });
  });

  describe('AI Endpoint Errors', () => {
    test('GET /api/floneo-ai/status - Missing token (401)', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/status');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401
        }
      });
    });

    test('GET /api/floneo-ai/ideas - Missing token (401)', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401
        }
      });
    });
  });

  describe('Error Response Format Consistency', () => {
    test('All error responses have consistent structure', async () => {
      const responses = await Promise.all([
        request(app).post('/auth/login').send({ email: 'invalid' }),
        request(app).get('/api/apps'),
        request(app).get('/api/templates'),
        request(app).get('/api/floneo-ai/status')
      ]);

      responses.forEach(response => {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('statusCode');
        expect(response.body.error).toHaveProperty('timestamp');
        
        // Timestamp should be valid ISO string
        expect(new Date(response.body.error.timestamp).toISOString()).toBe(response.body.error.timestamp);
      });
    });

    test('Success responses have consistent structure', async () => {
      if (!authToken) {
        console.log('Skipping success response test - no auth token available');
        return;
      }

      const responses = await Promise.all([
        request(app).get('/api/templates').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/floneo-ai/status').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/floneo-ai/ideas').set('Authorization', `Bearer ${authToken}`)
      ]);

      responses.forEach(response => {
        if (response.status < 400) {
          expect(response.body).toHaveProperty('success', true);
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('timestamp');
          expect(response.body).toHaveProperty('data');
          
          // Timestamp should be valid ISO string
          expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
        }
      });
    });
  });
});
