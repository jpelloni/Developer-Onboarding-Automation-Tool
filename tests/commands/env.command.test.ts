import { Command } from 'commander';
import type { EnvComparison } from '../../src/services/env.service.js';
import { FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const compareEnvFiles = jest.fn<Promise<EnvComparison>, [Logger]>();
const loggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
};
const LoggerMock = jest.fn(() => loggerInstance);

jest.unstable_mockModule('../../src/services/env.service.js', () => ({
    EnvService: { compareEnvFiles },
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({ Logger: LoggerMock }));

const { default: createEnvCommand } = await import('../../src/commands/env.command.js');

// `env` reads --verbose and --debug from its parent, so run it under a program that defines them.
const runEnv = (...args: string[]) => new Command()
    .option('-v, --verbose')
    .option('-d, --debug')
    .addCommand(createEnvCommand())
    .parseAsync([...args, 'env'], { from: 'user' });

beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    compareEnvFiles.mockResolvedValue({ missing: [], unused: [] });
});

afterAll(() => {
    process.exitCode = undefined;
});

describe('createEnvCommand', () => {
    it('creates a command named env', () => {
        const command = createEnvCommand();

        expect(command.name()).toBe('env');
        expect(command.description()).toBe('Compare .env with .env.example and report missing or unused variables');
    });

    it('passes the global --verbose and --debug flags to the logger', async () => {
        await runEnv('--verbose', '--debug');

        expect(LoggerMock).toHaveBeenCalledWith(true, true);
    });

    it('compares the env files with the created logger', async () => {
        await runEnv();

        expect(compareEnvFiles).toHaveBeenCalledWith(loggerInstance);
    });

    it('leaves the exit code unset when the files are in sync', async () => {
        await runEnv();

        expect(process.exitCode).toBeUndefined();
    });

    it('leaves the exit code unset when .env only has unused variables', async () => {
        compareEnvFiles.mockResolvedValue({ missing: [], unused: ['LEGACY'] });

        await runEnv();

        expect(process.exitCode).toBeUndefined();
    });

    it('sets the exit code to 1 when .env is missing variables', async () => {
        compareEnvFiles.mockResolvedValue({ missing: ['API_KEY'], unused: [] });

        await runEnv();

        expect(process.exitCode).toBe(1);
    });

    it('logs comparison errors instead of throwing and sets the exit code to 1', async () => {
        const error = new FileSystemError('No .env found. Run `dev-setup init` to create it from .env.example.');
        compareEnvFiles.mockRejectedValue(error);

        await expect(runEnv()).resolves.toBeDefined();

        expect(loggerInstance.error).toHaveBeenCalledWith(error);
        expect(process.exitCode).toBe(1);
    });

    it('wraps non-Error failures in an Error before logging', async () => {
        compareEnvFiles.mockRejectedValue('boom');

        await runEnv();

        expect(loggerInstance.error).toHaveBeenCalledWith(new Error('boom'));
    });
});
