import { Command } from 'commander';
import type { CompatibilityOptions, InstallResult, ToolReport } from '../../src/services/dependency.service.js';
import type { DevEnvironmentResult } from '../../src/services/devcontainer.service.js';
import type { EnvComparison, EnvFileResult } from '../../src/services/env.service.js';
import type { ProjectChecksResult } from '../../src/services/project-checks.service.js';
import { DependencyError, FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const getCompatibilityReport = jest.fn<Promise<ToolReport[]>, [CompatibilityOptions, Logger]>();
const formatCompatibilityReport = jest.fn<string, [ToolReport[]]>();
const summarizeRequiredFailures = jest.fn<string | null, [ToolReport[]]>();
const installProjectDependencies = jest.fn<Promise<InstallResult>, [ToolReport[], Logger]>();
const generateEnvFile = jest.fn<Promise<EnvFileResult>, [Logger]>();
const compareEnvFiles = jest.fn<Promise<EnvComparison>, [Logger]>();
const startDevEnvironment = jest.fn<Promise<DevEnvironmentResult>, [ToolReport[], Logger]>();
const runProjectChecks = jest.fn<Promise<ProjectChecksResult>, [ToolReport[], Logger]>();
const loggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
};
const LoggerMock = jest.fn(() => loggerInstance);

jest.unstable_mockModule('../../src/services/dependency.service.js', () => ({
    DependencyService: {
        getCompatibilityReport, formatCompatibilityReport, summarizeRequiredFailures, installProjectDependencies,
    },
}));
jest.unstable_mockModule('../../src/services/env.service.js', () => ({
    EnvService: { generateEnvFile, compareEnvFiles },
}));
jest.unstable_mockModule('../../src/services/devcontainer.service.js', () => ({
    DevcontainerService: { startDevEnvironment },
}));
jest.unstable_mockModule('../../src/services/project-checks.service.js', () => ({
    ProjectChecksService: { runProjectChecks },
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({ Logger: LoggerMock }));

const { default: createInitCommand } = await import('../../src/commands/init.command.js');

// `init` reads --verbose and --debug from its parent, so run it under a program that defines them.
const runInit = (...args: string[]) => new Command()
    .option('-v, --verbose')
    .option('-d, --debug')
    .addCommand(createInitCommand())
    .parseAsync(args.length > 0 ? args : ['init'], { from: 'user' });

const REPORT: ToolReport[] = [
    { tool: 'node', required: true, minimumVersion: 'v24.0.0', installedVersion: 'v24.1.0', status: 'ok' },
];

const lastLog = (): unknown => loggerInstance.log.mock.calls.at(-1)?.[0];

beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    getCompatibilityReport.mockResolvedValue(REPORT);
    formatCompatibilityReport.mockReturnValue('TABLE');
    summarizeRequiredFailures.mockReturnValue(null);
    installProjectDependencies.mockResolvedValue('installed');
    generateEnvFile.mockResolvedValue('created');
    compareEnvFiles.mockResolvedValue({ missing: [], unused: [] });
    startDevEnvironment.mockResolvedValue('compose-started');
    runProjectChecks.mockResolvedValue({ status: 'ran', passed: ['lint', 'test'], failed: [] });
});

afterAll(() => {
    process.exitCode = undefined;
});

describe('createInitCommand', () => {
    it('creates a command named init', () => {
        const command = createInitCommand();

        expect(command.name()).toBe('init');
        expect(command.description()).toBe('Run the developer onboarding setup: check tools, install dependencies, create and check .env, start the dev environment, then run the project checks');
    });

    it('creates a quiet logger when no flags are passed', async () => {
        await runInit();

        expect(LoggerMock).toHaveBeenCalledWith(undefined, undefined);
    });

    it('passes the global --verbose and --debug flags to the logger', async () => {
        await runInit('--verbose', '--debug', 'init');

        expect(LoggerMock).toHaveBeenCalledWith(true, true);
    });

    describe('tool check', () => {
        it('requests the compatibility report with no extra tools by default', async () => {
            await runInit();

            expect(getCompatibilityReport).toHaveBeenCalledWith({ require: undefined, skip: undefined }, loggerInstance);
        });

        it('passes --require and --skip tools to the report', async () => {
            await runInit('init', '--require', 'docker', '--skip', 'git');

            expect(getCompatibilityReport).toHaveBeenCalledWith({ require: ['docker'], skip: ['git'] }, loggerInstance);
        });

        it('logs the formatted report', async () => {
            await runInit();

            expect(formatCompatibilityReport).toHaveBeenCalledWith(REPORT);
            expect(loggerInstance.log).toHaveBeenCalledWith('Dependency report:\nTABLE');
        });

        it('reports failed required tools as a problem and sets the exit code to 1', async () => {
            summarizeRequiredFailures.mockReturnValue('1 required tool(s) missing or outdated: node (missing)');

            await runInit();

            expect(lastLog()).toBe(
                'Setup finished with 1 problem(s):\n  - 1 required tool(s) missing or outdated: node (missing)');
            expect(process.exitCode).toBe(1);
        });

        it('logs a failed check, reports it, and still sets up .env', async () => {
            const error = new DependencyError('Unknown tool(s): dcoker. Expected one of: node, pnpm, docker.');
            getCompatibilityReport.mockRejectedValue(error);

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(generateEnvFile).toHaveBeenCalled();
            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - The tool check failed.');
            expect(process.exitCode).toBe(1);
        });

        it('wraps non-Error check failures in an Error before logging', async () => {
            getCompatibilityReport.mockRejectedValue('boom');

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(new Error('boom'));
        });
    });

    describe('dependency installation', () => {
        it('installs dependencies with the report and logger after the tool check and before .env setup', async () => {
            await runInit();

            expect(installProjectDependencies).toHaveBeenCalledWith(REPORT, loggerInstance);
            const installOrder = installProjectDependencies.mock.invocationCallOrder[0] as number;
            expect(getCompatibilityReport.mock.invocationCallOrder[0]).toBeLessThan(installOrder);
            expect(installOrder).toBeLessThan(generateEnvFile.mock.invocationCallOrder[0] as number);
        });

        it.each<InstallResult>(['no-manifest', 'pnpm-unavailable'])('does not report a problem when the result is %p', async (result) => {
            installProjectDependencies.mockResolvedValue(result);

            await runInit();

            expect(lastLog()).toBe('Setup complete.');
            expect(process.exitCode).toBeUndefined();
        });

        it('skips the install with --no-install', async () => {
            await runInit('init', '--no-install');

            expect(installProjectDependencies).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith('Skipping dependency installation (--no-install).');
            expect(generateEnvFile).toHaveBeenCalled();
        });

        it('skips the install when the tool check failed', async () => {
            getCompatibilityReport.mockRejectedValue(new DependencyError('Unknown tool(s): dcoker.'));

            await runInit();

            expect(installProjectDependencies).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith(
                'Skipping dependency installation because the tool check failed.');
        });

        it('logs a failed install, reports it, and still sets up .env', async () => {
            const error = new DependencyError('"pnpm install" exited with code 1.');
            installProjectDependencies.mockRejectedValue(error);

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(generateEnvFile).toHaveBeenCalled();
            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - Installing dependencies failed.');
            expect(process.exitCode).toBe(1);
        });
    });

    describe('.env setup', () => {
        it('generates .env with the created logger after the tool check', async () => {
            await runInit();

            expect(generateEnvFile).toHaveBeenCalledWith(loggerInstance);
            expect(getCompatibilityReport.mock.invocationCallOrder[0])
                .toBeLessThan(generateEnvFile.mock.invocationCallOrder[0] as number);
        });

        it.each<EnvFileResult>(['created', 'no-template'])('does not compare the files when the result is %p', async (result) => {
            generateEnvFile.mockResolvedValue(result);

            await runInit();

            expect(compareEnvFiles).not.toHaveBeenCalled();
        });

        it('compares an existing .env with .env.example', async () => {
            generateEnvFile.mockResolvedValue('exists');

            await runInit();

            expect(compareEnvFiles).toHaveBeenCalledWith(loggerInstance);
            expect(process.exitCode).toBeUndefined();
        });

        it('reports missing variables as a problem and sets the exit code to 1', async () => {
            generateEnvFile.mockResolvedValue('exists');
            compareEnvFiles.mockResolvedValue({ missing: ['API_KEY', 'PORT'], unused: [] });

            await runInit();

            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - .env is missing 2 variable(s).');
            expect(process.exitCode).toBe(1);
        });

        it('does not treat unused variables as a problem', async () => {
            generateEnvFile.mockResolvedValue('exists');
            compareEnvFiles.mockResolvedValue({ missing: [], unused: ['LEGACY'] });

            await runInit();

            expect(lastLog()).toBe('Setup complete.');
            expect(process.exitCode).toBeUndefined();
        });

        it('logs .env errors instead of throwing and reports them', async () => {
            const error = new FileSystemError('Failed to copy ".env.example" to ".env".');
            generateEnvFile.mockRejectedValue(error);

            await expect(runInit()).resolves.toBeDefined();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - Setting up .env failed.');
            expect(process.exitCode).toBe(1);
        });

        it('reports comparison errors', async () => {
            const error = new FileSystemError('Failed to read ".env".');
            generateEnvFile.mockResolvedValue('exists');
            compareEnvFiles.mockRejectedValue(error);

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(process.exitCode).toBe(1);
        });
    });

    describe('dev environment', () => {
        it('starts the dev environment with the report and logger after .env setup', async () => {
            await runInit();

            expect(startDevEnvironment).toHaveBeenCalledWith(REPORT, loggerInstance);
            expect(generateEnvFile.mock.invocationCallOrder[0])
                .toBeLessThan(startDevEnvironment.mock.invocationCallOrder[0] as number);
        });

        it.each<DevEnvironmentResult>(['no-config', 'inside-container', 'docker-unavailable', 'cli-unavailable'])(
            'does not report a problem when the result is %p', async (result) => {
                startDevEnvironment.mockResolvedValue(result);

                await runInit();

                expect(lastLog()).toBe('Setup complete.');
                expect(process.exitCode).toBeUndefined();
            });

        it('skips the dev environment with --no-start', async () => {
            await runInit('init', '--no-start');

            expect(startDevEnvironment).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith('Skipping the dev environment (--no-start).');
        });

        it('skips the dev environment when the tool check failed', async () => {
            getCompatibilityReport.mockRejectedValue(new DependencyError('Unknown tool(s): dcoker.'));

            await runInit();

            expect(startDevEnvironment).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith(
                'Skipping the dev environment because the tool check failed.');
        });

        it('starts the dev environment even when .env setup failed', async () => {
            generateEnvFile.mockRejectedValue(new FileSystemError('Failed to copy ".env.example" to ".env".'));

            await runInit();

            expect(startDevEnvironment).toHaveBeenCalled();
        });

        it('logs a failed start and reports it', async () => {
            const error = new DependencyError('"docker compose up -d" exited with code 1.');
            startDevEnvironment.mockRejectedValue(error);

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - Starting the dev environment failed.');
            expect(process.exitCode).toBe(1);
        });
    });

    describe('project checks', () => {
        it('runs the project checks with the report and logger after starting the dev environment', async () => {
            await runInit();

            expect(runProjectChecks).toHaveBeenCalledWith(REPORT, loggerInstance);
            expect(startDevEnvironment.mock.invocationCallOrder[0])
                .toBeLessThan(runProjectChecks.mock.invocationCallOrder[0] as number);
        });

        it.each<ProjectChecksResult>([
            { status: 'no-manifest' },
            { status: 'no-scripts' },
            { status: 'pnpm-unavailable' },
            { status: 'ran', passed: ['test'], failed: [] },
        ])('does not report a problem when the result is %p', async (result) => {
            runProjectChecks.mockResolvedValue(result);

            await runInit();

            expect(lastLog()).toBe('Setup complete.');
            expect(process.exitCode).toBeUndefined();
        });

        it('reports failed scripts as a problem and sets the exit code to 1', async () => {
            runProjectChecks.mockResolvedValue({ status: 'ran', passed: [], failed: ['lint', 'test'] });

            await runInit();

            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - Project checks failed: lint, test.');
            expect(process.exitCode).toBe(1);
        });

        it('skips the project checks with --no-checks', async () => {
            await runInit('init', '--no-checks');

            expect(runProjectChecks).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith('Skipping the project checks (--no-checks).');
        });

        it('skips the project checks when the tool check failed', async () => {
            getCompatibilityReport.mockRejectedValue(new DependencyError('Unknown tool(s): dcoker.'));

            await runInit();

            expect(runProjectChecks).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith(
                'Skipping the project checks because the tool check failed.');
        });

        it('skips the project checks when installing dependencies failed', async () => {
            installProjectDependencies.mockRejectedValue(new DependencyError('"pnpm install" exited with code 1.'));

            await runInit();

            expect(runProjectChecks).not.toHaveBeenCalled();
            expect(loggerInstance.info).toHaveBeenCalledWith(
                'Skipping the project checks because installing dependencies failed.');
        });

        it('runs the project checks with --no-install', async () => {
            await runInit('init', '--no-install');

            expect(runProjectChecks).toHaveBeenCalled();
        });

        it('logs errors from the checks and reports them', async () => {
            const error = new DependencyError('Failed to parse package.json.');
            runProjectChecks.mockRejectedValue(error);

            await runInit();

            expect(loggerInstance.error).toHaveBeenCalledWith(error);
            expect(lastLog()).toBe('Setup finished with 1 problem(s):\n  - Running the project checks failed.');
            expect(process.exitCode).toBe(1);
        });
    });

    describe('summary', () => {
        it('logs that setup is complete and leaves the exit code unset when nothing failed', async () => {
            await runInit();

            expect(lastLog()).toBe('Setup complete.');
            expect(process.exitCode).toBeUndefined();
        });

        it('lists every problem when several steps fail', async () => {
            summarizeRequiredFailures.mockReturnValue('1 required tool(s) missing or outdated: pnpm (outdated)');
            generateEnvFile.mockResolvedValue('exists');
            compareEnvFiles.mockResolvedValue({ missing: ['PORT'], unused: [] });

            await runInit();

            expect(lastLog()).toBe([
                'Setup finished with 2 problem(s):',
                '  - 1 required tool(s) missing or outdated: pnpm (outdated)',
                '  - .env is missing 1 variable(s).',
            ].join('\n'));
        });
    });
});
