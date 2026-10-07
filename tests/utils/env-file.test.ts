import { EnvFile, parseEnvKeys } from '../../src/utils/env-file.js';

describe('parseEnvKeys', () => {
    it('returns the keys of KEY=value lines in order', () => {
        const result = parseEnvKeys('DATABASE_URL=postgres://localhost\nPORT=3000\n');

        expect(result).toEqual(['DATABASE_URL', 'PORT']);
    });

    it('returns an empty list for empty content', () => {
        const result = parseEnvKeys('');

        expect(result).toEqual([]);
    });

    it('skips blank lines and comments', () => {
        const result = parseEnvKeys('# Database\n\n   \n  # PORT=3000\nHOST=localhost\n');

        expect(result).toEqual(['HOST']);
    });

    it('accepts keys with empty values', () => {
        const result = parseEnvKeys('API_KEY=\n');

        expect(result).toEqual(['API_KEY']);
    });

    it('ignores whitespace around the key and the equals sign', () => {
        const result = parseEnvKeys('  PORT  =  3000  \n');

        expect(result).toEqual(['PORT']);
    });

    it('strips an export prefix', () => {
        const result = parseEnvKeys('export NODE_ENV=development\nexport  DEBUG=true\n');

        expect(result).toEqual(['NODE_ENV', 'DEBUG']);
    });

    it('handles CRLF line endings', () => {
        const result = parseEnvKeys('HOST=localhost\r\nPORT=3000\r\n');

        expect(result).toEqual(['HOST', 'PORT']);
    });

    it('lists a key defined more than once only once, at its first position', () => {
        const result = parseEnvKeys('PORT=3000\nHOST=localhost\nPORT=4000\n');

        expect(result).toEqual(['PORT', 'HOST']);
    });

    it('ignores the contents of values, including equals signs and quotes', () => {
        const result = parseEnvKeys('URL="https://example.com/?a=1&b=2"\nSECRET=\'x=y\'\n');

        expect(result).toEqual(['URL', 'SECRET']);
    });

    it('skips lines without an equals sign', () => {
        const result = parseEnvKeys('JUST_A_WORD\nPORT=3000\n');

        expect(result).toEqual(['PORT']);
    });

    it('skips lines whose key is not a valid variable name', () => {
        const result = parseEnvKeys('1PORT=3000\nMY-KEY=x\n=value\nmy key=x\n_VALID_1=ok\n');

        expect(result).toEqual(['_VALID_1']);
    });
});

describe('EnvFile', () => {
    it('exposes parseEnvKeys', () => {
        expect(EnvFile.parseEnvKeys).toBe(parseEnvKeys);
    });
});
