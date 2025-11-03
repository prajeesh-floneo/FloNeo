const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

describe('AI Summarize Block', () => {
  let userToken;
  let testUser;
  let testApp;
  let testFile;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'aisummarize@example.com',
        password: '$2b$12$LQv3c1yqBwEHFl5L5KcYCOqkUYvDADpVWKpbOxhG9yxdoABhdxm2G',
        role: 'developer',
        verified: true
      }
    });

    // Generate auth token
    userToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test app
    testApp = await prisma.app.create({
      data: {
        name: 'AI Summarize Test App',
        userId: testUser.id,
        status: 'DRAFT'
      }
    });

    // Create test file in uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const testFilePath = path.join(uploadsDir, 'test-document.txt');
    const testContent = `
      This is a test document for AI summarization.
      It contains multiple paragraphs of text that should be summarized.
      The document discusses various topics including technology, innovation, and digital transformation.
      Machine learning and artificial intelligence are transforming industries worldwide.
      Companies are adopting AI to improve efficiency and customer experience.
      The future of technology is bright with endless possibilities.
      Cloud computing enables scalable and flexible solutions for businesses.
      Data analytics provides valuable insights for decision making.
      Cybersecurity is crucial in protecting digital assets and information.
      The digital revolution continues to reshape how we work and live.
    `;
    fs.writeFileSync(testFilePath, testContent);

    // Create media file record
    testFile = await prisma.mediaFile.create({
      data: {
        filename: 'test-document.txt',
        originalName: 'test-document.txt',
        mimeType: 'text/plain',
        size: testContent.length,
        path: testFilePath,
        url: '/uploads/test-document.txt',
        userId: testUser.id,
        appId: testApp.id
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.mediaFile.deleteMany({
      where: { userId: testUser.id }
    });

    await prisma.app.deleteMany({
      where: { userId: testUser.id }
    });

    await prisma.user.deleteMany({
      where: { email: 'aisummarize@example.com' }
    });

    // Clean up test files
    const uploadsDir = path.join(__dirname, '../uploads');
    const testFilePath = path.join(uploadsDir, 'test-document.txt');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    await prisma.$disconnect();
  });

  describe('Configuration Validation', () => {
    test('should fail without file variable', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: '1',
              data: {
                label: 'ai.summarize',
                category: 'AI Blocks',
                apiKey: 'test-key',
                outputVariable: 'summary'
              }
            }
          ],
          edges: [],
          context: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].result.success).toBe(false);
      expect(response.body.results[0].result.error).toContain('File variable');
    });

    test('should fail without API key', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: '1',
              data: {
                label: 'ai.summarize',
                category: 'AI Blocks',
                fileVariable: 'uploadedFile',
                outputVariable: 'summary'
              }
            }
          ],
          edges: [],
          context: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].result.success).toBe(false);
      expect(response.body.results[0].result.error).toContain('API key');
    });

    test('should fail with missing file in context', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: '1',
              data: {
                label: 'ai.summarize',
                category: 'AI Blocks',
                fileVariable: 'uploadedFile',
                apiKey: 'test-key',
                outputVariable: 'summary'
              }
            }
          ],
          edges: [],
          context: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].result.success).toBe(false);
      expect(response.body.results[0].result.error).toContain('not found in context');
    });
  });

  describe('Response Format', () => {
    test('should return correct response structure on success', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: '1',
              data: {
                label: 'ai.summarize',
                category: 'AI Blocks',
                fileVariable: 'uploadedFile',
                apiKey: process.env.GEMINI_API_KEY || 'test-key',
                outputVariable: 'aiSummary'
              }
            }
          ],
          edges: [],
          context: {
            uploadedFile: testFile
          }
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      
      // Check response structure
      expect(result).toHaveProperty('type', 'aiSummary');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('summary');
      
      if (result.success) {
        expect(result.summary).toHaveProperty('text');
        expect(result.summary).toHaveProperty('originalLength');
        expect(result.summary).toHaveProperty('summaryLength');
        expect(result.summary).toHaveProperty('compressionRatio');
        expect(result.summary).toHaveProperty('fileName');
      }
    });
  });
});

