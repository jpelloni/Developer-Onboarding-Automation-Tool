import type { ToolReport, ToolStatus } from '../../src/services/dependency.service.js';
import { DependencyError, FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const exists = jest.fn<Promise<boolean>, [string]>();
const readTextFile = jest.fn<Promise<string>, [string]>();
const runScript = jest.fn<Promise<void>, [string]>();
const devcontainerExec = jest.fn<Promise<void>, [string]>();

jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { exists, readTextFile },
}));
jest.unstable_mockModule('../../src/adapters/node-toolchain.adapter.js', () => ({
    NodeToolchainAdapter: { runScript },
}));
jest.unstable_mockModule('../../src/adapters/devcontainer.adapter.js', () => ({
    DevcontainerAdapter: { exec: devcontainerExec },
}));

const { ProjectChecksService: { runProjectChecks } } = await import('../../src/services/project-checks.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

const reportWithPnpm = (status: ToolStatus): ToolReport[] => [
    { tool: 'pnpm', required: true, minimumVersion: '12.0.0', installedVersion: status === 'missing' ? null : '12.6.0', status },
];

const REPORT = reportWithPnpm('ok');

const givenManifest = (manifest: unknown): void => {
    readTextFile.mockResolvedValue(JSON.stringify(manifest));
};

let logger: ReturnType<typeof createLogger>;

beforeEach(() => {
    logger = createLogger();
    exists.mockReset().mockResolvedValue(true);
    readTextFile.mockReset();
    givenManifest({ scripts: { build: 'tsc', lint: 'eslint src', test: 'jest' } });
    runScript.mockReset().mockResolvedValue(undefined);
    devcontainerExec.mockReset().mockResolvedValue(undefined);
});

describe('runProjectChecks', () => {
    it('runs lint, then test, and reports both as passed', async () => {
        const result = await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(runScript.mock.calls).toEqual([['lint'], ['test']]);
        expect(result).toEqual({ status: 'ran', passed: ['lint', 'test'], failed: [] });
        expect(readTextFile).toHaveBeenCalledWith('package.json');
        expect(logger.log).toHaveBeenCalledWith('Running pnpm run lint...');
        expect(logger.log).toHaveBeenCalledWith('pnpm run test passed.');
    });

    it('runs only the check scripts the manifest defines', async () => {
        givenManifest({ scripts: { test: 'jest' } });

        const result = await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(runScript.mock.calls).toEqual([['test']]);
        expect(result).toEqual({ status: 'ran', passed: ['test'], failed: [] });
    });

    it('keeps running scripts after one fails and logs the failure', async () => {
        const error = new DependencyError('"pnpm run lint" exited with code 1.');
        runScript.mockRejectedValueOnce(error);

        const result = await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(runScript).toHaveBeenCalledWith('test');
        expect(logger.error).toHaveBeenCalledWith(error);
        expect(result).toEqual({ status: 'ran', passed: ['test'], failed: ['lint'] });
    });

    it('wraps non-Error script failures in an Error before logging', async () => {
        runScript.mockRejectedValueOnce('boom');

        await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(logger.error).toHaveBeenCalledWith(new Error('boom'));
    });

    it('returns no-manifest when there is no package.json', async () => {
        exists.mockResolvedValue(false);

        const result = await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(result).toEqual({ status: 'no-manifest' });
        expect(exists).toHaveBeenCalledWith('package.json');
        expect(logger.info).toHaveBeenCalledWith('No package.json found; skipping the project checks.');
        expect(runScript).not.toHaveBeenCalled();
    });

    it.each([
        ['no check scripts', { scripts: { build: 'tsc' } }],
        ['no scripts field', { name: 'app' }],
        ['a non-object scripts field', { scripts: 'jest' }],
        ['a null manifest', null],
    ])('returns no-scripts when the manifest has %s', async (_label, manifest) => {
        givenManifest(manifest);

        const result = await runProjectChecks(REPORT, logger as unknown as Logger);

        expect(result).toEqual({ status: 'no-scripts' });
        expect(logger.info).toHaveBeenCalledWith('package.json has no lint or test script; skipping the project checks.');
        expect(runScript).not.toHaveBeenCalled();
    });

    it.each<ToolStatus>(['missing', 'outdated'])('returns pnpm-unavailable when pnpm is %s', async (status) => {
        const result = await runProjectChecks(reportWithPnpm(status), logger as unknown as Logger);

        expect(result).toEqual({ status: 'pnpm-unavailable' });
        expect(logger.info).toHaveBeenCalledWith('pnpm is missing or outdated; skipping the project checks.');
        expect(runScript).not.toHaveBeenCalled();
    });

    it('throws a DependencyError when package.json is not valid JSON', async () => {
        readTextFile.mockResolvedValue('{ not json');

        const result = runProjectChecks(REPORT, logger as unknown as Logger);

        await expect(result).rejects.toThrow(DependencyError);
        await expect(result).rejects.toThrow('Failed to parse package.json.');
    });

    it('propagates a FileSystemError when package.json cannot be read', async () => {
        readTextFile.mockRejectedValue(new FileSystemError('Failed to read "package.json".'));

        await expect(runProjectChecks(REPORT, logger as unknown as Logger)).rejects.toThrow(FileSystemError);
    });

    describe('in the devcontainer', () => {
        it('runs the scripts inside the container without needing pnpm in the report', async () => {
            const result = await runProjectChecks([], logger as unknown as Logger, 'devcontainer');

            expect(devcontainerExec.mock.calls).toEqual([['pnpm run lint'], ['pnpm run test']]);
            expect(runScript).not.toHaveBeenCalled();
            expect(result).toEqual({ status: 'ran', passed: ['lint', 'test'], failed: [] });
            expect(logger.log).toHaveBeenCalledWith('Running pnpm run lint in the devcontainer...');
            expect(logger.log).toHaveBeenCalledWith('pnpm run test passed.');
        });

        it('keeps running scripts after one fails in the container', async () => {
            const error = new DependencyError('"devcontainer exec --workspace-folder . pnpm run lint" exited with code 1.');
            devcontainerExec.mockRejectedValueOnce(error);

            const result = await runProjectChecks([], logger as unknown as Logger, 'devcontainer');

            expect(logger.error).toHaveBeenCalledWith(error);
            expect(result).toEqual({ status: 'ran', passed: ['test'], failed: ['lint'] });
        });
    });
});
