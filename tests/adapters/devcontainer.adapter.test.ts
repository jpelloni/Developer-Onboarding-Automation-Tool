import { DependencyError, MissingDependencyError } from '../../src/utils/errors.js';

const { jest } = import.meta;

const getToolVersion = jest.fn<Promise<string>, [string, string]>();
const runCommand = jest.fn<Promise<void>, [string]>();
const existsSync = jest.fn<boolean, [string]>();

jest.unstable_mockModule('../../src/utils/exec.js', () => ({ getToolVersion, runCommand }));
jest.unstable_mockModule('node:fs', () => ({ existsSync }));

const { DevcontainerAdapter } = await import('../../src/adapters/devcontainer.adapter.js');

const originalEnv = { ...process.env };

beforeEach(() => {
    getToolVersion.mockReset().mockResolvedValue('0.72.0');
    runCommand.mockReset().mockResolvedValue(undefined);
    existsSync.mockReset().mockReturnValue(false);
    delete process.env['REMOTE_CONTAINERS'];
    delete process.env['CODESPACES'];
});

afterAll(() => {
    process.env = originalEnv;
});

describe('DevcontainerAdapter', () => {
    describe('getCliVersion', () => {
        it('runs `devcontainer --version` and returns the version', async () => {
            const result = await DevcontainerAdapter.getCliVersion();

            expect(getToolVersion).toHaveBeenCalledWith('the Dev Container CLI', 'devcontainer --version');
            expect(result).toBe('0.72.0');
        });

        it('propagates a MissingDependencyError when the CLI cannot be run', async () => {
            const error = new MissingDependencyError('Failed to run "devcontainer --version".');
            getToolVersion.mockRejectedValue(error);

            await expect(DevcontainerAdapter.getCliVersion()).rejects.toBe(error);
        });
    });

    describe('up', () => {
        it('runs `devcontainer up` for the current directory', async () => {
            await DevcontainerAdapter.up();

            expect(runCommand).toHaveBeenCalledWith('devcontainer up --workspace-folder .');
        });

        it('propagates a DependencyError when the devcontainer fails to start', async () => {
            const error = new DependencyError('"devcontainer up --workspace-folder ." exited with code 1.');
            runCommand.mockRejectedValue(error);

            await expect(DevcontainerAdapter.up()).rejects.toBe(error);
        });
    });

    describe('isInsideContainer', () => {
        it('returns false outside a container', () => {
            expect(DevcontainerAdapter.isInsideContainer()).toBe(false);
            expect(existsSync).toHaveBeenCalledWith('/.dockerenv');
        });

        it.each(['REMOTE_CONTAINERS', 'CODESPACES'])('returns true when %s is "true"', (name) => {
            process.env[name] = 'true';

            expect(DevcontainerAdapter.isInsideContainer()).toBe(true);
        });

        it('returns true when /.dockerenv exists', () => {
            existsSync.mockReturnValue(true);

            expect(DevcontainerAdapter.isInsideContainer()).toBe(true);
        });
    });
});
