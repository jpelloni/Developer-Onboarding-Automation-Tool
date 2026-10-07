/** @type {import('jest').Config} */
export default {
    roots: ['<rootDir>/tests'],
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};
