import { ENV_EXAMPLE_FILE, ENV_FILE } from '../../src/config/constants.js';
import { FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const exists = jest.fn<Promise<boolean>, [string]>();
const copyFileIfAbsent = jest.fn<Promise<boolean>, [string, string]>();

jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { exists, copyFileIfAbsent },
}));

const { EnvService: { generateEnvFile } } = await import('../../src/services/env.service.js');

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
});

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
