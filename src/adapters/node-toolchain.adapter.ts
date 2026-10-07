import { NODE_VERSION, PNPM_VERSION } from '../config/constants.js';
import { VersionError } from '../utils/errors.js';
import { getToolVersion } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import { compareVersions } from '../utils/validation.js';

/**
 * Gets a tool's version and verifies it meets the minimum.
 *
 * @param label The tool's display name, used in log and error messages.
 * @param getVersion Returns the installed version.
 * @param requiredVersion The minimum acceptable version.
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When the version command can't be run.
 * @throws {VersionError} When the installed version is older than `requiredVersion`.
 */
const checkToolVersion = async (
    label: string,
    getVersion: () => Promise<string>,
    requiredVersion: string,
    logger: Logger,
): Promise<void> => {
    const version = await getVersion();

    logger.info(`${label} version: ${version}`);

    if (!compareVersions(version, requiredVersion)) {
        throw new VersionError(`${label} ${version} is older than the required ${requiredVersion}.`);
    }
};

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
 * Checks that the installed Node.js meets {@link NODE_VERSION}.
 *
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When Node.js can't be run.
 * @throws {VersionError} When Node.js is older than the required version.
 */
const checkNodeVersion = (logger: Logger): Promise<void> =>
    checkToolVersion('Node', getNodeVersion, NODE_VERSION, logger);

/**
 * Checks that the installed pnpm meets {@link PNPM_VERSION}.
 *
 * @param logger Logger that receives the detected version.
 * @throws {MissingDependencyError} When pnpm can't be run.
 * @throws {VersionError} When pnpm is older than the required version.
 */
const checkPnpmVersion = (logger: Logger): Promise<void> =>
    checkToolVersion('pnpm', getPnpmVersion, PNPM_VERSION, logger);

/**
 * Adapter for the Node.js toolchain: reports the installed Node.js and pnpm versions and
 * verifies they meet the minimum versions in `src/config/constants.ts`.
 */
export const NodeToolchainAdapter = { getNodeVersion, getPnpmVersion, checkNodeVersion, checkPnpmVersion };
