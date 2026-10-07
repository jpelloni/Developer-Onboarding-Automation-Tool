import { DOCKER_VERSION, NODE_VERSION, PNPM_VERSION } from '../../src/config/constants.js';
import type { ToolReport } from '../../src/services/dependency.service.js';
import { DependencyError, MissingDependencyError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const getNodeVersion = jest.fn<Promise<string>, []>();
const getPnpmVersion = jest.fn<Promise<string>, []>();
const getDockerVersion = jest.fn<Promise<string>, []>();

jest.unstable_mockModule('../../src/adapters/node-toolchain.adapter.js', () => ({
    NodeToolchainAdapter: { getNodeVersion, getPnpmVersion },
}));
jest.unstable_mockModule('../../src/adapters/docker.adapter.js', () => ({
    DockerAdapter: { getDockerVersion },
}));

const {
    DependencyService: { getCompatibilityReport, formatCompatibilityReport, summarizeRequiredFailures },
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
