const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

describe('Template System APIs', () => {
  let authToken;
  let testUserId;
  let testTemplateId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('testpass123', 12);
    const testUser = await prisma.user.create({
      data: {
        email: 'test-templates@example.com',
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
        email: 'test-templates@example.com',
        password: 'testpass123'
      });

    authToken = loginResponse.body.data.accessToken;

    // Ensure we have at least one template for testing
    const templateCount = await prisma.template.count();
    if (templateCount === 0) {
      const template = await prisma.template.create({
        data: {
          name: 'Test Template',
          description: 'A test template for Jest testing',
          preview_image: 'https://via.placeholder.com/150',
          app_schema: { layout: 'test', components: [] },
          category: 'Test'
        }
      });
      testTemplateId = template.id;
    } else {
      const template = await prisma.template.findFirst();
      testTemplateId = template.id;
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.app.deleteMany({ where: { ownerId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('GET /api/templates', () => {
    it('should list all available templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toBeInstanceOf(Array);
      expect(response.body.data.templates.length).toBeGreaterThan(0);
      
      // Check template structure
      const template = response.body.data.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('preview_image');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('createdAt');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/templates');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return templates sorted by name', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const templates = response.body.data.templates;
      
      // Check if sorted by name
      for (let i = 1; i < templates.length; i++) {
        expect(templates[i].name >= templates[i-1].name).toBe(true);
      }
    });
  });

  describe('POST /api/apps with templates', () => {
    it('should create app with template successfully', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template App',
          description: 'App created from template',
          templateId: testTemplateId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.name).toBe('Test Template App');
      expect(response.body.data.app.templateId).toBe(testTemplateId);
      expect(response.body.data.app.status).toBe('Draft');
      expect(response.body.data.app.ownerId).toBe(testUserId);
    });

    it('should create app without template', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Custom App',
          description: 'App without template'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.templateId).toBeNull();
    });

    it('should return error for invalid template ID', async () => {
      const response = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Template App',
          templateId: 99999
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Template not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/apps')
        .send({
          name: 'Unauthorized App',
          templateId: testTemplateId
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/apps with template relationships', () => {
    let testAppId;

    beforeAll(async () => {
      // Create a test app with template
      const app = await prisma.app.create({
        data: {
          name: 'Template Relationship Test App',
          description: 'Testing template relationships',
          status: 'Draft',
          ownerId: testUserId,
          templateId: testTemplateId
        }
      });
      testAppId = app.id;
    });

    it('should include template details in app list', async () => {
      const response = await request(app)
        .get('/api/apps')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const apps = response.body.data.apps;
      const templateApp = apps.find(app => app.id === testAppId);
      
      expect(templateApp).toBeDefined();
      expect(templateApp.templateId).toBe(testTemplateId);
      expect(templateApp.template).toBeDefined();
      expect(templateApp.template.id).toBe(testTemplateId);
      expect(templateApp.template.name).toBeDefined();
      expect(templateApp.template.category).toBeDefined();
    });

    it('should include template details in app status', async () => {
      const response = await request(app)
        .get(`/api/apps/${testAppId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.template).toBeDefined();
      expect(response.body.data.app.template.id).toBe(testTemplateId);
    });
  });

  describe('Template Categories', () => {
    it('should have diverse template categories', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const templates = response.body.data.templates;
      const categories = [...new Set(templates.map(t => t.category))];
      
      // Should have multiple categories
      expect(categories.length).toBeGreaterThan(1);
      
      // Check for expected categories from Phase 4
      const expectedCategories = ['Forms', 'Dashboards', 'E-commerce', 'Insurance', 'CRM'];
      const hasExpectedCategories = expectedCategories.some(cat => categories.includes(cat));
      expect(hasExpectedCategories).toBe(true);
    });
  });

  describe('Template Integration Workflow', () => {
    it('should complete full template-to-app workflow', async () => {
      // 1. Get templates
      const templatesResponse = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(templatesResponse.status).toBe(200);
      const templates = templatesResponse.body.data.templates;
      expect(templates.length).toBeGreaterThan(0);
      
      // 2. Create app from first template
      const template = templates[0];
      const createResponse = await request(app)
        .post('/api/apps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Workflow Test - ${template.name}`,
          description: 'Full workflow test',
          templateId: template.id
        });
      
      expect(createResponse.status).toBe(201);
      const app = createResponse.body.data.app;
      expect(app.templateId).toBe(template.id);
      
      // 3. Verify app appears in list with template
      const appsResponse = await request(app)
        .get('/api/apps')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(appsResponse.status).toBe(200);
      const createdApp = appsResponse.body.data.apps.find(a => a.id === app.id);
      expect(createdApp).toBeDefined();
      expect(createdApp.template.name).toBe(template.name);
      
      // 4. Check app status includes template info
      const statusResponse = await request(app)
        .get(`/api/apps/${app.id}/status`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.app.template.name).toBe(template.name);
    });
  });
});
