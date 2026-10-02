import { NodeToolchainAdapter } from '../adapters/node-toolchain.adapter.js';
import type { Logger } from '../utils/logger.js';

/**
 * Checks each dependency concurrently and logs any failure, so one missing or outdated
 * dependency doesn't stop the others from being checked.
 *
 * `node` and `pnpm` are version-checked against the minimums in `src/config/constants.ts`.
 * Any other name is currently only logged.
 *
 * @param dependencies Names of the dependencies to check (e.g. `['node', 'pnpm']`).
 * @param logger Logger that receives the results and errors.
 */
async function checkDependencies(
    dependencies: string[],
    logger: Logger): Promise<void> {
    await Promise.all(dependencies.map(async (dependency) => {
        try {
            await checkDependency(dependency, logger);
        } catch (ex) {
            logger.error(ex instanceof Error ? ex : new Error(String(ex)));
        }
    }));
}

async function checkDependency(dependency: string, logger: Logger): Promise<void> {
    switch (dependency) {
        case 'node':
            await NodeToolchainAdapter.checkNodeVersion(logger);
            break;
        case 'pnpm':
            await NodeToolchainAdapter.checkPnpmVersion(logger);
            break;
        default:
            logger.info(`Dependency "${dependency}" is installed.`);
            break;
    }
}

/**
 * Service that verifies the developer's required tools are installed and up to date,
 * delegating the version checks to `NodeToolchainAdapter`.
 */
export const DependencyService = {
    checkDependencies,
};
