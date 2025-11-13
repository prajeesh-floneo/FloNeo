const request = require('supertest');
const app = require('../index');
const prisma = require('@prisma/client').PrismaClient ? new (require('@prisma/client').PrismaClient)() : null;

describe('Algorithm Webhook', () => {
  it('rejects when secret is missing', async () => {
    const res = await request(app).post('/api/workflow/webhook/algorithm').send({});
    expect(res.statusCode).toBe(403);
  });
});
