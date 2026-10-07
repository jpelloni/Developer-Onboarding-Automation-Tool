import { Command } from 'commander';
import { FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const checkDependencies = jest.fn<Promise<void>, [string[], Logger]>();
const generateEnvFile = jest.fn<Promise<string>, [Logger]>();
const loggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
};
const LoggerMock = jest.fn(() => loggerInstance);

jest.unstable_mockModule('../../src/services/dependency.service.js', () => ({
    DependencyService: { checkDependencies },
}));
jest.unstable_mockModule('../../src/services/env.service.js', () => ({
    EnvService: { generateEnvFile },
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({ Logger: LoggerMock }));

const { default: createInitCommand } = await import('../../src/commands/init.command.js');

// `init` reads --verbose and --debug from its parent, so run it under a program that defines them.
const runInit = (...args: string[]) => new Command()
    .option('-v, --verbose')
    .option('-d, --debug')
    .addCommand(createInitCommand())
    .parseAsync([...args, 'init'], { from: 'user' });

beforeEach(() => {
    jest.clearAllMocks();
    checkDependencies.mockResolvedValue(undefined);
    generateEnvFile.mockResolvedValue('created');
});

describe('createInitCommand', () => {
    it('creates a command named init', () => {
        const command = createInitCommand();

        expect(command.name()).toBe('init');
        expect(command.description()).toBe('Initialize the developer onboarding setup');
    });

    it('creates a quiet logger when no flags are passed', async () => {
        await runInit();

        expect(LoggerMock).toHaveBeenCalledWith(undefined, undefined);
    });

    it('passes the global --verbose and --debug flags to the logger', async () => {
        await runInit('--verbose', '--debug');

        expect(LoggerMock).toHaveBeenCalledWith(true, true);
    });

    it('logs that setup started', async () => {
        await runInit();

        expect(loggerInstance.log).toHaveBeenCalledWith('Developer onboarding setup initialized.');
    });

    it('checks node and pnpm with the created logger', async () => {
        await runInit();

        expect(checkDependencies).toHaveBeenCalledWith(['node', 'pnpm'], loggerInstance);
    });

    it('waits for the dependency check to finish', async () => {
        let finished = false;
        checkDependencies.mockImplementation(async () => {
            await Promise.resolve();
            finished = true;
        });

        await runInit();

        expect(finished).toBe(true);
    });

    it('generates .env with the created logger after the dependency check', async () => {
        await runInit();

        expect(generateEnvFile).toHaveBeenCalledWith(loggerInstance);
        expect(checkDependencies.mock.invocationCallOrder[0])
            .toBeLessThan(generateEnvFile.mock.invocationCallOrder[0] as number);
    });

    it('logs .env generation errors instead of throwing', async () => {
        const error = new FileSystemError('Failed to copy ".env.example" to ".env".');
        generateEnvFile.mockRejectedValue(error);

        await expect(runInit()).resolves.toBeDefined();

        expect(loggerInstance.error).toHaveBeenCalledWith(error);
    });

    it('wraps non-Error .env generation failures in an Error before logging', async () => {
        generateEnvFile.mockRejectedValue('boom');

        await runInit();

        expect(loggerInstance.error).toHaveBeenCalledWith(new Error('boom'));
    });
});
