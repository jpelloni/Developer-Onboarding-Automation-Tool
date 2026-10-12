import { getToolVersion, runCommand } from '../utils/exec.js';

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
 * Installs the current directory's project dependencies by running `pnpm install`, streaming its
 * output to the terminal.
 *
 * @throws {DependencyError} When `pnpm install` can't be run or fails.
 */
const installDependencies = (): Promise<void> => runCommand('pnpm install');

/**
 * Adapter for the Node.js toolchain: reports the installed Node.js and pnpm versions and installs
 * project dependencies with pnpm.
 */
export const NodeToolchainAdapter = { getNodeVersion, getPnpmVersion, installDependencies };
