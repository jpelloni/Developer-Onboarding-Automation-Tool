import { Command } from "commander";
import { DependencyService } from '../services/dependency.service.js';
import { Logger } from '../utils/logger.js';

/**
 * Builds the `check` command, which reports whether the required tools are installed and up to
 * date.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options,
 * checks Node.js, pnpm, and Docker, and prints a table of each tool's minimum and installed
 * versions. Node.js and pnpm are always required; Docker is optional unless passed to
 * `--require`, and `--skip` leaves optional tools out. It sets `process.exitCode` to `1` when a
 * required tool is missing or outdated, or the options are invalid, so CI and scripts can fail
 * on an incompatible machine. Errors are logged rather than thrown.
 *
 * @returns The `check` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createCheckCommand(): Command {
    return new Command('check')
        .description('Report whether required tools are installed and meet the minimum versions')
        .option('--require <tools...>', 'treat optional tools as required (e.g. docker)')
        .option('--skip <tools...>', 'leave optional tools out of the check (e.g. docker)')
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            try {
                const report = await DependencyService.getCompatibilityReport(
                    { require: options['require'], skip: options['skip'] }, logger);
                logger.log(`Dependency report:\n${DependencyService.formatCompatibilityReport(report)}`);

                const failed = report.filter((entry) => entry.required && entry.status !== 'ok');
                if (failed.length > 0) {
                    const names = failed.map((entry) => `${entry.tool} (${entry.status})`).join(', ');
                    logger.log(`${failed.length} required tool(s) missing or outdated: ${names}`);
                    process.exitCode = 1;
                } else {
                    logger.log('All required tools are installed and up to date.');
                }
            } catch (ex) {
                logger.error(ex instanceof Error ? ex : new Error(String(ex)));
                process.exitCode = 1;
            }
        });
}
