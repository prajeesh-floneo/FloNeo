const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

describe('Media API', () => {
  let authToken;
  let testUser;
  let testApp;
  let uploadedFileIds = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'media-test@example.com',
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
        name: 'Media Test App',
        description: 'Test app for media functionality',
        ownerId: testUser.id,
        status: 'Draft'
      }
    });

    // Create test image file
    const testImagePath = path.join(__dirname, 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      // Create a simple 1x1 PNG for testing
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x21, 0x18, 0xE6, 0x27, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngBuffer);
    }
  });

  afterAll(async () => {
    // Clean up uploaded files
    for (const fileId of uploadedFileIds) {
      try {
        const mediaFile = await prisma.mediaFile.findUnique({
          where: { id: fileId }
        });
        if (mediaFile) {
          const filePath = path.join(__dirname, '../uploads', mediaFile.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          // Clean up thumbnail if exists
          if (mediaFile.thumbnail) {
            const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', path.basename(mediaFile.thumbnail));
            if (fs.existsSync(thumbnailPath)) {
              fs.unlinkSync(thumbnailPath);
            }
          }
        }
      } catch (error) {
        console.log('Error cleaning up file:', error.message);
      }
    }

    // Clean up test data
    await prisma.mediaFile.deleteMany({ where: { userId: testUser.id } });
    await prisma.app.delete({ where: { id: testApp.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    // Clean up test image
    const testImagePath = path.join(__dirname, 'test-image.png');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    await prisma.$disconnect();
  });

  describe('POST /api/media/upload', () => {
    it('should upload image file successfully', async () => {
      const testImagePath = path.join(__dirname, 'test-image.png');
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('appId', testApp.id.toString())
        .attach('files', testImagePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('filename');
      expect(response.body.data[0]).toHaveProperty('originalName', 'test-image.png');
      expect(response.body.data[0]).toHaveProperty('mimeType', 'image/png');
      expect(response.body.data[0]).toHaveProperty('url');
      expect(response.body.data[0].userId).toBe(testUser.id);
      expect(response.body.data[0].appId).toBe(testApp.id);

      uploadedFileIds.push(response.body.data[0].id);
    });

    it('should upload multiple files', async () => {
      const testImagePath = path.join(__dirname, 'test-image.png');
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('appId', testApp.id.toString())
        .attach('files', testImagePath)
        .attach('files', testImagePath) // Upload same file twice
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      
      uploadedFileIds.push(...response.body.data.map(file => file.id));
    });

    it('should return 400 when no files uploaded', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('appId', testApp.id.toString())
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No files uploaded');
    });

    it('should return 401 without auth token', async () => {
      const testImagePath = path.join(__dirname, 'test-image.png');
      
      await request(app)
        .post('/api/media/upload')
        .attach('files', testImagePath)
        .expect(401);
    });

    it('should return 404 for non-existent app', async () => {
      const testImagePath = path.join(__dirname, 'test-image.png');
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('appId', '99999')
        .attach('files', testImagePath)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('App not found');
    });
  });

  describe('GET /api/media', () => {
    let testMediaFile;

    beforeEach(async () => {
      // Create test media file record
      testMediaFile = await prisma.mediaFile.create({
        data: {
          filename: 'test-media.jpg',
          originalName: 'test-media.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: '/api/media/files/test-media.jpg',
          userId: testUser.id,
          appId: testApp.id
        }
      });
    });

    afterEach(async () => {
      if (testMediaFile) {
        await prisma.mediaFile.delete({ where: { id: testMediaFile.id } });
      }
    });

    it('should get user media files', async () => {
      const response = await request(app)
        .get('/api/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('files');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.files)).toBe(true);
      expect(response.body.data.files.length).toBeGreaterThan(0);
    });

    it('should filter media files by app', async () => {
      const response = await request(app)
        .get(`/api/media?appId=${testApp.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.files.every(file => file.appId === testApp.id)).toBe(true);
    });

    it('should filter media files by type', async () => {
      const response = await request(app)
        .get('/api/media?type=image')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.files.every(file => file.mimeType.startsWith('image/'))).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/media?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.files.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/media')
        .expect(401);
    });
  });

  describe('DELETE /api/media/:id', () => {
    let testMediaFile;

    beforeEach(async () => {
      testMediaFile = await prisma.mediaFile.create({
        data: {
          filename: 'delete-test.jpg',
          originalName: 'delete-test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: '/api/media/files/delete-test.jpg',
          userId: testUser.id,
          appId: testApp.id
        }
      });
    });

    it('should delete media file', async () => {
      const response = await request(app)
        .delete(`/api/media/${testMediaFile.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify file is deleted from database
      const deletedFile = await prisma.mediaFile.findUnique({
        where: { id: testMediaFile.id }
      });
      expect(deletedFile).toBeNull();
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .delete('/api/media/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('File not found');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .delete(`/api/media/${testMediaFile.id}`)
        .expect(401);
    });
  });

  describe('GET /api/media/files/:filename', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/media/files/non-existent-file.jpg')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('File not found');
    });
  });

  describe('Element Validation', () => {
    const { validateElement, getElementDefinition } = require('../utils/elementValidation');

    it('should validate TEXT_FIELD element', () => {
      const element = {
        type: 'TEXT_FIELD',
        properties: {
          placeholder: 'Enter text',
          maxlength: 100,
          required: true
        },
        x: 10,
        y: 20,
        width: 200,
        height: 30
      };

      const errors = validateElement(element);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid element', () => {
      const element = {
        type: 'TEXT_FIELD',
        properties: {
          maxlength: -1 // Invalid
        },
        x: 'invalid', // Should be number
        width: 0 // Should be > 0
      };

      const errors = validateElement(element);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should get element definition', () => {
      const definition = getElementDefinition('BUTTON');
      expect(definition).toBeDefined();
      expect(definition.requiredProperties).toContain('text');
    });

    it('should return null for unknown element type', () => {
      const definition = getElementDefinition('UNKNOWN_TYPE');
      expect(definition).toBeNull();
    });
  });
});
