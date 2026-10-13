import { DevcontainerAdapter } from '../adapters/devcontainer.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { NodeToolchainAdapter } from '../adapters/node-toolchain.adapter.js';
import { type InitTarget, PACKAGE_MANIFEST_FILE, PROJECT_CHECK_SCRIPTS } from '../config/constants.js';
import { DependencyError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ToolReport } from './dependency.service.js';

/**
 * Outcome of {@link ProjectChecksService.runProjectChecks}:
 *
 * - `ran`: at least one check script ran. `passed` and `failed` list the scripts, in the order they ran.
 * - `no-manifest`: there is no `package.json` in the current directory.
 * - `no-scripts`: `package.json` defines none of the scripts in `PROJECT_CHECK_SCRIPTS`.
 * - `pnpm-unavailable`: the report shows pnpm as missing or outdated, so no script was run.
 */
export type ProjectChecksResult =
    | { status: 'ran'; passed: string[]; failed: string[] }
    | { status: 'no-manifest' | 'no-scripts' | 'pnpm-unavailable' };

const readScriptNames = async (): Promise<string[]> => {
    const contents = await FileSystemAdapter.readTextFile(PACKAGE_MANIFEST_FILE);
    let manifest: unknown;
    try {
        manifest = JSON.parse(contents);
    } catch (ex) {
        throw new DependencyError(`Failed to parse ${PACKAGE_MANIFEST_FILE}.`, ex as Error);
    }
    const scripts = (manifest as { scripts?: unknown } | null)?.scripts;
    return scripts && typeof scripts === 'object' ? Object.keys(scripts) : [];
};

/**
 * Runs the project's initial checks: each script in `PROJECT_CHECK_SCRIPTS` (`lint`, then `test`)
 * that the current directory's `package.json` defines, with `pnpm run <script>`. When `target` is
 * `devcontainer`, the scripts run inside the running devcontainer with `devcontainer exec`.
 *
 * Every script runs even if an earlier one fails. A failed script is logged as an error and
 * listed in the result rather than thrown. Skips the checks when there is no `package.json`, or it
 * defines none of the scripts. On the local machine, also skips them when `report` shows pnpm as
 * missing or outdated (the report already lists that as a problem); in the devcontainer, pnpm
 * comes from the container, so the report isn't consulted. Logs the start and outcome of each
 * script so they always print, and the reason for a skip as `info` (verbose mode only).
 *
 * @param report The rows returned by {@link DependencyService.getCompatibilityReport}, used to
 * check that pnpm is usable on the local machine.
 * @param logger Logger that receives the outcome.
 * @param target Where to run the scripts: `local` (the default) or `devcontainer`.
 * @returns What happened; see {@link ProjectChecksResult}.
 * @throws {FileSystemError} When `package.json` can't be checked or read.
 * @throws {DependencyError} When `package.json` isn't valid JSON.
 */
async function runProjectChecks(
    report: ToolReport[], logger: Logger, target: InitTarget = 'local'): Promise<ProjectChecksResult> {
    if (!await FileSystemAdapter.exists(PACKAGE_MANIFEST_FILE)) {
        logger.info(`No ${PACKAGE_MANIFEST_FILE} found; skipping the project checks.`);
        return { status: 'no-manifest' };
    }

    const defined = await readScriptNames();
    const scripts = PROJECT_CHECK_SCRIPTS.filter((script) => defined.includes(script));
    if (scripts.length === 0) {
        logger.info(`${PACKAGE_MANIFEST_FILE} has no ${PROJECT_CHECK_SCRIPTS.join(' or ')} script; skipping the project checks.`);
        return { status: 'no-scripts' };
    }

    const pnpm = report.find((entry) => entry.tool === 'pnpm');
    if (target === 'local' && pnpm?.status !== 'ok') {
        logger.info('pnpm is missing or outdated; skipping the project checks.');
        return { status: 'pnpm-unavailable' };
    }

    const passed: string[] = [];
    const failed: string[] = [];
    const where = target === 'devcontainer' ? ' in the devcontainer' : '';
    for (const script of scripts) {
        logger.log(`Running pnpm run ${script}${where}...`);
        try {
            if (target === 'devcontainer') {
                await DevcontainerAdapter.exec(`pnpm run ${script}`);
            } else {
                await NodeToolchainAdapter.runScript(script);
            }
            logger.log(`pnpm run ${script} passed.`);
            passed.push(script);
        } catch (ex) {
            logger.error(ex instanceof Error ? ex : new Error(String(ex)));
            failed.push(script);
        }
    }
    return { status: 'ran', passed, failed };
}

/**
 * Service that runs the project's initial checks (its `lint` and `test` scripts), delegating to
 * `NodeToolchainAdapter`, `DevcontainerAdapter`, and `FileSystemAdapter`.
 */
export const ProjectChecksService = {
    runProjectChecks,
};
