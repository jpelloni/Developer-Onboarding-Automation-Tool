import { DevcontainerAdapter } from '../adapters/devcontainer.adapter.js';
import { DockerAdapter } from '../adapters/docker.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { PromptAdapter } from '../adapters/prompt.adapter.js';
import { COMPOSE_FILES, DEVCONTAINER_CONFIG_FILES, DEVCONTAINER_TOOLS, type InitTarget } from '../config/constants.js';
import { DependencyError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ToolReport } from './dependency.service.js';

/**
 * Outcome of {@link DevcontainerService.startDevEnvironment}:
 *
 * - `devcontainer-started`: `devcontainer up` started the devcontainer.
 * - `compose-started`: `docker compose up -d` started the Compose services.
 * - `no-config`: there is no devcontainer configuration or Compose file, so there is nothing to start.
 * - `inside-container`: there is only a devcontainer configuration, and `dev-setup` is already
 *   running inside a container.
 * - `docker-unavailable`: Docker was skipped, missing, or outdated, so nothing was started.
 * - `cli-unavailable`: the devcontainer needs starting, but the Dev Container CLI isn't installed.
 */
export type DevEnvironmentResult =
    | 'devcontainer-started'
    | 'compose-started'
    | 'no-config'
    | 'inside-container'
    | 'docker-unavailable'
    | 'cli-unavailable';

const findFirstExisting = async (paths: readonly string[]): Promise<string | undefined> => {
    for (const path of paths) {
        if (await FileSystemAdapter.exists(path)) return path;
    }
    return undefined;
};

/**
 * Starts the current directory's development environment.
 *
 * When `dev-setup` isn't already running inside a container and there is a devcontainer
 * configuration (see `DEVCONTAINER_CONFIG_FILES`), starts the devcontainer with
 * `devcontainer up`, which also starts any Compose services it uses. Otherwise, when there is a
 * Compose file (see `COMPOSE_FILES`), starts its services with `docker compose up -d`.
 *
 * Nothing is started when `report` shows Docker as skipped, missing, or outdated, or when the
 * devcontainer needs the Dev Container CLI and it isn't installed. Those outcomes are logged as
 * warnings with a hint, since Docker is optional unless `--require docker` is passed. Logs the
 * start and success of a start so they always print, and the other outcomes as `info` (verbose
 * mode only).
 *
 * @param report The rows returned by {@link DependencyService.getCompatibilityReport}, used to
 * check that Docker is usable.
 * @param logger Logger that receives the outcome.
 * @returns What happened; see {@link DevEnvironmentResult}.
 * @throws {FileSystemError} When the presence of a configuration file can't be checked.
 * @throws {DependencyError} When `devcontainer up` or `docker compose up -d` can't be run or fails.
 */
async function startDevEnvironment(report: ToolReport[], logger: Logger): Promise<DevEnvironmentResult> {
    const devcontainerConfig = await findFirstExisting(DEVCONTAINER_CONFIG_FILES);
    const composeFile = await findFirstExisting(COMPOSE_FILES);
    if (!devcontainerConfig && !composeFile) {
        logger.info('No devcontainer or Docker Compose configuration found; skipping the dev environment.');
        return 'no-config';
    }

    const insideContainer = DevcontainerAdapter.isInsideContainer();
    if (devcontainerConfig && insideContainer && !composeFile) {
        logger.info('Already running inside a container; skipping the devcontainer.');
        return 'inside-container';
    }

    const docker = report.find((entry) => entry.tool === 'docker');
    if (!docker) {
        logger.info('Docker was skipped; skipping the dev environment.');
        return 'docker-unavailable';
    }
    if (docker.status !== 'ok') {
        logger.warn(`Docker is ${docker.status}; the dev environment wasn't started. Install Docker, then run dev-setup init again.`);
        return 'docker-unavailable';
    }

    if (devcontainerConfig && !insideContainer) {
        try {
            await DevcontainerAdapter.getCliVersion();
        } catch (ex) {
            logger.debug(ex instanceof Error ? ex.message : String(ex));
            logger.warn(`The devcontainer in ${devcontainerConfig} wasn't started because the Dev Container CLI isn't installed. `
                + 'Install it with `npm install -g @devcontainers/cli`, or open the folder in VS Code and run "Dev Containers: Reopen in Container".');
            return 'cli-unavailable';
        }
        logger.log(`Starting the devcontainer from ${devcontainerConfig}...`);
        await DevcontainerAdapter.up();
        logger.log('Devcontainer started.');
        return 'devcontainer-started';
    }

    logger.log(`Starting Docker Compose services from ${composeFile}...`);
    await DockerAdapter.composeUp();
    logger.log('Docker Compose services started.');
    return 'compose-started';
}

const parseAnswer = (answer: string): InitTarget | undefined => {
    const normalized = answer.trim().toLowerCase();
    if (['', 'd', 'devcontainer'].includes(normalized)) return 'devcontainer';
    if (['l', 'local'].includes(normalized)) return 'local';
    return undefined;
};

/**
 * Decides where `dev-setup init` sets up the project: in its devcontainer, or on the local machine.
 *
 * A `requested` target (from `--target`) is used as is, except that `devcontainer` is rejected
 * when there is no devcontainer configuration (see `DEVCONTAINER_CONFIG_FILES`) or `dev-setup` is
 * already running inside a container. Without one, `local` is chosen when there is no
 * devcontainer configuration, `dev-setup` is already inside a container, or the terminal isn't
 * interactive (e.g. in CI). Otherwise the user is asked, and pressing Enter chooses the
 * devcontainer; an unrecognized answer asks again, and ending input chooses `local`. Logs why
 * `local` was chosen without asking as `info` (verbose mode only).
 *
 * @param requested The target passed with `--target`, or `undefined` to decide automatically.
 * @param logger Logger that receives the outcome.
 * @returns The target to set up.
 * @throws {DependencyError} When `requested` is `devcontainer` but there is no devcontainer
 * configuration, or `dev-setup` is already running inside a container.
 * @throws {FileSystemError} When the presence of a configuration file can't be checked.
 */
async function resolveInitTarget(requested: InitTarget | undefined, logger: Logger): Promise<InitTarget> {
    if (requested === 'local') return 'local';

    const config = await findFirstExisting(DEVCONTAINER_CONFIG_FILES);
    const insideContainer = DevcontainerAdapter.isInsideContainer();

    if (requested === 'devcontainer') {
        if (!config) {
            throw new DependencyError(
                `--target devcontainer needs a devcontainer configuration (${DEVCONTAINER_CONFIG_FILES.join(' or ')}), and none was found.`);
        }
        if (insideContainer) {
            throw new DependencyError(
                "--target devcontainer can't be used because dev-setup is already running inside a container. Use --target local.");
        }
        return 'devcontainer';
    }

    if (!config) {
        logger.info('No devcontainer configuration found; setting up on the local machine.');
        return 'local';
    }
    if (insideContainer) {
        logger.info('Already running inside a container; setting up here.');
        return 'local';
    }
    if (!PromptAdapter.isInteractive()) {
        logger.info(`Not running interactively; setting up on the local machine. Pass --target devcontainer to use ${config}.`);
        return 'local';
    }

    for (;;) {
        const answer = await PromptAdapter.ask(
            `This project has a devcontainer (${config}). Set it up in the devcontainer or on this machine? [D]evcontainer / [l]ocal: `);
        if (answer === null) {
            logger.info('No answer given; setting up on the local machine.');
            return 'local';
        }
        const target = parseAnswer(answer);
        if (target) return target;
        logger.log('Please answer d (devcontainer) or l (local).');
    }
}

/**
 * Outcome of {@link DevcontainerService.startDevcontainer}:
 *
 * - `started`: `devcontainer up` started the devcontainer.
 * - `tools-unavailable`: the report shows Docker or the Dev Container CLI as missing, outdated, or
 *   skipped, so nothing was started.
 */
export type DevcontainerStartResult = 'started' | 'tools-unavailable';

/**
 * Starts the current directory's devcontainer with `devcontainer up`, for
 * `dev-setup init --target devcontainer`. Unlike {@link DevcontainerService.startDevEnvironment},
 * it never falls back to Docker Compose.
 *
 * Nothing is started when `report` doesn't show both Docker and the Dev Container CLI as `ok`
 * (the report already lists that as a problem); that is logged as `info` (verbose mode only).
 * Logs the start and success of the devcontainer so they always print.
 *
 * @param report The rows returned by {@link DependencyService.getCompatibilityReport} for
 * `DEVCONTAINER_PROFILE`, used to check that Docker and the Dev Container CLI are usable.
 * @param logger Logger that receives the outcome.
 * @returns What happened; see {@link DevcontainerStartResult}.
 * @throws {FileSystemError} When the presence of a configuration file can't be checked.
 * @throws {DependencyError} When `devcontainer up` can't be run or fails.
 */
async function startDevcontainer(report: ToolReport[], logger: Logger): Promise<DevcontainerStartResult> {
    const usable = DEVCONTAINER_TOOLS.every((tool) => report.find((entry) => entry.tool === tool)?.status === 'ok');
    if (!usable) {
        logger.info("Docker or the Dev Container CLI isn't available; the devcontainer wasn't started.");
        return 'tools-unavailable';
    }

    const config = await findFirstExisting(DEVCONTAINER_CONFIG_FILES);
    logger.log(`Starting the devcontainer from ${config ?? 'the devcontainer configuration'}...`);
    await DevcontainerAdapter.up();
    logger.log('Devcontainer started.');
    return 'started';
}

/**
 * Service that chooses where `dev-setup init` sets up the project, and starts the project's
 * development environment (a devcontainer or Docker Compose services). It delegates to
 * `DevcontainerAdapter`, `DockerAdapter`, `FileSystemAdapter`, and `PromptAdapter`.
 */
export const DevcontainerService = {
    resolveInitTarget,
    startDevEnvironment,
    startDevcontainer,
};
