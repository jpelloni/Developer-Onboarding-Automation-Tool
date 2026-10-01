import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { NODE_VERSION, PNPM_VERSION } from '../config/constants.js';
import { MissingDependencyError, VersionError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import { compareVersions } from '../utils/validation.js';

const execAsync = promisify(exec);

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Runs a tool's version command and verifies the reported version meets the minimum.
 *
 * @param label The tool's display name, used in log and error messages.
 * @param command The command that prints the tool's version (e.g. `node --version`).
 * @param requiredVersion The minimum acceptable version.
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When the version command can't be run.
 * @throws {VersionError} When the installed version is older than `requiredVersion`.
 */
const checkToolVersion = async (
    label: string,
    command: string,
    requiredVersion: string,
    logger: Logger,
): Promise<void> => {
    let version: string;
    try {
        const { stdout } = await execAsync(command);
        version = stdout.toString().trim();
    } catch (error) {
        throw new MissingDependencyError(`Failed to run "${command}". Is ${label} installed?`, toError(error));
    }

    logger.info(`${label} version: ${version}`);

    if (!compareVersions(version, requiredVersion)) {
        throw new VersionError(`${label} ${version} is older than the required ${requiredVersion}.`);
    }
};

/**
 * Checks that the installed Node.js meets {@link NODE_VERSION}.
 *
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When Node.js can't be run.
 * @throws {VersionError} When Node.js is older than the required version.
 */
const checkNodeVersion = (logger: Logger): Promise<void> =>
    checkToolVersion('Node', 'node --version', NODE_VERSION, logger);

/**
 * Checks that the installed pnpm meets {@link PNPM_VERSION}.
 *
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When pnpm can't be run.
 * @throws {VersionError} When pnpm is older than the required version.
 */
const checkPnpmVersion = (logger: Logger): Promise<void> =>
    checkToolVersion('pnpm', 'pnpm --version', PNPM_VERSION, logger);

/**
 * Adapter for the Node.js toolchain: verifies that Node.js and pnpm are installed and meet the
 * minimum versions in `src/config/constants.ts`.
 */
export const NodeAdapter = { checkNodeVersion, checkPnpmVersion };
