// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
    tseslint.configs.recommended,
    {
        rules: {
            'no-console': 'error',
        },
    },
    {
        // Logger is the sole permitted gateway to stdout/stderr
        files: ['src/utils/logger.util.ts'],
        rules: {
            'no-console': 'off',
        },
    },
);
