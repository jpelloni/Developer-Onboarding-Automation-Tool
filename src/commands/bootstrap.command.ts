import { Command } from "commander";
import { ProjectBootstrapService } from '../services/project-bootstrap.service.js';
import { Logger } from '../utils/logger.js';

/**
 * Builds the `bootstrap` command, which creates a new Node.js + TypeScript + pnpm project from
 * the project template.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options and
 * creates the project in `./<name>`, or with `--dry-run` lists the files it would create. It
 * sets `process.exitCode` to `1` when the name is invalid, the directory isn't empty, or a file
 * can't be written. Errors are logged rather than thrown.
 *
 * @returns The `bootstrap` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createBootstrapCommand(): Command {
    return new Command('bootstrap')
        .description('Create a new Node.js + TypeScript + pnpm project from the project template')
        .argument('<name>', 'project name, used as the directory and package name')
        .option('--dry-run', 'list the files that would be created without writing them')
        .action(async (name: string, _options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            try {
                await ProjectBootstrapService.bootstrapProject(name, { dryRun: options['dryRun'] === true }, logger);
            } catch (ex) {
                logger.error(ex instanceof Error ? ex : new Error(String(ex)));
                process.exitCode = 1;
            }
        });
}
