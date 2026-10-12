import { EventEmitter } from 'node:events';
import { MissingDependencyError } from '../../src/utils/errors.js';

const { jest } = import.meta;

type ExecCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

const execMock = jest.fn((_cmd: string, callback: ExecCallback) => {
    callback(null, { stdout: '', stderr: '' });
});

const spawnMock = jest.fn((_cmd: string, _options: object) => {
    const child = new EventEmitter();
    setImmediate(() => child.emit('close', 0, null));
    return child;
});

jest.unstable_mockModule('node:child_process', () => ({ exec: execMock, spawn: spawnMock }));

const { NodeToolchainAdapter } = await import('../../src/adapters/node-toolchain.adapter.js');

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

beforeEach(() => {
    execMock.mockClear();
    spawnMock.mockClear();
});

describe('NodeToolchainAdapter', () => {
    describe('getNodeVersion', () => {
        it('runs `node --version` and returns the trimmed version', async () => {
            stubExec('v24.1.0\n');

            const result = await NodeToolchainAdapter.getNodeVersion();

            expect(execMock).toHaveBeenCalledWith('node --version', expect.any(Function));
            expect(result).toBe('v24.1.0');
        });

        it('throws a MissingDependencyError when node cannot be run', async () => {
            failExec(new Error('command not found: node'));

            await expect(NodeToolchainAdapter.getNodeVersion()).rejects.toThrow(MissingDependencyError);
        });
    });

    describe('getPnpmVersion', () => {
        it('runs `pnpm --version` and returns the trimmed version', async () => {
            stubExec('12.6.0\n');

            const result = await NodeToolchainAdapter.getPnpmVersion();

            expect(execMock).toHaveBeenCalledWith('pnpm --version', expect.any(Function));
            expect(result).toBe('12.6.0');
        });
    });

    describe('installDependencies', () => {
        it('runs `pnpm install`', async () => {
            await NodeToolchainAdapter.installDependencies();

            expect(spawnMock).toHaveBeenCalledWith('pnpm install', { shell: true, stdio: 'inherit' });
        });
    });
});
