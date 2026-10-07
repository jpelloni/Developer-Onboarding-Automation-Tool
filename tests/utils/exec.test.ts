import { MissingDependencyError } from '../../src/utils/errors.js';

const { jest } = import.meta;

type ExecCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

const execMock = jest.fn((_cmd: string, callback: ExecCallback) => {
    callback(null, { stdout: '', stderr: '' });
});

jest.unstable_mockModule('node:child_process', () => ({ exec: execMock }));

const { Exec, getToolVersion } = await import('../../src/utils/exec.js');

const stubExec = (stdout: string): void => {
    execMock.mockImplementation((_cmd: string, callback: ExecCallback) => {
        callback(null, { stdout, stderr: '' });
    });
};

beforeEach(() => {
    execMock.mockClear();
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

describe('Exec', () => {
    it('exposes getToolVersion', () => {
        expect(Exec.getToolVersion).toBe(getToolVersion);
    });
});
