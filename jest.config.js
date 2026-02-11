module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    // Détecte les handles ouverts pour debugger les leaks
    // detectOpenHandles: true,
    // Force l'exit après les tests pour éviter les problèmes de worker threads
    forceExit: true,
    // Timeout global pour les tests
    testTimeout: 10000
};
