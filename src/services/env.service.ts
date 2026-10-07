import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { ENV_EXAMPLE_FILE, ENV_FILE } from '../config/constants.js';
import { EnvFile } from '../utils/env-file.js';
import { FileSystemError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';

/**
 * Outcome of {@link EnvService.generateEnvFile}:
 *
 * - `created`: `.env` was copied from `.env.example`.
 * - `exists`: `.env` already existed and was left unchanged.
 * - `no-template`: there is no `.env.example` to copy.
 */
export type EnvFileResult = 'created' | 'exists' | 'no-template';

/**
 * Creates `.env` in the current directory by copying `.env.example`. An existing `.env` is never
 * overwritten.
 *
 * Logs `created` so it always prints, and the other outcomes as `info` (verbose mode only).
 *
 * @param logger Logger that receives the outcome.
 * @returns What happened; see {@link EnvFileResult}.
 * @throws {FileSystemError} When `.env.example` can't be checked or copied.
 */
async function generateEnvFile(logger: Logger): Promise<EnvFileResult> {
    if (!await FileSystemAdapter.exists(ENV_EXAMPLE_FILE)) {
        logger.info(`No ${ENV_EXAMPLE_FILE} found; skipping ${ENV_FILE} generation.`);
        return 'no-template';
    }

    if (!await FileSystemAdapter.copyFileIfAbsent(ENV_EXAMPLE_FILE, ENV_FILE)) {
        logger.info(`${ENV_FILE} already exists; leaving it unchanged.`);
        return 'exists';
    }

    logger.log(`Created ${ENV_FILE} from ${ENV_EXAMPLE_FILE}.`);
    return 'created';
}

/**
 * Result of {@link EnvService.compareEnvFiles}. Both lists keep the order the keys appear in
 * their file.
 */
export interface EnvComparison {
    /** Keys defined in `.env.example` but not in `.env`. */
    missing: string[];
    /** Keys defined in `.env` but not in `.env.example`. */
    unused: string[];
}

/**
 * Compares the variables defined in `.env` with those in `.env.example` and logs the
 * differences. Only the keys are compared; values are never read or logged.
 *
 * Logs (always printed) the missing and unused keys, or that the files are in sync, plus an
 * `info` line (verbose mode only) with how many keys each file defines.
 *
 * @param logger Logger that receives the report.
 * @returns The missing and unused keys; see {@link EnvComparison}.
 * @throws {FileSystemError} When `.env.example` or `.env` doesn't exist or can't be read.
 */
async function compareEnvFiles(logger: Logger): Promise<EnvComparison> {
    if (!await FileSystemAdapter.exists(ENV_EXAMPLE_FILE)) {
        throw new FileSystemError(`No ${ENV_EXAMPLE_FILE} found; nothing to compare ${ENV_FILE} against.`);
    }
    if (!await FileSystemAdapter.exists(ENV_FILE)) {
        throw new FileSystemError(`No ${ENV_FILE} found. Run \`dev-setup init\` to create it from ${ENV_EXAMPLE_FILE}.`);
    }

    const [exampleKeys, envKeys] = await Promise.all([
        FileSystemAdapter.readTextFile(ENV_EXAMPLE_FILE).then(EnvFile.parseEnvKeys),
        FileSystemAdapter.readTextFile(ENV_FILE).then(EnvFile.parseEnvKeys),
    ]);
    logger.info(`${ENV_EXAMPLE_FILE} defines ${exampleKeys.length} variable(s); ${ENV_FILE} defines ${envKeys.length}.`);

    const missing = exampleKeys.filter((key) => !envKeys.includes(key));
    const unused = envKeys.filter((key) => !exampleKeys.includes(key));

    if (missing.length > 0) {
        logger.log(`${ENV_FILE} is missing ${missing.length} variable(s) defined in ${ENV_EXAMPLE_FILE}: ${missing.join(', ')}`);
    }
    if (unused.length > 0) {
        logger.log(`${ENV_FILE} has ${unused.length} variable(s) not defined in ${ENV_EXAMPLE_FILE}: ${unused.join(', ')}`);
    }
    if (missing.length === 0 && unused.length === 0) {
        logger.log(`${ENV_FILE} is in sync with ${ENV_EXAMPLE_FILE}.`);
    }

    return { missing, unused };
}

/**
 * Service that manages the project's environment files, delegating file access to
 * `FileSystemAdapter`.
 */
export const EnvService = {
    generateEnvFile,
    compareEnvFiles,
};
