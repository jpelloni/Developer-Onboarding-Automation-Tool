import { DEVCONTAINER_CLI_VERSION, DOCKER_VERSION, NODE_VERSION, PNPM_VERSION } from '../../src/config/constants.js';
import type { ToolReport } from '../../src/services/dependency.service.js';
import { DependencyError, FileSystemError, MissingDependencyError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const getNodeVersion = jest.fn<Promise<string>, []>();
const getPnpmVersion = jest.fn<Promise<string>, []>();
const getDockerVersion = jest.fn<Promise<string>, []>();
const installDependencies = jest.fn<Promise<void>, []>();
const exists = jest.fn<Promise<boolean>, [string]>();
const getCliVersion = jest.fn<Promise<string>, []>();
const devcontainerExec = jest.fn<Promise<void>, [string]>();

jest.unstable_mockModule('../../src/adapters/node-toolchain.adapter.js', () => ({
    NodeToolchainAdapter: { getNodeVersion, getPnpmVersion, installDependencies },
}));
jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { exists },
}));
jest.unstable_mockModule('../../src/adapters/docker.adapter.js', () => ({
    DockerAdapter: { getDockerVersion },
}));
jest.unstable_mockModule('../../src/adapters/devcontainer.adapter.js', () => ({
    DevcontainerAdapter: { getCliVersion, exec: devcontainerExec },
}));

const {
    DependencyService: {
        getCompatibilityReport, formatCompatibilityReport, summarizeRequiredFailures, installProjectDependencies,
    },
    DEVCONTAINER_PROFILE,
} = await import('../../src/services/dependency.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

beforeEach(() => {
    getNodeVersion.mockReset().mockResolvedValue('v24.1.0');
    getPnpmVersion.mockReset().mockResolvedValue('12.6.0');
    getDockerVersion.mockReset().mockResolvedValue('27.3.1');
    installDependencies.mockReset().mockResolvedValue();
    exists.mockReset().mockResolvedValue(true);
    getCliVersion.mockReset().mockResolvedValue('0.72.0');
    devcontainerExec.mockReset().mockResolvedValue();
});

describe('getCompatibilityReport', () => {
    const report = (options: Parameters<typeof getCompatibilityReport>[0], logger = createLogger()) =>
        getCompatibilityReport(options, logger as unknown as Logger);

    it('reports node, pnpm, and docker in order, with docker optional by default', async () => {
        const result = await report({});

        expect(result).toEqual([
            { tool: 'node', required: true, minimumVersion: NODE_VERSION, installedVersion: 'v24.1.0', status: 'ok' },
            { tool: 'pnpm', required: true, minimumVersion: PNPM_VERSION, installedVersion: '12.6.0', status: 'ok' },
            { tool: 'docker', required: false, minimumVersion: DOCKER_VERSION, installedVersion: '27.3.1', status: 'ok' },
        ]);
    });

    it('marks a tool older than its minimum as outdated', async () => {
        getPnpmVersion.mockResolvedValue('1.0.0');

        const result = await report({});

        expect(result[1]).toMatchObject({ tool: 'pnpm', installedVersion: '1.0.0', status: 'outdated' });
    });

    it('marks a tool whose version command fails as missing and logs the reason as debug', async () => {
        const logger = createLogger();
        getDockerVersion.mockRejectedValue(
            new MissingDependencyError('Failed to run "docker --version". Is Docker installed?'));

        const result = await report({}, logger);

        expect(result[2]).toMatchObject({ tool: 'docker', installedVersion: null, status: 'missing' });
        expect(logger.debug).toHaveBeenCalledWith('Failed to run "docker --version". Is Docker installed?');
    });

    it('treats non-Error failures as missing', async () => {
        const logger = createLogger();
        getNodeVersion.mockRejectedValue('boom');

        const result = await report({}, logger);

        expect(result[0]).toMatchObject({ tool: 'node', status: 'missing' });
        expect(logger.debug).toHaveBeenCalledWith('boom');
    });

    it('keeps checking other tools when one fails', async () => {
        getNodeVersion.mockRejectedValue(new MissingDependencyError('Failed to run "node --version".'));

        const result = await report({});

        expect(result.map((entry) => entry.status)).toEqual(['missing', 'ok', 'ok']);
        expect(getPnpmVersion).toHaveBeenCalled();
        expect(getDockerVersion).toHaveBeenCalled();
    });

    it('logs each detected version as info', async () => {
        const logger = createLogger();

        await report({}, logger);

        expect(logger.info).toHaveBeenCalledWith('docker version: 27.3.1');
    });

    it('makes a tool required when it is passed to require', async () => {
        const result = await report({ require: ['docker'] });

        expect(result[2]).toMatchObject({ tool: 'docker', required: true });
    });

    it('leaves a tool passed to skip out of the report without checking it', async () => {
        const result = await report({ skip: ['docker'] });

        expect(result.map((entry) => entry.tool)).toEqual(['node', 'pnpm']);
        expect(getDockerVersion).not.toHaveBeenCalled();
    });

    it('accepts comma-separated, mixed-case tool names with whitespace', async () => {
        const result = await report({ require: [' Docker , '] });

        expect(result[2]).toMatchObject({ tool: 'docker', required: true });
    });

    it('throws a DependencyError listing unknown tools', async () => {
        const error = await report({ require: ['dcoker', 'git'] }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DependencyError);
        expect((error as Error).message).toBe('Unknown tool(s): dcoker, git. Expected one of: node, pnpm, docker.');
        expect(getNodeVersion).not.toHaveBeenCalled();
    });

    it('throws a DependencyError when an always-required tool is skipped', async () => {
        const error = await report({ skip: ['node'] }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DependencyError);
        expect((error as Error).message).toBe("node can't be skipped; dev-setup always requires it.");
    });

    it('throws a DependencyError when a tool is both required and skipped', async () => {
        const error = await report({ require: ['docker'], skip: ['docker'] }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DependencyError);
        expect((error as Error).message).toBe("docker can't be both required and skipped.");
    });
});

describe('getCompatibilityReport with DEVCONTAINER_PROFILE', () => {
    const report = (options: Parameters<typeof getCompatibilityReport>[0] = {}) =>
        getCompatibilityReport({ ...options, profile: DEVCONTAINER_PROFILE }, createLogger() as unknown as Logger);

    it('reports docker and the Dev Container CLI as required, without checking Node.js or pnpm', async () => {
        const result = await report();

        expect(result).toEqual([
            { tool: 'docker', required: true, minimumVersion: DOCKER_VERSION, installedVersion: '27.3.1', status: 'ok' },
            { tool: 'devcontainer', required: true, minimumVersion: DEVCONTAINER_CLI_VERSION, installedVersion: '0.72.0', status: 'ok' },
        ]);
        expect(getNodeVersion).not.toHaveBeenCalled();
        expect(getPnpmVersion).not.toHaveBeenCalled();
    });

    it('marks a missing Dev Container CLI as missing', async () => {
        getCliVersion.mockRejectedValue(new MissingDependencyError('Failed to run "devcontainer --version".'));

        const result = await report();

        expect(result[1]).toMatchObject({ tool: 'devcontainer', installedVersion: null, status: 'missing' });
    });

    it('throws a DependencyError for tools outside the profile', async () => {
        await expect(report({ require: ['node'] })).rejects.toThrow(
            new DependencyError('Unknown tool(s): node. Expected one of: docker, devcontainer.'));
    });

    it('throws a DependencyError when a profile tool is skipped', async () => {
        await expect(report({ skip: ['docker'] })).rejects.toThrow(
            new DependencyError("docker can't be skipped; dev-setup always requires it."));
    });
});

describe('formatCompatibilityReport', () => {
    it('formats the rows as an aligned table, showing "-" for a missing version', () => {
        const rows: ToolReport[] = [
            { tool: 'node', required: true, minimumVersion: 'v24.0.0', installedVersion: 'v24.1.0', status: 'ok' },
            { tool: 'docker', required: false, minimumVersion: '24.0.0', installedVersion: null, status: 'missing' },
        ];

        const result = formatCompatibilityReport(rows);

        expect(result).toBe([
            'Tool    Required  Minimum  Installed  Status',
            'node    yes       v24.0.0  v24.1.0    ok',
            'docker  no        24.0.0   -          missing',
        ].join('\n'));
    });

    it('formats an empty report as just the header', () => {
        const result = formatCompatibilityReport([]);

        expect(result).toBe('Tool  Required  Minimum  Installed  Status');
    });
});

describe('summarizeRequiredFailures', () => {
    const row = (overrides: Partial<ToolReport>): ToolReport => ({
        tool: 'node', required: true, minimumVersion: 'v24.0.0', installedVersion: 'v24.1.0', status: 'ok', ...overrides,
    });

    it('returns null when every required tool is ok', () => {
        const result = summarizeRequiredFailures([row({}), row({ tool: 'pnpm' })]);

        expect(result).toBeNull();
    });

    it('ignores failed optional tools', () => {
        const result = summarizeRequiredFailures([row({ tool: 'docker', required: false, status: 'missing' })]);

        expect(result).toBeNull();
    });

    it('lists failed required tools with their status', () => {
        const result = summarizeRequiredFailures([
            row({ status: 'outdated' }),
            row({ tool: 'pnpm' }),
            row({ tool: 'docker', status: 'missing', installedVersion: null }),
        ]);

        expect(result).toBe('2 required tool(s) missing or outdated: node (outdated), docker (missing)');
    });
});

describe('installProjectDependencies', () => {
    const pnpmRow = (status: ToolReport['status']): ToolReport => ({
        tool: 'pnpm', required: true, minimumVersion: PNPM_VERSION, installedVersion: status === 'missing' ? null : '12.6.0', status,
    });
    const install = (report: ToolReport[], logger = createLogger()) =>
        installProjectDependencies(report, logger as unknown as Logger);

    it('runs pnpm install when package.json exists and pnpm is ok, logging start and success', async () => {
        const logger = createLogger();

        const result = await install([pnpmRow('ok')], logger);

        expect(result).toBe('installed');
        expect(exists).toHaveBeenCalledWith('package.json');
        expect(installDependencies).toHaveBeenCalledTimes(1);
        expect(logger.log.mock.calls).toEqual([
            ['Installing dependencies with pnpm install...'],
            ['Dependencies installed.'],
        ]);
    });

    it('skips the install when there is no package.json', async () => {
        const logger = createLogger();
        exists.mockResolvedValue(false);

        const result = await install([pnpmRow('ok')], logger);

        expect(result).toBe('no-manifest');
        expect(installDependencies).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('No package.json found; skipping dependency installation.');
    });

    it.each<ToolReport['status']>(['missing', 'outdated'])('skips the install when pnpm is %s', async (status) => {
        const logger = createLogger();

        const result = await install([pnpmRow(status)], logger);

        expect(result).toBe('pnpm-unavailable');
        expect(installDependencies).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('pnpm is missing or outdated; skipping dependency installation.');
    });

    it('skips the install when the report has no pnpm row', async () => {
        const result = await install([]);

        expect(result).toBe('pnpm-unavailable');
        expect(installDependencies).not.toHaveBeenCalled();
    });

    it('propagates a failed install without logging success', async () => {
        const logger = createLogger();
        installDependencies.mockRejectedValue(new DependencyError('"pnpm install" exited with code 1.'));

        await expect(install([pnpmRow('ok')], logger)).rejects.toThrow(DependencyError);
        expect(logger.log).not.toHaveBeenCalledWith('Dependencies installed.');
    });

    it('propagates a failure to check for package.json', async () => {
        exists.mockRejectedValue(new FileSystemError('Failed to check whether "package.json" exists.'));

        await expect(install([pnpmRow('ok')])).rejects.toThrow(FileSystemError);
        expect(installDependencies).not.toHaveBeenCalled();
    });

    describe('in the devcontainer', () => {
        it('runs pnpm install inside the container without needing pnpm in the report', async () => {
            const logger = createLogger();

            const result = await installProjectDependencies([], logger as unknown as Logger, 'devcontainer');

            expect(result).toBe('installed');
            expect(devcontainerExec).toHaveBeenCalledWith('pnpm install');
            expect(installDependencies).not.toHaveBeenCalled();
            expect(logger.log.mock.calls).toEqual([
                ['Installing dependencies with pnpm install in the devcontainer...'],
                ['Dependencies installed.'],
            ]);
        });

        it('skips the install when there is no package.json', async () => {
            exists.mockResolvedValue(false);

            const result = await installProjectDependencies([], createLogger() as unknown as Logger, 'devcontainer');

            expect(result).toBe('no-manifest');
            expect(devcontainerExec).not.toHaveBeenCalled();
        });

        it('propagates a failed install', async () => {
            devcontainerExec.mockRejectedValue(new DependencyError('"devcontainer exec --workspace-folder . pnpm install" exited with code 1.'));

            await expect(installProjectDependencies([], createLogger() as unknown as Logger, 'devcontainer'))
                .rejects.toThrow(DependencyError);
        });
    });
});
