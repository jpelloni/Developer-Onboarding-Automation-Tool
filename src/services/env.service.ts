import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { ENV_EXAMPLE_FILE, ENV_FILE } from '../config/constants.js';
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
 * Service that manages the project's environment files, delegating file access to
 * `FileSystemAdapter`.
 */
export const EnvService = {
    generateEnvFile,
};
