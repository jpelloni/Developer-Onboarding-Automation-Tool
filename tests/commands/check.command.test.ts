import { Command } from 'commander';
import type { CompatibilityOptions, ToolReport } from '../../src/services/dependency.service.js';
import { DependencyError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const getCompatibilityReport = jest.fn<Promise<ToolReport[]>, [CompatibilityOptions, Logger]>();
const formatCompatibilityReport = jest.fn<string, [ToolReport[]]>();
const loggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
};
const LoggerMock = jest.fn(() => loggerInstance);

jest.unstable_mockModule('../../src/services/dependency.service.js', () => ({
    DependencyService: { getCompatibilityReport, formatCompatibilityReport },
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({ Logger: LoggerMock }));

const { default: createCheckCommand } = await import('../../src/commands/check.command.js');

// `check` reads --verbose and --debug from its parent, so run it under a program that defines them.
const runCheck = (...args: string[]) => new Command()
    .option('-v, --verbose')
    .option('-d, --debug')
    .addCommand(createCheckCommand())
    .parseAsync(args, { from: 'user' });

const entry = (overrides: Partial<ToolReport>): ToolReport => ({
    tool: 'node',
    required: true,
    minimumVersion: 'v24.0.0',
    installedVersion: 'v24.1.0',
    status: 'ok',
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    getCompatibilityReport.mockResolvedValue([entry({})]);
    formatCompatibilityReport.mockReturnValue('TABLE');
});

afterAll(() => {
    process.exitCode = undefined;
});

describe('createCheckCommand', () => {
    it('creates a command named check', () => {
        const command = createCheckCommand();

        expect(command.name()).toBe('check');
        expect(command.description()).toBe('Report whether required tools are installed and meet the minimum versions');
    });

    it('passes the global --verbose and --debug flags to the logger', async () => {
        await runCheck('--verbose', '--debug', 'check');

        expect(LoggerMock).toHaveBeenCalledWith(true, true);
    });

    it('requests the report with no extra tools by default', async () => {
        await runCheck('check');

        expect(getCompatibilityReport).toHaveBeenCalledWith({ require: undefined, skip: undefined }, loggerInstance);
    });

    it('passes --require and --skip tools to the report', async () => {
        await runCheck('check', '--require', 'docker', 'pnpm', '--skip', 'git');

        expect(getCompatibilityReport).toHaveBeenCalledWith(
            { require: ['docker', 'pnpm'], skip: ['git'] }, loggerInstance);
    });

    it('logs the formatted report', async () => {
        const report = [entry({})];
        getCompatibilityReport.mockResolvedValue(report);

        await runCheck('check');

        expect(formatCompatibilityReport).toHaveBeenCalledWith(report);
        expect(loggerInstance.log).toHaveBeenCalledWith('Dependency report:\nTABLE');
    });

    it('reports success and leaves the exit code unset when required tools are ok', async () => {
        getCompatibilityReport.mockResolvedValue([
            entry({}),
            entry({ tool: 'docker', required: false, installedVersion: null, status: 'missing' }),
        ]);

        await runCheck('check');

        expect(loggerInstance.log).toHaveBeenCalledWith('All required tools are installed and up to date.');
        expect(process.exitCode).toBeUndefined();
    });

    it('lists failed required tools and sets the exit code to 1', async () => {
        getCompatibilityReport.mockResolvedValue([
            entry({ status: 'outdated', installedVersion: 'v18.0.0' }),
            entry({ tool: 'docker', required: true, installedVersion: null, status: 'missing' }),
        ]);

        await runCheck('check');

        expect(loggerInstance.log).toHaveBeenCalledWith(
            '2 required tool(s) missing or outdated: node (outdated), docker (missing)');
        expect(process.exitCode).toBe(1);
    });

    it('logs errors instead of throwing and sets the exit code to 1', async () => {
        const error = new DependencyError('Unknown tool(s): dcoker. Expected one of: node, pnpm, docker.');
        getCompatibilityReport.mockRejectedValue(error);

        await expect(runCheck('check', '--require', 'dcoker')).resolves.toBeDefined();

        expect(loggerInstance.error).toHaveBeenCalledWith(error);
        expect(process.exitCode).toBe(1);
    });

    it('wraps non-Error failures in an Error before logging', async () => {
        getCompatibilityReport.mockRejectedValue('boom');

        await runCheck('check');

        expect(loggerInstance.error).toHaveBeenCalledWith(new Error('boom'));
    });
});
