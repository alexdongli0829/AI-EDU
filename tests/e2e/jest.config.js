module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!jest.config.js',
  ],
  testTimeout: 60000, // 60 seconds for agent responses
  setupFiles: ['<rootDir>/jest.setup.js']
};