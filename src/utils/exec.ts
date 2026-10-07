import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { MissingDependencyError } from './errors.js';
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

/** Shell-execution helpers, grouped for namespaced imports. */
export const Exec = {
    getToolVersion,
};
