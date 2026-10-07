import { MissingDependencyError } from '../../src/utils/errors.js';

const { jest } = import.meta;

const getToolVersion = jest.fn<Promise<string>, [string, string]>();

jest.unstable_mockModule('../../src/utils/exec.js', () => ({ getToolVersion }));

const { DockerAdapter } = await import('../../src/adapters/docker.adapter.js');

beforeEach(() => {
    getToolVersion.mockReset().mockResolvedValue('27.3.1');
});

describe('DockerAdapter', () => {
    describe('getDockerVersion', () => {
        it('runs `docker --version`', async () => {
            await DockerAdapter.getDockerVersion();

            expect(getToolVersion).toHaveBeenCalledWith('Docker', 'docker --version');
        });

        it('returns the installed version', async () => {
            const result = await DockerAdapter.getDockerVersion();

            expect(result).toBe('27.3.1');
        });

        it('propagates a MissingDependencyError when Docker cannot be run', async () => {
            const error = new MissingDependencyError('Failed to run "docker --version". Is Docker installed?');
            getToolVersion.mockRejectedValue(error);

            await expect(DockerAdapter.getDockerVersion()).rejects.toBe(error);
        });
    });
});
