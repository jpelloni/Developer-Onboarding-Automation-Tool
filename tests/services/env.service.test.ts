import { ENV_EXAMPLE_FILE, ENV_FILE } from '../../src/config/constants.js';
import { FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const exists = jest.fn<Promise<boolean>, [string]>();
const copyFileIfAbsent = jest.fn<Promise<boolean>, [string, string]>();
const readTextFile = jest.fn<Promise<string>, [string]>();

jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { exists, copyFileIfAbsent, readTextFile },
}));

const { EnvService: { generateEnvFile, compareEnvFiles } } = await import('../../src/services/env.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

beforeEach(() => {
    exists.mockReset().mockResolvedValue(true);
    copyFileIfAbsent.mockReset().mockResolvedValue(true);
    readTextFile.mockReset();
});

// Serves `example` as .env.example and `env` as .env.
const mockFiles = (example: string, env: string) => {
    readTextFile.mockImplementation(async (path) => (path === ENV_EXAMPLE_FILE ? example : env));
};

describe('generateEnvFile', () => {
    it('copies .env.example to .env and returns "created"', async () => {
        const logger = createLogger();

        const result = await generateEnvFile(logger as unknown as Logger);

        expect(result).toBe('created');
        expect(exists).toHaveBeenCalledWith(ENV_EXAMPLE_FILE);
        expect(copyFileIfAbsent).toHaveBeenCalledWith(ENV_EXAMPLE_FILE, ENV_FILE);
        expect(logger.log).toHaveBeenCalledWith('Created .env from .env.example.');
    });

    it('leaves an existing .env unchanged and returns "exists"', async () => {
        const logger = createLogger();
        copyFileIfAbsent.mockResolvedValue(false);

        const result = await generateEnvFile(logger as unknown as Logger);

        expect(result).toBe('exists');
        expect(logger.info).toHaveBeenCalledWith('.env already exists; leaving it unchanged.');
        expect(logger.log).not.toHaveBeenCalled();
    });

    it('skips generation and returns "no-template" when there is no .env.example', async () => {
        const logger = createLogger();
        exists.mockResolvedValue(false);

        const result = await generateEnvFile(logger as unknown as Logger);

        expect(result).toBe('no-template');
        expect(copyFileIfAbsent).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('No .env.example found; skipping .env generation.');
    });

    it('propagates FileSystemErrors from the adapter', async () => {
        const error = new FileSystemError('Failed to copy ".env.example" to ".env".');
        copyFileIfAbsent.mockRejectedValue(error);

        await expect(generateEnvFile(createLogger() as unknown as Logger)).rejects.toBe(error);
    });
});

describe('compareEnvFiles', () => {
    it('reads .env.example and .env', async () => {
        mockFiles('PORT=3000\n', 'PORT=4000\n');

        await compareEnvFiles(createLogger() as unknown as Logger);

        expect(readTextFile).toHaveBeenCalledWith(ENV_EXAMPLE_FILE);
        expect(readTextFile).toHaveBeenCalledWith(ENV_FILE);
    });

    it('returns no differences and logs that the files are in sync', async () => {
        const logger = createLogger();
        mockFiles('# Server\nHOST=\nPORT=3000\n', 'PORT=4000\nHOST=localhost\n');

        const result = await compareEnvFiles(logger as unknown as Logger);

        expect(result).toEqual({ missing: [], unused: [] });
        expect(logger.log).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith('.env is in sync with .env.example.');
    });

    it('returns and logs keys that .env is missing, in .env.example order', async () => {
        const logger = createLogger();
        mockFiles('API_KEY=\nHOST=\nPORT=\n', 'HOST=localhost\n');

        const result = await compareEnvFiles(logger as unknown as Logger);

        expect(result).toEqual({ missing: ['API_KEY', 'PORT'], unused: [] });
        expect(logger.log).toHaveBeenCalledWith(
            '.env is missing 2 variable(s) defined in .env.example: API_KEY, PORT');
        expect(logger.log).not.toHaveBeenCalledWith('.env is in sync with .env.example.');
    });

    it('returns and logs keys in .env that .env.example does not define', async () => {
        const logger = createLogger();
        mockFiles('HOST=\n', 'HOST=localhost\nOLD_FLAG=true\n');

        const result = await compareEnvFiles(logger as unknown as Logger);

        expect(result).toEqual({ missing: [], unused: ['OLD_FLAG'] });
        expect(logger.log).toHaveBeenCalledWith(
            '.env has 1 variable(s) not defined in .env.example: OLD_FLAG');
        expect(logger.log).not.toHaveBeenCalledWith('.env is in sync with .env.example.');
    });

    it('reports missing and unused keys together', async () => {
        const logger = createLogger();
        mockFiles('HOST=\nPORT=\n', 'HOST=localhost\nLEGACY=1\n');

        const result = await compareEnvFiles(logger as unknown as Logger);

        expect(result).toEqual({ missing: ['PORT'], unused: ['LEGACY'] });
        expect(logger.log).toHaveBeenCalledTimes(2);
    });

    it('never logs variable values', async () => {
        const logger = createLogger();
        mockFiles('API_KEY=\n', 'SECRET_TOKEN=super-secret-value\n');

        await compareEnvFiles(logger as unknown as Logger);

        const output = [...logger.log.mock.calls, ...logger.info.mock.calls].flat().join('\n');
        expect(output).not.toContain('super-secret-value');
    });

    it('logs how many keys each file defines as info', async () => {
        const logger = createLogger();
        mockFiles('HOST=\nPORT=\n', 'HOST=localhost\n');

        await compareEnvFiles(logger as unknown as Logger);

        expect(logger.info).toHaveBeenCalledWith('.env.example defines 2 variable(s); .env defines 1.');
    });

    it('throws a FileSystemError when there is no .env.example', async () => {
        exists.mockImplementation(async (path) => path !== ENV_EXAMPLE_FILE);

        const error = await compareEnvFiles(createLogger() as unknown as Logger).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as Error).message).toBe('No .env.example found; nothing to compare .env against.');
        expect(readTextFile).not.toHaveBeenCalled();
    });

    it('throws a FileSystemError suggesting dev-setup init when there is no .env', async () => {
        exists.mockImplementation(async (path) => path !== ENV_FILE);

        const error = await compareEnvFiles(createLogger() as unknown as Logger).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as Error).message).toBe('No .env found. Run `dev-setup init` to create it from .env.example.');
        expect(readTextFile).not.toHaveBeenCalled();
    });

    it('propagates FileSystemErrors from reading a file', async () => {
        const error = new FileSystemError('Failed to read ".env".');
        readTextFile.mockRejectedValue(error);

        await expect(compareEnvFiles(createLogger() as unknown as Logger)).rejects.toBe(error);
    });
});
