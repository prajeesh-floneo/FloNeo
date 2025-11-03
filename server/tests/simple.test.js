const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Mock the server setup
const express = require('express');
const authRoutes = require('../routes/auth');
// const projectRoutes = require('../routes/projects'); // REMOVED: projects route doesn't exist

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
// app.use('/api/projects', projectRoutes); // REMOVED: projects route doesn't exist

const prisma = new PrismaClient();

describe('Simple Integration Tests', () => {
  let testUser;
  let authToken;

  // Helper function to clean up test data in correct order
  const cleanupTestData = async () => {
    await prisma.$transaction(async (tx) => {
      // Clean up only tables that exist in the current schema
      await tx.otp.deleteMany({
        where: { email: { contains: 'simpletest' } }
      });

      await tx.user.deleteMany({
        where: { email: { contains: 'simpletest' } }
      });
    });
  };

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should complete full auth flow', async () => {
    // 1. Signup
    const signupResponse = await request(app)
      .post('/auth/signup')
      .send({
        email: 'simpletest@example.com',
        password: 'TestPass123!',
        role: 'user'
      })
      .expect(201);

    expect(signupResponse.body.success).toBe(true);
    expect(signupResponse.body.data.email).toBe('simpletest@example.com');

    // 2. Get OTP and verify
    const otpRecord = await prisma.otp.findFirst({
      where: { email: 'simpletest@example.com', used: false },
      orderBy: { createdAt: 'desc' }
    });

    expect(otpRecord).toBeTruthy();

    const verifyResponse = await request(app)
      .post('/auth/verify-otp')
      .send({
        email: 'simpletest@example.com',
        otp: otpRecord.otp
      })
      .expect(200);

    expect(verifyResponse.body.success).toBe(true);
    testUser = verifyResponse.body.data.user;
    authToken = verifyResponse.body.data.accessToken;

    // 3. Login (should work after verification)
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'simpletest@example.com',
        password: 'TestPass123!',
        rememberMe: false
      })
      .expect(200);

    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.user.email).toBe('simpletest@example.com');
  });
});
