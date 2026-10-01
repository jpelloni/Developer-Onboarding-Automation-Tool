import { NODE_VERSION, PNPM_VERSION } from '../../src/config/constants.js';
import { MissingDependencyError, VersionError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

type ExecCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

const execMock = jest.fn((_cmd: string, callback: ExecCallback) => {
    callback(null, { stdout: '', stderr: '' });
});

jest.unstable_mockModule('node:child_process', () => ({ exec: execMock }));

const { NodeAdapter } = await import('../../src/adapters/node.adapter.js');

const stubExec = (stdout: string): void => {
    execMock.mockImplementation((_cmd: string, callback: ExecCallback) => {
        callback(null, { stdout, stderr: '' });
    });
};

const failExec = (error: Error): void => {
    execMock.mockImplementation((_cmd: string, callback: ExecCallback) => {
        callback(error);
    });
};

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
}) as unknown as Logger & { info: jest.Mock };

beforeEach(() => {
    execMock.mockClear();
});

describe('NodeAdapter', () => {
    describe('checkNodeVersion', () => {
        it('runs `node --version`', async () => {
            stubExec(`${NODE_VERSION}\n`);

            await NodeAdapter.checkNodeVersion(createLogger());

            expect(execMock).toHaveBeenCalledWith('node --version', expect.any(Function));
        });

        it('logs the trimmed version when it meets the minimum', async () => {
            const logger = createLogger();
            stubExec(`${NODE_VERSION}\n`);

            await NodeAdapter.checkNodeVersion(logger);

            expect(logger.info).toHaveBeenCalledWith(`Node version: ${NODE_VERSION}`);
        });

        it('resolves when the installed version is newer than the minimum', async () => {
            stubExec('v999.0.0\n');

            await expect(NodeAdapter.checkNodeVersion(createLogger())).resolves.toBeUndefined();
        });

        it('throws a VersionError when the installed version is older than the minimum', async () => {
            stubExec('v1.0.0\n');

            await expect(NodeAdapter.checkNodeVersion(createLogger())).rejects.toThrow(
                new VersionError(`Node v1.0.0 is older than the required ${NODE_VERSION}.`),
            );
        });

        it('throws a MissingDependencyError, keeping the cause, when node cannot be run', async () => {
            const cause = new Error('command not found: node');
            failExec(cause);

            const error = await NodeAdapter.checkNodeVersion(createLogger()).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(MissingDependencyError);
            expect((error as Error).message).toBe('Failed to run "node --version". Is Node installed?');
            expect((error as Error).cause).toBe(cause);
        });

        it('wraps non-Error failures in an Error cause', async () => {
            execMock.mockImplementation(() => {
                throw 'spawn failed';
            });

            const error = await NodeAdapter.checkNodeVersion(createLogger()).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(MissingDependencyError);
            expect(((error as Error).cause as Error).message).toBe('spawn failed');
        });
    });

    describe('checkPnpmVersion', () => {
        it('runs `pnpm --version` and logs the version when it meets the minimum', async () => {
            const logger = createLogger();
            stubExec(`${PNPM_VERSION}\n`);

            await NodeAdapter.checkPnpmVersion(logger);

            expect(execMock).toHaveBeenCalledWith('pnpm --version', expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith(`pnpm version: ${PNPM_VERSION}`);
        });

        it('throws a VersionError when the installed version is older than the minimum', async () => {
            stubExec('1.0.0\n');

            await expect(NodeAdapter.checkPnpmVersion(createLogger())).rejects.toThrow(
                new VersionError(`pnpm 1.0.0 is older than the required ${PNPM_VERSION}.`),
            );
        });

        it('throws a MissingDependencyError when pnpm cannot be run', async () => {
            failExec(new Error('command not found: pnpm'));

            await expect(NodeAdapter.checkPnpmVersion(createLogger())).rejects.toThrow(MissingDependencyError);
        });
    });
});
