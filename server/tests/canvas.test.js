const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Canvas API', () => {
  let authToken;
  let testUser;
  let testApp;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'canvas-test@example.com',
        password: 'hashedpassword',
        role: 'developer',
        verified: true
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test app
    testApp = await prisma.app.create({
      data: {
        name: 'Canvas Test App',
        description: 'Test app for canvas functionality',
        ownerId: testUser.id,
        status: 'Draft'
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.canvasHistory.deleteMany({ where: { userId: testUser.id } });
    await prisma.canvasElement.deleteMany({});
    await prisma.canvas.deleteMany({ where: { appId: testApp.id } });
    await prisma.app.delete({ where: { id: testApp.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  describe('GET /api/canvas/:appId', () => {
    it('should get or create canvas for app', async () => {
      const response = await request(app)
        .get(`/api/canvas/${testApp.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('appId', testApp.id);
      expect(response.body.data).toHaveProperty('elements');
      expect(Array.isArray(response.body.data.elements)).toBe(true);
    });

    it('should return 404 for non-existent app', async () => {
      const response = await request(app)
        .get('/api/canvas/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('App not found');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get(`/api/canvas/${testApp.id}`)
        .expect(401);
    });
  });

  describe('PUT /api/canvas/:appId', () => {
    it('should update canvas properties', async () => {
      const updateData = {
        name: 'Updated Canvas Name',
        description: 'Updated description',
        width: 1600,
        height: 1000,
        background: { color: '#f0f0f0', opacity: 90 },
        gridEnabled: false,
        snapEnabled: false,
        zoomLevel: 1.5
      };

      const response = await request(app)
        .put(`/api/canvas/${testApp.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.width).toBe(updateData.width);
      expect(response.body.data.height).toBe(updateData.height);
      expect(response.body.data.gridEnabled).toBe(updateData.gridEnabled);
    });
  });

  describe('POST /api/canvas/:appId/elements', () => {
    it('should create new element', async () => {
      const elementData = {
        type: 'TEXT_FIELD',
        name: 'Test Text Field',
        x: 100,
        y: 200,
        width: 300,
        height: 40,
        properties: {
          placeholder: 'Enter text here',
          required: true
        },
        styles: {
          fill: { color: '#ffffff', opacity: 100 },
          stroke: { color: '#000000', opacity: 100, weight: 1 }
        }
      };

      const response = await request(app)
        .post(`/api/canvas/${testApp.id}/elements`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(elementData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('elementId');
      expect(response.body.data.type).toBe(elementData.type);
      expect(response.body.data.name).toBe(elementData.name);
      expect(response.body.data.x).toBe(elementData.x);
      expect(response.body.data.y).toBe(elementData.y);
    });

    it('should validate element type', async () => {
      const invalidElementData = {
        type: 'INVALID_TYPE',
        name: 'Invalid Element'
      };

      const response = await request(app)
        .post(`/api/canvas/${testApp.id}/elements`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidElementData)
        .expect(500); // Should fail due to enum constraint

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/canvas/:appId/elements/:elementId', () => {
    let testElement;

    beforeEach(async () => {
      // Create test element
      const canvas = await prisma.canvas.findUnique({
        where: { appId: testApp.id }
      });

      testElement = await prisma.canvasElement.create({
        data: {
          canvasId: canvas.id,
          elementId: 'test-element-' + Date.now(),
          type: 'BUTTON',
          name: 'Test Button',
          x: 50,
          y: 50,
          width: 100,
          height: 30,
          properties: { text: 'Click me' }
        }
      });
    });

    afterEach(async () => {
      if (testElement) {
        await prisma.canvasElement.delete({ where: { id: testElement.id } });
      }
    });

    it('should update element properties', async () => {
      const updateData = {
        name: 'Updated Button',
        x: 150,
        y: 150,
        properties: { text: 'Updated text' }
      };

      const response = await request(app)
        .put(`/api/canvas/${testApp.id}/elements/${testElement.elementId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.x).toBe(updateData.x);
      expect(response.body.data.y).toBe(updateData.y);
    });

    it('should return 404 for non-existent element', async () => {
      const response = await request(app)
        .put(`/api/canvas/${testApp.id}/elements/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Element not found');
    });
  });

  describe('DELETE /api/canvas/:appId/elements/:elementId', () => {
    let testElement;

    beforeEach(async () => {
      const canvas = await prisma.canvas.findUnique({
        where: { appId: testApp.id }
      });

      testElement = await prisma.canvasElement.create({
        data: {
          canvasId: canvas.id,
          elementId: 'delete-test-' + Date.now(),
          type: 'TEXT_FIELD',
          name: 'Delete Test',
          x: 0,
          y: 0,
          width: 100,
          height: 30
        }
      });
    });

    it('should delete element', async () => {
      const response = await request(app)
        .delete(`/api/canvas/${testApp.id}/elements/${testElement.elementId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify element is deleted
      const deletedElement = await prisma.canvasElement.findUnique({
        where: { elementId: testElement.elementId }
      });
      expect(deletedElement).toBeNull();
    });
  });

  describe('POST /api/canvas/:appId/elements/:elementId/duplicate', () => {
    let testElement;

    beforeEach(async () => {
      const canvas = await prisma.canvas.findUnique({
        where: { appId: testApp.id }
      });

      testElement = await prisma.canvasElement.create({
        data: {
          canvasId: canvas.id,
          elementId: 'duplicate-test-' + Date.now(),
          type: 'IMAGE',
          name: 'Duplicate Test',
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          properties: { src: 'test.jpg', alt: 'Test image' }
        }
      });
    });

    afterEach(async () => {
      // Clean up duplicated elements
      await prisma.canvasElement.deleteMany({
        where: {
          name: { contains: 'Duplicate Test' }
        }
      });
    });

    it('should duplicate element with offset', async () => {
      const response = await request(app)
        .post(`/api/canvas/${testApp.id}/elements/${testElement.elementId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ offsetX: 50, offsetY: 50 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Duplicate Test Copy');
      expect(response.body.data.x).toBe(150); // Original x + offset
      expect(response.body.data.y).toBe(150); // Original y + offset
      expect(response.body.data.type).toBe(testElement.type);
    });
  });

  describe('PUT /api/canvas/:appId/elements/bulk', () => {
    let testElements = [];

    beforeEach(async () => {
      const canvas = await prisma.canvas.findUnique({
        where: { appId: testApp.id }
      });

      // Create multiple test elements
      for (let i = 0; i < 3; i++) {
        const element = await prisma.canvasElement.create({
          data: {
            canvasId: canvas.id,
            elementId: `bulk-test-${i}-${Date.now()}`,
            type: 'SHAPE',
            name: `Bulk Test ${i}`,
            x: i * 100,
            y: i * 50,
            width: 50,
            height: 50
          }
        });
        testElements.push(element);
      }
    });

    afterEach(async () => {
      // Clean up test elements
      const elementIds = testElements.map(el => el.id);
      await prisma.canvasElement.deleteMany({
        where: { id: { in: elementIds } }
      });
      testElements = [];
    });

    it('should bulk update elements', async () => {
      const updates = testElements.map((element, index) => ({
        elementId: element.elementId,
        updateData: {
          x: 500 + index * 10,
          y: 300 + index * 10
        }
      }));

      const response = await request(app)
        .put(`/api/canvas/${testApp.id}/elements/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ elements: updates })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].x).toBe(500);
      expect(response.body.data[1].x).toBe(510);
    });
  });

  describe('Canvas History', () => {
    it('should get canvas history', async () => {
      const response = await request(app)
        .get(`/api/canvas/${testApp.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });
  });
});
