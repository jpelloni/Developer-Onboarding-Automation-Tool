import { getToolVersion } from '../utils/exec.js';

/**
 * Gets the installed Docker version by running `docker --version`.
 *
 * @returns The version, e.g. `27.3.1` from `Docker version 27.3.1, build ce12230`.
 * @throws {MissingDependencyError} When Docker can't be run.
 */
const getDockerVersion = (): Promise<string> => getToolVersion('Docker', 'docker --version');

/**
 * Adapter for Docker: reports the installed Docker version.
 */
export const DockerAdapter = { getDockerVersion };
