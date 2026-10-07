import { Command } from "commander";
import { EnvService } from '../services/env.service.js';
import { Logger } from '../utils/logger.js';

/**
 * Builds the `env` command, which compares `.env` with `.env.example`.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options and
 * reports the variables that `.env` is missing or defines without a matching entry in
 * `.env.example`. It sets `process.exitCode` to `1` when variables are missing or either file
 * can't be read, so CI and scripts can fail on an outdated `.env`. Unused variables alone don't
 * fail the command. Errors are logged rather than thrown.
 *
 * @returns The `env` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createEnvCommand(): Command {
    return new Command('env')
        .description('Compare .env with .env.example and report missing or unused variables')
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            try {
                const { missing } = await EnvService.compareEnvFiles(logger);
                if (missing.length > 0) process.exitCode = 1;
            } catch (ex) {
                logger.error(ex instanceof Error ? ex : new Error(String(ex)));
                process.exitCode = 1;
            }
        });
}
