module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
  // Use a dedicated tsconfig for tests so that @types/jest is available
  // without polluting the production tsconfig with jest globals.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/examples/**',
    '!src/bin/**',
    '!src/adapters/**',
    // Worker thread script — runs as a separate process; cannot be unit-tested directly
    '!src/utils/isolated-worker.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // Detect open handles to surface resource leaks (worker threads, timers, etc.)
  detectOpenHandles: true,
  testTimeout: 10000,
};
