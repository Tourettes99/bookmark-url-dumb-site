module.exports = {
    testEnvironment: 'node',
    testTimeout: 35000,
    setupFilesAfterEnv: ['./tests/setup.js'],
    globalSetup: './tests/global-setup.js'
}; 