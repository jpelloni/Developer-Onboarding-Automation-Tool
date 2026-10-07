import { getToolVersion } from '../utils/exec.js';

/**
 * Gets the installed Node.js version by running `node --version`.
 *
 * @returns The version, e.g. `v24.1.0`.
 * @throws {MissingDependencyError} When Node.js can't be run.
 */
const getNodeVersion = (): Promise<string> => getToolVersion('Node', 'node --version');

/**
 * Gets the installed pnpm version by running `pnpm --version`.
 *
 * @returns The version, e.g. `12.6.0`.
 * @throws {MissingDependencyError} When pnpm can't be run.
 */
const getPnpmVersion = (): Promise<string> => getToolVersion('pnpm', 'pnpm --version');

/**
 * Adapter for the Node.js toolchain: reports the installed Node.js and pnpm versions.
 */
export const NodeToolchainAdapter = { getNodeVersion, getPnpmVersion };
