import { NODE_VERSION, PNPM_VERSION } from '../config/constants.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { MissingDependencyError } from '../utils/errors.util.js';
import { Logger } from '../utils/logger.util.js';

export async function checkDependencies(
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
    try {
        switch (dependency) {
            case 'node':
                await checkNodeVersion(logger);
                break;
            case 'pnpm':
                await checkPnpmVersion(logger);
                break;
            default:
                logger.info(`Dependency "${dependency}" is installed.`);
                break;
        }
    } catch (e) {
        throw new MissingDependencyError(`Dependency "${dependency}" is not installed.`, e instanceof Error ? e : undefined);
    }
}

const checkNodeVersion = async (logger: Logger): Promise<void> => { // TODO: Move to Node Adapter
    try {
        const { stdout } = await promisify(exec)('node --version');
        const output = stdout.toString().trim();
        logger.info(`Node version: ${output}`);
        compareVersions(output, NODE_VERSION);
    } catch (error) {
        throw new MissingDependencyError('Failed to check Node version', error instanceof Error ? error : undefined);
    }
};

// TODO: Move to Node Adapter
const checkPnpmVersion = async (logger: Logger): Promise<void> => {
    try {
        const { stdout } = await promisify(exec)('pnpm --version');
        const output = stdout.toString().trim();
        logger.info(`pnpm version: ${output}`);
        compareVersions(output, PNPM_VERSION);
    } catch (error) {
        throw new MissingDependencyError('Failed to check pnpm version', error instanceof Error ? error : undefined);
    }
};

// TODO: Move to Exec utils


