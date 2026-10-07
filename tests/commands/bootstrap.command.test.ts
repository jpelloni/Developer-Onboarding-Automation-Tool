import { Command } from 'commander';
import type { BootstrapOptions, BootstrapResult } from '../../src/services/project-bootstrap.service.js';
import { BootstrapError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const bootstrapProject = jest.fn<Promise<BootstrapResult>, [string, BootstrapOptions, Logger]>();
const loggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
};
const LoggerMock = jest.fn(() => loggerInstance);

jest.unstable_mockModule('../../src/services/project-bootstrap.service.js', () => ({
    ProjectBootstrapService: { bootstrapProject },
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({ Logger: LoggerMock }));

const { default: createBootstrapCommand } = await import('../../src/commands/bootstrap.command.js');

// `bootstrap` reads --verbose and --debug from its parent, so run it under a program that defines them.
const runBootstrap = (...args: string[]) => new Command()
    .option('-v, --verbose')
    .option('-d, --debug')
    .exitOverride()
    .addCommand(createBootstrapCommand())
    .parseAsync(args, { from: 'user' });

beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    bootstrapProject.mockResolvedValue({ directory: 'my-service', files: [], skipped: [] });
});

afterAll(() => {
    process.exitCode = undefined;
});

describe('createBootstrapCommand', () => {
    it('creates a command named bootstrap that takes a name', () => {
        const command = createBootstrapCommand();

        expect(command.name()).toBe('bootstrap');
        expect(command.description()).toBe('Create a new Node.js + TypeScript + pnpm project from the project template');
        expect(command.registeredArguments.map((argument) => argument.name())).toEqual(['name']);
    });

    it('passes the global --verbose and --debug flags to the logger', async () => {
        await runBootstrap('--verbose', '--debug', 'bootstrap', 'my-service');

        expect(LoggerMock).toHaveBeenCalledWith(true, true);
    });

    it('bootstraps the named project with the created logger', async () => {
        await runBootstrap('bootstrap', 'my-service');

        expect(bootstrapProject).toHaveBeenCalledWith('my-service', { dryRun: false }, loggerInstance);
        expect(process.exitCode).toBeUndefined();
    });

    it('passes --dry-run to the service', async () => {
        await runBootstrap('bootstrap', 'my-service', '--dry-run');

        expect(bootstrapProject).toHaveBeenCalledWith('my-service', { dryRun: true }, loggerInstance);
    });

    it('logs errors instead of throwing and sets the exit code to 1', async () => {
        const error = new BootstrapError('"my-service" already exists and isn\'t empty. Choose another name or remove it.');
        bootstrapProject.mockRejectedValue(error);

        await expect(runBootstrap('bootstrap', 'my-service')).resolves.toBeDefined();

        expect(loggerInstance.error).toHaveBeenCalledWith(error);
        expect(process.exitCode).toBe(1);
    });

    it('wraps non-Error failures in an Error before logging', async () => {
        bootstrapProject.mockRejectedValue('boom');

        await runBootstrap('bootstrap', 'my-service');

        expect(loggerInstance.error).toHaveBeenCalledWith(new Error('boom'));
    });
});
