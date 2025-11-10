module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'index.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true
};
