import { Command } from "commander";
import { DependencyService, type ToolReport } from '../services/dependency.service.js';
import { EnvService } from '../services/env.service.js';
import { Logger } from '../utils/logger.js';

const toError = (ex: unknown): Error => (ex instanceof Error ? ex : new Error(String(ex)));

/**
 * Builds the `init` command, which runs the developer onboarding setup.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options, then:
 *
 * 1. Prints the same tool compatibility report as `dev-setup check`. `--require` and `--skip`
 *    work as they do for `check`.
 * 2. Installs the project's dependencies with `pnpm install`, unless `--no-install` is passed.
 *    The install is skipped when there's no `package.json`, pnpm is missing or outdated, or the
 *    tool check failed.
 * 3. Creates `.env` from `.env.example` if `.env` doesn't exist yet.
 * 4. If `.env` already existed, compares it with `.env.example` as `dev-setup env` does.
 * 5. Prints a summary of the problems found, or that setup is complete.
 *
 * Each step runs even if an earlier one fails; errors are logged rather than thrown. It sets
 * `process.exitCode` to `1` when a required tool is missing or outdated, the install fails,
 * `.env` is missing variables, or a step fails.
 *
 * @returns The `init` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createInitCommand(): Command {
    return new Command('init')
        .description('Run the developer onboarding setup: check tools, install dependencies, then create and check .env')
        .option('--require <tools...>', 'treat optional tools as required (e.g. docker)')
        .option('--skip <tools...>', 'leave optional tools out of the check (e.g. docker)')
        .option('--no-install', "don't install the project's dependencies")
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            const problems: string[] = [];
            let report: ToolReport[] | undefined;

            try {
                report = await DependencyService.getCompatibilityReport(
                    { require: options['require'], skip: options['skip'] }, logger);
                logger.log(`Dependency report:\n${DependencyService.formatCompatibilityReport(report)}`);
                const failures = DependencyService.summarizeRequiredFailures(report);
                if (failures) problems.push(failures);
            } catch (ex) {
                logger.error(toError(ex));
                problems.push('The tool check failed.');
            }

            if (!options['install']) {
                logger.info('Skipping dependency installation (--no-install).');
            } else if (!report) {
                logger.info('Skipping dependency installation because the tool check failed.');
            } else {
                try {
                    await DependencyService.installProjectDependencies(report, logger);
                } catch (ex) {
                    logger.error(toError(ex));
                    problems.push('Installing dependencies failed.');
                }
            }

            try {
                if (await EnvService.generateEnvFile(logger) === 'exists') {
                    const { missing } = await EnvService.compareEnvFiles(logger);
                    if (missing.length > 0) problems.push(`.env is missing ${missing.length} variable(s).`);
                }
            } catch (ex) {
                logger.error(toError(ex));
                problems.push('Setting up .env failed.');
            }

            if (problems.length > 0) {
                logger.log(`Setup finished with ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
                process.exitCode = 1;
            } else {
                logger.log('Setup complete.');
            }
        });
}
