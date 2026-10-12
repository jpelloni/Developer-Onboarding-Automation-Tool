import { existsSync } from 'node:fs';
import { getToolVersion, runCommand } from '../utils/exec.js';

/**
 * Gets the installed Dev Container CLI version by running `devcontainer --version`.
 *
 * @returns The version, e.g. `0.72.0`.
 * @throws {MissingDependencyError} When the Dev Container CLI can't be run.
 */
const getCliVersion = (): Promise<string> => getToolVersion('the Dev Container CLI', 'devcontainer --version');

/**
 * Builds (if needed) and starts the current directory's devcontainer by running
 * `devcontainer up --workspace-folder .`, streaming its output to the terminal.
 *
 * @throws {DependencyError} When `devcontainer up` can't be run or fails.
 */
const up = (): Promise<void> => runCommand('devcontainer up --workspace-folder .');

/**
 * Checks whether `dev-setup` is running inside a container: a VS Code devcontainer
 * (`REMOTE_CONTAINERS`), a GitHub Codespace (`CODESPACES`), or any Docker container (`/.dockerenv`).
 *
 * @returns `true` when running inside a container; otherwise `false`.
 */
const isInsideContainer = (): boolean =>
    process.env['REMOTE_CONTAINERS'] === 'true'
    || process.env['CODESPACES'] === 'true'
    || existsSync('/.dockerenv');

/**
 * Adapter for devcontainers: reports the Dev Container CLI version, starts the devcontainer, and
 * detects whether `dev-setup` is already running inside a container.
 */
export const DevcontainerAdapter = { getCliVersion, up, isInsideContainer };
