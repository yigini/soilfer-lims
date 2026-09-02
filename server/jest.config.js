module.exports = {
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/globalSetup.js',
    globalTeardown: '<rootDir>/tests/globalTeardown.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testTimeout: 20000,
    maxWorkers: 1,
    verbose: true
};
