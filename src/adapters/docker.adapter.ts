import { getToolVersion, runCommand } from '../utils/exec.js';

/**
 * Gets the installed Docker version by running `docker --version`.
 *
 * @returns The version, e.g. `27.3.1` from `Docker version 27.3.1, build ce12230`.
 * @throws {MissingDependencyError} When Docker can't be run.
 */
const getDockerVersion = (): Promise<string> => getToolVersion('Docker', 'docker --version');

/**
 * Starts the current directory's Docker Compose services in the background by running
 * `docker compose up -d`, streaming its output to the terminal.
 *
 * @throws {DependencyError} When `docker compose up -d` can't be run or fails.
 */
const composeUp = (): Promise<void> => runCommand('docker compose up -d');

/**
 * Adapter for Docker: reports the installed Docker version and starts Docker Compose services.
 */
export const DockerAdapter = { getDockerVersion, composeUp };
