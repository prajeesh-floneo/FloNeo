const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

describe('Floneo AI Endpoints', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('testpass123', 12);
    const testUser = await prisma.user.create({
      data: {
        email: 'test-ai@example.com',
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
        email: 'test-ai@example.com',
        password: 'testpass123'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('GET /api/floneo-ai/status', () => {
    it('should return AI system status', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.totalIdeas).toBeGreaterThan(0);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data.capabilities).toBeInstanceOf(Array);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/status');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/floneo-ai/ideas', () => {
    it('should return all AI ideas', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ideas).toBeInstanceOf(Array);
      expect(response.body.data.ideas.length).toBeGreaterThan(0);
      expect(response.body.data.totalIdeas).toBeGreaterThan(0);
      expect(response.body.data.generatedAt).toBeDefined();
      expect(response.body.data.aiEngine).toBe('Floneo AI v1.0');

      // Check idea structure
      const idea = response.body.data.ideas[0];
      expect(idea).toHaveProperty('id');
      expect(idea).toHaveProperty('name');
      expect(idea).toHaveProperty('description');
      expect(idea).toHaveProperty('suggestedTemplate');
      expect(idea).toHaveProperty('templateId');
      expect(idea).toHaveProperty('category');
      expect(idea).toHaveProperty('aiFeatures');
      expect(idea).toHaveProperty('estimatedDevelopmentTime');
      expect(idea).toHaveProperty('businessValue');
      expect(idea).toHaveProperty('complexity');
      expect(idea.aiFeatures).toBeInstanceOf(Array);
    });

    it('should filter ideas by category', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?category=Insurance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const ideas = response.body.data.ideas;
      expect(ideas.length).toBeGreaterThan(0);
      
      // All ideas should be Insurance category
      ideas.forEach(idea => {
        expect(idea.category).toBe('Insurance');
      });
    });

    it('should filter ideas by complexity', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?complexity=Low')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const ideas = response.body.data.ideas;
      
      // All ideas should be Low complexity
      ideas.forEach(idea => {
        expect(idea.complexity).toBe('Low');
      });
    });

    it('should limit number of ideas returned', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ideas.length).toBeLessThanOrEqual(2);
    });

    it('should filter by multiple parameters', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?category=CRM&complexity=High&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const ideas = response.body.data.ideas;
      expect(ideas.length).toBeLessThanOrEqual(1);
      
      if (ideas.length > 0) {
        expect(ideas[0].category).toBe('CRM');
        expect(ideas[0].complexity).toBe('High');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid category gracefully', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?category=InvalidCategory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ideas).toBeInstanceOf(Array);
      // Should return empty array for invalid category
      expect(response.body.data.ideas.length).toBe(0);
    });

    it('should handle invalid complexity gracefully', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?complexity=InvalidComplexity')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ideas).toBeInstanceOf(Array);
      // Should return empty array for invalid complexity
      expect(response.body.data.ideas.length).toBe(0);
    });

    it('should respect maximum limit', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?limit=100')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should not exceed maximum limit of 10
      expect(response.body.data.ideas.length).toBeLessThanOrEqual(10);
    });
  });

  describe('AI Ideas Content Validation', () => {
    it('should include Insurance-specific AI ideas', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?category=Insurance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ideas = response.body.data.ideas;
      
      if (ideas.length > 0) {
        const insuranceIdea = ideas[0];
        expect(insuranceIdea.suggestedTemplate).toBe('Insurance Form App');
        expect(insuranceIdea.templateId).toBe(4);
        expect(insuranceIdea.aiFeatures).toContain('Risk assessment algorithms');
      }
    });

    it('should include CRM-specific AI ideas', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas?category=CRM')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ideas = response.body.data.ideas;
      
      if (ideas.length > 0) {
        const crmIdea = ideas[0];
        expect(crmIdea.suggestedTemplate).toBe('CRM Template');
        expect(crmIdea.templateId).toBe(5);
        expect(crmIdea.aiFeatures).toContain('Predictive analytics');
      }
    });

    it('should provide business value assessments', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ideas = response.body.data.ideas;
      
      ideas.forEach(idea => {
        expect(idea.businessValue).toMatch(/^(Low|Medium|High|Very High)/);
        expect(idea.estimatedDevelopmentTime).toMatch(/\d+-\d+ weeks?/);
        expect(['Low', 'Medium', 'High']).toContain(idea.complexity);
      });
    });

    it('should map ideas to correct template IDs', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ideas = response.body.data.ideas;
      
      // Verify template ID mappings
      const templateMappings = {
        'Basic Form App': 1,
        'Dashboard Template': 2,
        'E-commerce Starter': 3,
        'Insurance Form App': 4,
        'CRM Template': 5
      };
      
      ideas.forEach(idea => {
        expect(idea.templateId).toBe(templateMappings[idea.suggestedTemplate]);
      });
    });
  });

  describe('AI Response Structure', () => {
    it('should include all required response fields', async () => {
      const response = await request(app)
        .get('/api/floneo-ai/ideas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('ideas');
      expect(response.body.data).toHaveProperty('totalIdeas');
      expect(response.body.data).toHaveProperty('availableCategories');
      expect(response.body.data).toHaveProperty('availableComplexities');
      expect(response.body.data).toHaveProperty('generatedAt');
      expect(response.body.data).toHaveProperty('aiEngine');
      expect(response.body.data).toHaveProperty('filters');
      
      expect(response.body.data.availableCategories).toEqual([
        'Insurance', 'CRM', 'Forms', 'E-commerce', 'Dashboards'
      ]);
      expect(response.body.data.availableComplexities).toEqual([
        'Low', 'Medium', 'High'
      ]);
    });
  });
});
