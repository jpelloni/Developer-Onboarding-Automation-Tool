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
 * Runs one of the current directory's `package.json` scripts by running `pnpm run <script>`,
 * streaming its output to the terminal.
 *
 * @param script Name of the script to run (e.g. `test`).
 * @throws {DependencyError} When `pnpm run` can't be run, or the script fails.
 */
const runScript = (script: string): Promise<void> => runCommand(`pnpm run ${script}`);

/**
 * Adapter for the Node.js toolchain: reports the installed Node.js and pnpm versions, installs
 * project dependencies, and runs `package.json` scripts with pnpm.
 */
export const NodeToolchainAdapter = { getNodeVersion, getPnpmVersion, installDependencies, runScript };
