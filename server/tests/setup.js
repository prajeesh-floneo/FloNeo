// Jest setup file for global test configuration
require('dotenv').config();
const nock = require('nock');

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console.log to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console.log during tests unless explicitly needed
  console.log = jest.fn();
  
  // Keep console.error for debugging
  console.error = originalConsoleError;
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Timer and cleanup management
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  // Clean up all timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Clean up nock interceptors
  nock.cleanAll();
});

// Global test utilities
global.testUtils = {
  // Helper to generate test email
  generateTestEmail: (prefix = 'test') => {
    const timestamp = Date.now();
    return `${prefix}${timestamp}@example.com`;
  },
  
  // Helper to generate strong password
  generateTestPassword: () => 'TestPass123!',
  
  // Helper to wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
