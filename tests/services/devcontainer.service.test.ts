import type { ToolReport, ToolStatus } from '../../src/services/dependency.service.js';
import { DependencyError, FileSystemError, MissingDependencyError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const exists = jest.fn<Promise<boolean>, [string]>();
const composeUp = jest.fn<Promise<void>, []>();
const getCliVersion = jest.fn<Promise<string>, []>();
const up = jest.fn<Promise<void>, []>();
const isInsideContainer = jest.fn<boolean, []>();

jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { exists },
}));
jest.unstable_mockModule('../../src/adapters/docker.adapter.js', () => ({
    DockerAdapter: { composeUp },
}));
jest.unstable_mockModule('../../src/adapters/devcontainer.adapter.js', () => ({
    DevcontainerAdapter: { getCliVersion, up, isInsideContainer },
}));

const { DevcontainerService: { startDevEnvironment } } = await import('../../src/services/devcontainer.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

const reportWithDocker = (status: ToolStatus): ToolReport[] => [
    { tool: 'node', required: true, minimumVersion: 'v24.0.0', installedVersion: 'v24.1.0', status: 'ok' },
    {
        tool: 'docker', required: false, minimumVersion: '24.0.0',
        installedVersion: status === 'missing' ? null : '27.3.1', status,
    },
];

const REPORT = reportWithDocker('ok');

const givenFiles = (...paths: string[]): void => {
    exists.mockImplementation(async (path) => paths.includes(path));
};

let logger: ReturnType<typeof createLogger>;

beforeEach(() => {
    logger = createLogger();
    exists.mockReset().mockResolvedValue(false);
    composeUp.mockReset().mockResolvedValue(undefined);
    getCliVersion.mockReset().mockResolvedValue('0.72.0');
    up.mockReset().mockResolvedValue(undefined);
    isInsideContainer.mockReset().mockReturnValue(false);
});

describe('startDevEnvironment', () => {
    it('returns no-config when there is no devcontainer or Compose configuration', async () => {
        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('no-config');
        expect(logger.info).toHaveBeenCalledWith(
            'No devcontainer or Docker Compose configuration found; skipping the dev environment.');
        expect(composeUp).not.toHaveBeenCalled();
        expect(up).not.toHaveBeenCalled();
    });

    it('starts the devcontainer when there is a configuration and it is not inside a container', async () => {
        givenFiles('.devcontainer/devcontainer.json');

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('devcontainer-started');
        expect(up).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('Starting the devcontainer from .devcontainer/devcontainer.json...');
        expect(logger.log).toHaveBeenCalledWith('Devcontainer started.');
    });

    it('finds a root-level .devcontainer.json', async () => {
        givenFiles('.devcontainer.json');

        await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(logger.log).toHaveBeenCalledWith('Starting the devcontainer from .devcontainer.json...');
    });

    it('prefers the devcontainer over Compose outside a container', async () => {
        givenFiles('.devcontainer/devcontainer.json', 'compose.yaml');

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('devcontainer-started');
        expect(composeUp).not.toHaveBeenCalled();
    });

    it('starts Compose services when there is only a Compose file', async () => {
        givenFiles('docker-compose.yml');

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('compose-started');
        expect(composeUp).toHaveBeenCalled();
        expect(getCliVersion).not.toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('Starting Docker Compose services from docker-compose.yml...');
        expect(logger.log).toHaveBeenCalledWith('Docker Compose services started.');
    });

    it('starts Compose services instead of the devcontainer inside a container', async () => {
        givenFiles('.devcontainer/devcontainer.json', 'compose.yml');
        isInsideContainer.mockReturnValue(true);

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('compose-started');
        expect(up).not.toHaveBeenCalled();
    });

    it('returns inside-container when there is only a devcontainer and it is inside one', async () => {
        givenFiles('.devcontainer/devcontainer.json');
        isInsideContainer.mockReturnValue(true);

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('inside-container');
        expect(logger.info).toHaveBeenCalledWith('Already running inside a container; skipping the devcontainer.');
        expect(up).not.toHaveBeenCalled();
    });

    it('returns docker-unavailable without a warning when Docker was skipped', async () => {
        givenFiles('compose.yaml');

        const result = await startDevEnvironment([REPORT[0]!], logger as unknown as Logger);

        expect(result).toBe('docker-unavailable');
        expect(logger.info).toHaveBeenCalledWith('Docker was skipped; skipping the dev environment.');
        expect(logger.warn).not.toHaveBeenCalled();
        expect(composeUp).not.toHaveBeenCalled();
    });

    it.each<ToolStatus>(['missing', 'outdated'])('warns and returns docker-unavailable when Docker is %s', async (status) => {
        givenFiles('compose.yaml');

        const result = await startDevEnvironment(reportWithDocker(status), logger as unknown as Logger);

        expect(result).toBe('docker-unavailable');
        expect(logger.warn).toHaveBeenCalledWith(
            `Docker is ${status}; the dev environment wasn't started. Install Docker, then run dev-setup init again.`);
        expect(composeUp).not.toHaveBeenCalled();
    });

    it('warns with install hints and returns cli-unavailable when the Dev Container CLI is missing', async () => {
        givenFiles('.devcontainer/devcontainer.json');
        getCliVersion.mockRejectedValue(new MissingDependencyError('Failed to run "devcontainer --version".'));

        const result = await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(result).toBe('cli-unavailable');
        expect(logger.debug).toHaveBeenCalledWith('Failed to run "devcontainer --version".');
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('npm install -g @devcontainers/cli'));
        expect(up).not.toHaveBeenCalled();
    });

    it('logs non-Error CLI failures as strings', async () => {
        givenFiles('.devcontainer/devcontainer.json');
        getCliVersion.mockRejectedValue('not found');

        await startDevEnvironment(REPORT, logger as unknown as Logger);

        expect(logger.debug).toHaveBeenCalledWith('not found');
    });

    it('propagates a DependencyError when the devcontainer fails to start', async () => {
        givenFiles('.devcontainer/devcontainer.json');
        const error = new DependencyError('"devcontainer up --workspace-folder ." exited with code 1.');
        up.mockRejectedValue(error);

        await expect(startDevEnvironment(REPORT, logger as unknown as Logger)).rejects.toThrow(DependencyError);
    });

    it('propagates a DependencyError when the Compose services fail to start', async () => {
        givenFiles('compose.yaml');
        composeUp.mockRejectedValue(new DependencyError('"docker compose up -d" exited with code 1.'));

        await expect(startDevEnvironment(REPORT, logger as unknown as Logger))
            .rejects.toThrow('"docker compose up -d" exited with code 1.');
    });

    it('propagates a FileSystemError when a configuration file cannot be checked', async () => {
        exists.mockRejectedValue(new FileSystemError('Failed to check whether ".devcontainer/devcontainer.json" exists.'));

        await expect(startDevEnvironment(REPORT, logger as unknown as Logger)).rejects.toThrow(FileSystemError);
    });
});
