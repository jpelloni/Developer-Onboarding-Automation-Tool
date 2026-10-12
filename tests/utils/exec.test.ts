import { EventEmitter } from 'node:events';
import { DependencyError, MissingDependencyError } from '../../src/utils/errors.js';

const { jest } = import.meta;

type ExecCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

const execMock = jest.fn((_cmd: string, callback: ExecCallback) => {
    callback(null, { stdout: '', stderr: '' });
});

const spawnMock = jest.fn((_cmd: string, _options: object) => new EventEmitter());

jest.unstable_mockModule('node:child_process', () => ({ exec: execMock, spawn: spawnMock }));

const { Exec, getToolVersion, runCommand } = await import('../../src/utils/exec.js');

// Starts `runCommand` against a fake child process, then lets the test emit its events.
const startCommand = (command = 'pnpm install') => {
    const child = new EventEmitter();
    spawnMock.mockReturnValueOnce(child);
    return { child, result: runCommand(command) };
};

const stubExec = (stdout: string): void => {
    execMock.mockImplementation((_cmd: string, callback: ExecCallback) => {
        callback(null, { stdout, stderr: '' });
    });
};

beforeEach(() => {
    execMock.mockClear();
    spawnMock.mockClear();
});

describe('getToolVersion', () => {
    it('runs the given command', async () => {
        stubExec('v24.1.0\n');

        await getToolVersion('Node', 'node --version');

        expect(execMock).toHaveBeenCalledWith('node --version', expect.any(Function));
    });

    it('returns the version without the trailing newline', async () => {
        stubExec('v24.1.0\n');

        const result = await getToolVersion('Node', 'node --version');

        expect(result).toBe('v24.1.0');
    });

    it('extracts the version from descriptive output', async () => {
        stubExec('Docker version 27.3.1, build ce12230\n');

        const result = await getToolVersion('Docker', 'docker --version');

        expect(result).toBe('27.3.1');
    });

    it('throws a MissingDependencyError, keeping the cause, when the command fails', async () => {
        const cause = new Error('command not found: docker');
        execMock.mockImplementation((_cmd: string, callback: ExecCallback) => {
            callback(cause);
        });

        const error = await getToolVersion('Docker', 'docker --version').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(MissingDependencyError);
        expect((error as Error).message).toBe('Failed to run "docker --version". Is Docker installed?');
        expect((error as Error).cause).toBe(cause);
    });

    it('wraps non-Error failures in an Error cause', async () => {
        execMock.mockImplementation(() => {
            throw 'spawn failed';
        });

        const error = await getToolVersion('Docker', 'docker --version').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(MissingDependencyError);
        expect(((error as Error).cause as Error).message).toBe('spawn failed');
    });
});

describe('runCommand', () => {
    it('runs the command through the shell with inherited output', async () => {
        const { child, result } = startCommand();
        child.emit('close', 0, null);

        await expect(result).resolves.toBeUndefined();
        expect(spawnMock).toHaveBeenCalledWith('pnpm install', { shell: true, stdio: 'inherit' });
    });

    it('throws a DependencyError with the exit code when the command fails', async () => {
        const { child, result } = startCommand();
        child.emit('close', 1, null);

        const error = await result.catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DependencyError);
        expect((error as Error).message).toBe('"pnpm install" exited with code 1.');
    });

    it('throws a DependencyError naming the signal when the command is stopped', async () => {
        const { child, result } = startCommand();
        child.emit('close', null, 'SIGINT');

        await expect(result).rejects.toThrow(new DependencyError('"pnpm install" was stopped by SIGINT.'));
    });

    it('throws a DependencyError, keeping the cause, when the command cannot be started', async () => {
        const cause = new Error('spawn ENOENT');
        const { child, result } = startCommand();
        child.emit('error', cause);

        const error = await result.catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DependencyError);
        expect((error as Error).message).toBe('Failed to run "pnpm install".');
        expect((error as Error).cause).toBe(cause);
    });
});

describe('Exec', () => {
    it('exposes getToolVersion and runCommand', () => {
        expect(Exec.getToolVersion).toBe(getToolVersion);
        expect(Exec.runCommand).toBe(runCommand);
    });
});
