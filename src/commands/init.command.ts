import { Command, Option, type OptionValues } from "commander";
import { INIT_TARGETS, type InitTarget } from '../config/constants.js';
import { DEVCONTAINER_PROFILE, DependencyService, type ToolReport } from '../services/dependency.service.js';
import { DevcontainerService } from '../services/devcontainer.service.js';
import { EnvService } from '../services/env.service.js';
import { ProjectChecksService } from '../services/project-checks.service.js';
import { Logger } from '../utils/logger.js';

const toError = (ex: unknown): Error => (ex instanceof Error ? ex : new Error(String(ex)));

interface Setup {
    options: OptionValues;
    logger: Logger;
    target: InitTarget;
    problems: string[];
}

const checkTools = async ({ options, logger, target, problems }: Setup): Promise<ToolReport[] | undefined> => {
    try {
        const report = await DependencyService.getCompatibilityReport({
            require: options['require'],
            skip: options['skip'],
            ...(target === 'devcontainer' ? { profile: DEVCONTAINER_PROFILE } : {}),
        }, logger);
        logger.log(`Dependency report:\n${DependencyService.formatCompatibilityReport(report)}`);
        const failures = DependencyService.summarizeRequiredFailures(report);
        if (failures) problems.push(failures);
        return report;
    } catch (ex) {
        logger.error(toError(ex));
        problems.push('The tool check failed.');
        return undefined;
    }
};

const install = async ({ logger, target, problems }: Setup, report: ToolReport[]): Promise<boolean> => {
    try {
        await DependencyService.installProjectDependencies(report, logger, target);
        return true;
    } catch (ex) {
        logger.error(toError(ex));
        problems.push('Installing dependencies failed.');
        return false;
    }
};

const setUpEnvFile = async ({ logger, problems }: Setup): Promise<void> => {
    try {
        if (await EnvService.generateEnvFile(logger) === 'exists') {
            const { missing } = await EnvService.compareEnvFiles(logger);
            if (missing.length > 0) problems.push(`.env is missing ${missing.length} variable(s).`);
        }
    } catch (ex) {
        logger.error(toError(ex));
        problems.push('Setting up .env failed.');
    }
};

const runChecks = async ({ logger, target, problems }: Setup, report: ToolReport[]): Promise<void> => {
    try {
        const result = await ProjectChecksService.runProjectChecks(report, logger, target);
        if (result.status === 'ran' && result.failed.length > 0) {
            problems.push(`Project checks failed: ${result.failed.join(', ')}.`);
        }
    } catch (ex) {
        logger.error(toError(ex));
        problems.push('Running the project checks failed.');
    }
};

const setUpLocally = async (setup: Setup): Promise<void> => {
    const { options, logger, problems } = setup;
    const report = await checkTools(setup);
    let installFailed = false;

    if (!options['install']) {
        logger.info('Skipping dependency installation (--no-install).');
    } else if (!report) {
        logger.info('Skipping dependency installation because the tool check failed.');
    } else {
        installFailed = !await install(setup, report);
    }

    await setUpEnvFile(setup);

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
        await runChecks(setup, report);
    }
};

const setUpInDevcontainer = async (setup: Setup): Promise<void> => {
    const { options, logger, problems } = setup;
    const report = await checkTools(setup);

    // .env comes first: devcontainer.json may load it (e.g. with --env-file) when the container starts.
    await setUpEnvFile(setup);

    let started = false;
    if (!options['start']) {
        logger.info('Skipping the devcontainer (--no-start).');
    } else if (!report) {
        logger.info('Skipping the devcontainer because the tool check failed.');
    } else {
        try {
            started = await DevcontainerService.startDevcontainer(report, logger) === 'started';
        } catch (ex) {
            logger.error(toError(ex));
            problems.push('Starting the devcontainer failed.');
        }
    }

    let installFailed = false;
    if (!options['install']) {
        logger.info('Skipping dependency installation (--no-install).');
    } else if (!report || !started) {
        logger.info("Skipping dependency installation because the devcontainer wasn't started.");
    } else {
        installFailed = !await install(setup, report);
    }

    if (!options['checks']) {
        logger.info('Skipping the project checks (--no-checks).');
    } else if (!report || !started) {
        logger.info("Skipping the project checks because the devcontainer wasn't started.");
    } else if (installFailed) {
        logger.info('Skipping the project checks because installing dependencies failed.');
    } else {
        await runChecks(setup, report);
    }
};

/**
 * Builds the `init` command, which runs the developer onboarding setup.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options, then
 * decides where to set up the project with {@link DevcontainerService.resolveInitTarget}: in its
 * devcontainer or on the local machine. `--target` chooses explicitly; otherwise the user is asked
 * when the project has a devcontainer, and the local machine is used when it can't ask.
 *
 * On the local machine, it:
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
 *
 * In the devcontainer, it:
 *
 * 1. Checks that Docker and the Dev Container CLI are installed and up to date (both required);
 *    Node.js and pnpm come from the container, so they aren't checked.
 * 2. Creates and compares `.env` as above, before the container starts.
 * 3. Starts the devcontainer with `devcontainer up`, unless `--no-start` is passed.
 * 4. Installs the project's dependencies inside the container, unless `--no-install` is passed.
 * 5. Runs the project's `lint` and `test` scripts inside the container, unless `--no-checks` is
 *    passed.
 *
 *    Steps 4 and 5 are skipped when the devcontainer wasn't started, and step 5 when the install
 *    failed.
 *
 * Finally, it prints a summary of the problems found, or that setup is complete.
 *
 * Each step runs even if an earlier one fails; errors are logged rather than thrown. It sets
 * `process.exitCode` to `1` when the target can't be used, a required tool is missing or
 * outdated, the install fails, `.env` is missing variables, the dev environment fails to start,
 * a project check fails, or a step fails.
 *
 * @returns The `init` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createInitCommand(): Command {
    return new Command('init')
        .description('Run the developer onboarding setup: check tools, install dependencies, create and check .env, start the dev environment, then run the project checks')
        .addOption(new Option('--target <target>', 'where to set up the project (asks when the project has a devcontainer)')
            .choices(INIT_TARGETS))
        .option('--require <tools...>', 'treat optional tools as required (e.g. docker)')
        .option('--skip <tools...>', 'leave optional tools out of the check (e.g. docker)')
        .option('--no-install', "don't install the project's dependencies")
        .option('--no-start', "don't start the devcontainer or Docker Compose services")
        .option('--no-checks', "don't run the project's lint and test scripts")
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            const problems: string[] = [];

            let target: InitTarget | undefined;
            try {
                target = await DevcontainerService.resolveInitTarget(options['target'], logger);
            } catch (ex) {
                logger.error(toError(ex));
                problems.push('Choosing where to set up the project failed.');
            }

            if (target === 'devcontainer') {
                logger.log('Setting up the project in the devcontainer.');
                await setUpInDevcontainer({ options, logger, target, problems });
            } else if (target === 'local') {
                await setUpLocally({ options, logger, target, problems });
            }

            if (problems.length > 0) {
                logger.log(`Setup finished with ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
                process.exitCode = 1;
            } else {
                logger.log('Setup complete.');
            }
        });
}
