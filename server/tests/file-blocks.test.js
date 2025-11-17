const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

describe('Workflow File Blocks', () => {
  let authToken;
  let testUser;
  let testApp;
  let mediaFile;
  let uploadsDir;
  let mediaFilePath;

  beforeAll(async () => {
    uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    testUser = await prisma.user.create({
      data: {
        email: 'fileblocks@example.com',
        password: '$2b$12$LQv3c1yqBwEHFl5L5KcYCOqkUYvDADpVWKpbOxhG9yxdoABhdxm2G',
        role: 'developer',
        verified: true,
      },
    });

    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    testApp = await prisma.app.create({
      data: {
        name: 'File Blocks Test App',
        userId: testUser.id,
        status: 'DRAFT',
      },
    });

    mediaFilePath = path.join(uploadsDir, 'file-block-download.txt');
    fs.writeFileSync(mediaFilePath, 'Download me!');

    mediaFile = await prisma.mediaFile.create({
      data: {
        filename: 'file-block-download.txt',
        originalName: 'file-block-download.txt',
        mimeType: 'text/plain',
        size: 12,
        path: mediaFilePath,
        url: '/uploads/file-block-download.txt',
        userId: testUser.id,
        appId: testApp.id,
      },
    });
  });

  afterAll(async () => {
    if (mediaFile) {
      await prisma.mediaFile.delete({ where: { id: mediaFile.id } });
    }

    if (testApp) {
      await prisma.app.delete({ where: { id: testApp.id } });
    }

    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }

    if (mediaFilePath && fs.existsSync(mediaFilePath)) {
      fs.unlinkSync(mediaFilePath);
    }

    await prisma.$disconnect();
  });

  describe('file.upload', () => {
    const uploadedFilesContext = {
      fileInput: {
        id: 999,
        filename: 'form-upload.png',
        originalName: 'form-upload.png',
        mimeType: 'image/png',
        size: 1024,
        url: '/api/media/files/form-upload.png',
        path: path.join(__dirname, '../uploads/form-upload.png'),
      },
    };

    test('resolves uploaded file from context', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.upload',
                category: 'Actions',
                fileUploadElementId: 'fileInput',
                fileUploadOutputVariable: 'uploadResult',
              },
            },
          ],
          edges: [],
          context: {
            uploadedFiles: uploadedFilesContext,
          },
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(true);
      expect(result.file).toMatchObject({
        filename: 'form-upload.png',
        mimeType: 'image/png',
      });
      expect(response.body.context.uploadResult.filename).toBe('form-upload.png');
      expect(response.body.context.lastUploadedFile.filename).toBe('form-upload.png');
    });

    test('rejects file when mime type not allowed', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.upload',
                category: 'Actions',
                fileUploadElementId: 'fileInput',
                allowedFileTypes: 'application/pdf',
              },
            },
          ],
          edges: [],
          context: {
            uploadedFiles: uploadedFilesContext,
          },
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    test('rejects file above configured size', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.upload',
                category: 'Actions',
                fileUploadElementId: 'fileInput',
                fileUploadMaxSizeMB: 0.0005,
              },
            },
          ],
          edges: [],
          context: {
            uploadedFiles: uploadedFilesContext,
          },
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds configured limit');
    });

    test('fails when no file found', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.upload',
                category: 'Actions',
                fileUploadElementId: 'missingInput',
              },
            },
          ],
          edges: [],
          context: {
            uploadedFiles: uploadedFilesContext,
          },
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(false);
      expect(result.error).toContain('No file found');
    });
  });

  describe('file.download', () => {
    test('returns download payload for direct URL', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.download',
                category: 'Actions',
                downloadSourceType: 'url',
                downloadUrl: 'https://example.com/report.pdf',
                downloadFileName: 'report.pdf',
                downloadMimeType: 'application/pdf',
              },
            },
          ],
          edges: [],
          context: {},
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(true);
      expect(result.download).toMatchObject({
        url: 'https://example.com/report.pdf',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      });
    });

    test('returns payload for context source', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.download',
                category: 'Actions',
                downloadSourceType: 'context',
                downloadContextKey: 'existingFile',
              },
            },
          ],
          edges: [],
          context: {
            existingFile: {
              url: '/api/media/files/context-file.png',
              filename: 'context-file.png',
              originalName: 'context-file.png',
              mimeType: 'image/png',
            },
          },
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(true);
      expect(result.download.url).toBe('/api/media/files/context-file.png');
      expect(result.download.fileName).toBe('context-file.png');
      expect(response.body.context.lastDownload.fileName).toBe('context-file.png');
    });

    test('returns payload for server path sources', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.download',
                category: 'Actions',
                downloadSourceType: 'path',
                downloadPath: mediaFile.path,
              },
            },
          ],
          edges: [],
          context: {},
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(true);
      expect(result.download.url).toBe(`/api/media/files/${mediaFile.filename}`);
      expect(result.download.fileName).toBe('file-block-download.txt');
      expect(response.body.context.lastDownload.url).toBe(
        `/api/media/files/${mediaFile.filename}`
      );
    });

    test('fails when context key missing', async () => {
      const response = await request(app)
        .post('/api/workflow/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appId: testApp.id,
          nodes: [
            {
              id: 'node-1',
              data: {
                label: 'file.download',
                category: 'Actions',
                downloadSourceType: 'context',
                downloadContextKey: 'missing',
              },
            },
          ],
          edges: [],
          context: {},
        });

      expect(response.status).toBe(200);
      const result = response.body.results[0].result;
      expect(result.success).toBe(false);
      expect(result.error).toContain('No file found');
    });
  });
});
