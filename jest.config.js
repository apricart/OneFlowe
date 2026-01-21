/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

    // Module path mapping (match tsconfig.json)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },

    // Coverage configuration
    collectCoverageFrom: [
        'app/api/**/*.ts',
        'lib/**/*.ts',
        'db/**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/.next/**',
        '!**/tests/**',
    ],

    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },

    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

    // Test timeout (increased for integration tests)
    testTimeout: 10000,

    // Global setup/teardown
    globalSetup: '<rootDir>/tests/setup/global-setup.ts',
    globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',

    // Setup files after environment
    setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

    // Transform configuration
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                jsx: 'react',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
            },
        }],
    },

    // Ignore patterns
    testPathIgnorePatterns: ['/node_modules/', '/.next/'],

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
