import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { DependencyError, MissingDependencyError } from './errors.js';
import { extractVersion } from './validation.js';

const execAsync = promisify(exec);

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Runs a tool's version command and returns the version it reports.
 *
 * The version is taken from the command's output with {@link extractVersion}, so output such as
 * `Docker version 27.3.1, build ce12230` yields `27.3.1`, and `v24.1.0` is returned unchanged.
 *
 * @param label The tool's display name, used in the error message.
 * @param command The command that prints the tool's version (e.g. `node --version`).
 * @returns The reported version.
 * @throws {MissingDependencyError} When the command can't be run.
 */
export const getToolVersion = async (label: string, command: string): Promise<string> => {
    let stdout: string | Buffer;
    try {
        ({ stdout } = await execAsync(command));
    } catch (error) {
        throw new MissingDependencyError(`Failed to run "${command}". Is ${label} installed?`, toError(error));
    }

    return extractVersion(stdout.toString());
};

/**
 * Runs a shell command in the current directory, streaming its output to the terminal.
 *
 * The command runs through the shell so tools installed as scripts (such as `pnpm.cmd` on
 * Windows) are found.
 *
 * @param command The command to run (e.g. `pnpm install`).
 * @throws {DependencyError} When the command can't be started, or exits with a non-zero code or
 * because of a signal.
 */
export const runCommand = (command: string): Promise<void> => new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' });
    child.on('error', (error) => {
        reject(new DependencyError(`Failed to run "${command}".`, error));
    });
    child.on('close', (code, signal) => {
        if (code === 0) {
            resolve();
            return;
        }
        const reason = signal ? `was stopped by ${signal}` : `exited with code ${code}`;
        reject(new DependencyError(`"${command}" ${reason}.`));
    });
});

/** Shell-execution helpers, grouped for namespaced imports. */
export const Exec = {
    getToolVersion,
    runCommand,
};
