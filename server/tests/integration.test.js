const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Integration Tests', () => {
  let userToken;
  let adminToken;
  let testUser;
  let adminUser;
  let testProject;
  let testSchema;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.notification.deleteMany({
      where: {
        user: {
          email: {
            in: ['integration@example.com', 'integrationadmin@example.com']
          }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['integration@example.com', 'integrationadmin@example.com']
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testProject) {
      await prisma.appData.deleteMany({
        where: { schema: { projectId: testProject.id } }
      });
      await prisma.appField.deleteMany({
        where: { schema: { projectId: testProject.id } }
      });
      await prisma.appSchema.deleteMany({
        where: { projectId: testProject.id }
      });
      await prisma.appMetric.deleteMany({
        where: { projectId: testProject.id }
      });
      await prisma.appIssue.deleteMany({
        where: { projectId: testProject.id }
      });
      await prisma.appWarning.deleteMany({
        where: { projectId: testProject.id }
      });
      await prisma.project.delete({
        where: { id: testProject.id }
      });
    }

    if (testUser) {
      await prisma.notification.deleteMany({
        where: { userId: testUser.id }
      });
      await prisma.user.delete({
        where: { id: testUser.id }
      });
    }

    if (adminUser) {
      await prisma.user.delete({
        where: { id: adminUser.id }
      });
    }

    await prisma.$disconnect();
  });

  describe('Complete Integration Flow', () => {
    it('should complete full signup → project → schema → data → metrics → notification flow', async () => {
      // Step 1: User Signup
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send({
          email: 'integration@example.com',
          password: 'StrongPass123!',
          role: 'developer'
        })
        .expect(201);

      expect(signupResponse.body.success).toBe(true);
      expect(signupResponse.body.data).toHaveProperty('otp');

      // Step 2: Verify OTP
      const verifyResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: 'integration@example.com',
          otp: signupResponse.body.data.otp
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data).toHaveProperty('accessToken');
      userToken = verifyResponse.body.data.accessToken;

      // Get user data for later use
      testUser = await prisma.user.findUnique({
        where: { email: 'integration@example.com' }
      });

      // Step 3: Create Project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Integration Test Project',
          description: 'Testing complete integration flow',
          status: 'DRAFT'
        })
        .expect(201);

      expect(projectResponse.body.success).toBe(true);
      testProject = projectResponse.body.data.project;

      // Step 4: Create Schema
      const schemaResponse = await request(app)
        .post(`/api/projects/${testProject.id}/schemas`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Customer'
        })
        .expect(201);

      expect(schemaResponse.body.success).toBe(true);
      testSchema = schemaResponse.body.data;

      // Step 5: Store Data
      const dataResponse = await request(app)
        .post(`/api/schemas/${testSchema.id}/data`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          data: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          }
        })
        .expect(201);

      expect(dataResponse.body.success).toBe(true);

      // Step 6: Create Metrics
      const metric = await prisma.appMetric.create({
        data: {
          projectId: testProject.id,
          activeDays: 10,
          downtime: 1.5,
          totalUsers: 150,
          traffic: 2000
        }
      });

      // Step 7: Get Project Metrics
      const metricsResponse = await request(app)
        .get(`/api/projects/${testProject.id}/metrics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data.activeDays).toBe(10);

      // Step 8: Create Admin User for Notifications
      const adminSignupResponse = await request(app)
        .post('/auth/signup')
        .send({
          email: 'integrationadmin@example.com',
          password: 'AdminPass123!',
          role: 'admin'
        })
        .expect(201);

      const adminVerifyResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: 'integrationadmin@example.com',
          otp: adminSignupResponse.body.data.otp
        })
        .expect(200);

      adminToken = adminVerifyResponse.body.data.accessToken;
      adminUser = await prisma.user.findUnique({
        where: { email: 'integrationadmin@example.com' }
      });

      // Update admin role
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'admin' }
      });

      // Step 9: Skip notification sending (admin functionality removed)
      console.log('⏭️  Skipping notification sending - admin functionality removed');

      // Step 10: Read Notifications
      const readResponse = await request(app)
        .get('/api/notifications/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(readResponse.body.success).toBe(true);
      expect(readResponse.body.data.length).toBeGreaterThanOrEqual(1);

      // Step 11: Get Stats
      const statsResponse = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.totalProjects).toBeGreaterThanOrEqual(1);

      console.log('✅ Integration test passed: Complete flow executed successfully');
    });

    it('should handle error cases gracefully', async () => {
      // Test unauthorized access
      await request(app)
        .get('/api/stats')
        .expect(401);

      // Test invalid project access
      await request(app)
        .get('/api/projects/99999/metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      // Admin notification endpoint removed - skip this test
      console.log('⏭️  Skipping invalid notification test - admin endpoint removed');
    });
  });
});
