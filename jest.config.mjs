/** @type {import('jest').Config} */
const coverageThreshold = Number(process.env.COVERAGE_THRESHOLD ?? 80);

if (!Number.isFinite(coverageThreshold) || coverageThreshold < 0 || coverageThreshold > 100) {
    throw new Error('COVERAGE_THRESHOLD must be a number between 0 and 100.');
}

export default {
    roots: ['<rootDir>/tests'],
    testMatch: ['**/?(*.)+(spec|test).[jt]s'],
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
        }],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    collectCoverageFrom: ['src/**/*.ts'],
    coverageThreshold: {
        global: {
            branches: coverageThreshold,
            functions: coverageThreshold,
            lines: coverageThreshold,
            statements: coverageThreshold,
        },
    },
};
