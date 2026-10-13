import { Command } from "commander";
import { DependencyService, type ToolReport } from '../services/dependency.service.js';
import { DevcontainerService } from '../services/devcontainer.service.js';
import { EnvService } from '../services/env.service.js';
import { ProjectChecksService } from '../services/project-checks.service.js';
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
 * 5. Starts the development environment (the devcontainer, or Docker Compose services), unless
 *    `--no-start` is passed. The start is skipped when the tool check failed; see
 *    {@link DevcontainerService.startDevEnvironment} for when else nothing is started.
 * 6. Runs the project's `lint` and `test` scripts, unless `--no-checks` is passed. The checks
 *    are skipped when the tool check or the install failed; see
 *    {@link ProjectChecksService.runProjectChecks} for when else they're skipped.
 * 7. Prints a summary of the problems found, or that setup is complete.
 *
 * Each step runs even if an earlier one fails; errors are logged rather than thrown. It sets
 * `process.exitCode` to `1` when a required tool is missing or outdated, the install fails,
 * `.env` is missing variables, the dev environment fails to start, a project check fails, or a
 * step fails.
 *
 * @returns The `init` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createInitCommand(): Command {
    return new Command('init')
        .description('Run the developer onboarding setup: check tools, install dependencies, create and check .env, start the dev environment, then run the project checks')
        .option('--require <tools...>', 'treat optional tools as required (e.g. docker)')
        .option('--skip <tools...>', 'leave optional tools out of the check (e.g. docker)')
        .option('--no-install', "don't install the project's dependencies")
        .option('--no-start', "don't start the devcontainer or Docker Compose services")
        .option('--no-checks', "don't run the project's lint and test scripts")
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            const problems: string[] = [];
            let report: ToolReport[] | undefined;
            let installFailed = false;

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
                    installFailed = true;
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

            if (!options['start']) {
                logger.info('Skipping the dev environment (--no-start).');
            } else if (!report) {
                logger.info('Skipping the dev environment because the tool check failed.');
            } else {
                try {
                    await DevcontainerService.startDevEnvironment(report, logger);
                } catch (ex) {
                    logger.error(toError(ex));
                    problems.push('Starting the dev environment failed.');
                }
            }

            if (!options['checks']) {
                logger.info('Skipping the project checks (--no-checks).');
            } else if (!report) {
                logger.info('Skipping the project checks because the tool check failed.');
            } else if (installFailed) {
                logger.info('Skipping the project checks because installing dependencies failed.');
            } else {
                try {
                    const result = await ProjectChecksService.runProjectChecks(report, logger);
                    if (result.status === 'ran' && result.failed.length > 0) {
                        problems.push(`Project checks failed: ${result.failed.join(', ')}.`);
                    }
                } catch (ex) {
                    logger.error(toError(ex));
                    problems.push('Running the project checks failed.');
                }
            }

            if (problems.length > 0) {
                logger.log(`Setup finished with ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
                process.exitCode = 1;
            } else {
                logger.log('Setup complete.');
            }
        });
}
