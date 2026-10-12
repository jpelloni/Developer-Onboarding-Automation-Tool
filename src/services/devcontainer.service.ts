import { DevcontainerAdapter } from '../adapters/devcontainer.adapter.js';
import { DockerAdapter } from '../adapters/docker.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { COMPOSE_FILES, DEVCONTAINER_CONFIG_FILES } from '../config/constants.js';
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

/**
 * Service that starts the project's development environment (a devcontainer or Docker Compose
 * services). It delegates to `DevcontainerAdapter`, `DockerAdapter`, and `FileSystemAdapter`.
 */
export const DevcontainerService = {
    startDevEnvironment,
};
