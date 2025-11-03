const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Mock the server setup
const express = require('express');
const authRoutes = require('../routes/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

const prisma = new PrismaClient();

describe('Authentication Endpoints', () => {
  // Helper function to clean up test data in correct order
  const cleanupTestData = async () => {
    await prisma.$transaction(async (tx) => {
      // Delete in order to respect foreign key constraints
      await tx.projectInvite.deleteMany({
        where: { email: { contains: 'test' } }
      });

      await tx.projectMember.deleteMany({
        where: { user: { email: { contains: 'test' } } }
      });

      await tx.project.deleteMany({
        where: { owner: { email: { contains: 'test' } } }
      });

      await tx.refreshToken.deleteMany({
        where: { user: { email: { contains: 'test' } } }
      });

      await tx.otp.deleteMany({
        where: { email: { contains: 'test' } }
      });

      await tx.user.deleteMany({
        where: { email: { contains: 'test' } }
      });
    });
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test for isolation
    await cleanupTestData();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'user'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verify your email');
      expect(response.body.data.email).toBe(userData.email);

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email }
      });
      expect(user).toBeTruthy();
      expect(user.verified).toBe(false);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'user'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'weak',
        role: 'user'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });

    it('should reject invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPass123!',
        role: 'user'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });
  });

  describe('POST /auth/verify-otp', () => {
    let testEmail = 'otp-test@example.com';
    let testOtp;

    beforeAll(async () => {
      // Create a user and OTP for testing
      const userData = {
        email: testEmail,
        password: 'TestPass123!',
        role: 'user'
      };

      await request(app)
        .post('/auth/signup')
        .send(userData);

      // Get the OTP from database
      const otpRecord = await prisma.otp.findFirst({
        where: { email: testEmail, used: false },
        orderBy: { createdAt: 'desc' }
      });
      testOtp = otpRecord.otp;
    });

    it('should verify OTP successfully', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: testEmail,
          otp: testOtp
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.data.refreshToken).toBeTruthy();

      // Verify user is now verified
      const user = await prisma.user.findUnique({
        where: { email: testEmail }
      });
      expect(user.verified).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: testEmail,
          otp: '000000'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired');
    });

    it('should reject used OTP', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: testEmail,
          otp: testOtp
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired');
    });
  });

  describe('POST /auth/login', () => {
    let verifiedEmail = 'login-test@example.com';
    let password = 'TestPass123!';

    beforeAll(async () => {
      // Create and verify a user for login testing
      await request(app)
        .post('/auth/signup')
        .send({
          email: verifiedEmail,
          password,
          role: 'user'
        });

      // Get OTP and verify
      const otpRecord = await prisma.otp.findFirst({
        where: { email: verifiedEmail, used: false },
        orderBy: { createdAt: 'desc' }
      });

      await request(app)
        .post('/auth/verify-otp')
        .send({
          email: verifiedEmail,
          otp: otpRecord.otp
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: verifiedEmail,
          password,
          rememberMe: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successful');
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.data.refreshToken).toBeTruthy();
      expect(response.body.data.user.email).toBe(verifiedEmail);
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: verifiedEmail,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject unverified user', async () => {
      // Create unverified user
      await request(app)
        .post('/auth/signup')
        .send({
          email: 'unverified@example.com',
          password,
          role: 'user'
        });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'unverified@example.com',
          password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('verify your email');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset OTP for existing user', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'login-test@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset OTP');

      // Verify OTP was created
      const otpRecord = await prisma.otp.findFirst({
        where: { 
          email: 'login-test@example.com',
          type: 'forgot-password',
          used: false
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(otpRecord).toBeTruthy();
    });

    it('should not reveal if email does not exist', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset OTP');
    });
  });
});
