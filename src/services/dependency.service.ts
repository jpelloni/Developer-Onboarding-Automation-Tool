import { DockerAdapter } from '../adapters/docker.adapter.js';
import { NodeToolchainAdapter } from '../adapters/node-toolchain.adapter.js';
import {
    ALWAYS_REQUIRED_TOOLS,
    CHECKABLE_TOOLS,
    DOCKER_VERSION,
    NODE_VERSION,
    PNPM_VERSION,
    type ToolName,
} from '../config/constants.js';
import { DependencyError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import { compareVersions } from '../utils/validation.js';

/**
 * Checks each dependency concurrently and logs any failure, so one missing or outdated
 * dependency doesn't stop the others from being checked.
 *
 * `node` and `pnpm` are version-checked against the minimums in `src/config/constants.ts`.
 * Any other name is currently only logged.
 *
 * @param dependencies Names of the dependencies to check (e.g. `['node', 'pnpm']`).
 * @param logger Logger that receives the results and errors.
 */
async function checkDependencies(
    dependencies: string[],
    logger: Logger): Promise<void> {
    await Promise.all(dependencies.map(async (dependency) => {
        try {
            await checkDependency(dependency, logger);
        } catch (ex) {
            logger.error(ex instanceof Error ? ex : new Error(String(ex)));
        }
    }));
}

async function checkDependency(dependency: string, logger: Logger): Promise<void> {
    switch (dependency) {
        case 'node':
            await NodeToolchainAdapter.checkNodeVersion(logger);
            break;
        case 'pnpm':
            await NodeToolchainAdapter.checkPnpmVersion(logger);
            break;
        default:
            logger.info(`Dependency "${dependency}" is installed.`);
            break;
    }
}

const TOOLS: Record<ToolName, { minimumVersion: string; getVersion: () => Promise<string> }> = {
    node: { minimumVersion: NODE_VERSION, getVersion: () => NodeToolchainAdapter.getNodeVersion() },
    pnpm: { minimumVersion: PNPM_VERSION, getVersion: () => NodeToolchainAdapter.getPnpmVersion() },
    docker: { minimumVersion: DOCKER_VERSION, getVersion: () => DockerAdapter.getDockerVersion() },
};

/**
 * Which tools {@link DependencyService.getCompatibilityReport} checks beyond the defaults.
 * Each list accepts tool names (case-insensitive), and entries may be comma-separated
 * (`['docker,pnpm']`).
 */
export interface CompatibilityOptions {
    /** Optional tools to treat as required. */
    require?: string[];
    /** Optional tools to leave out of the report. Tools in `ALWAYS_REQUIRED_TOOLS` can't be skipped. */
    skip?: string[];
}

/**
 * Status of one tool in a compatibility report:
 *
 * - `ok`: installed and at least the minimum version.
 * - `outdated`: installed but older than the minimum version.
 * - `missing`: not installed, or its version command failed.
 */
export type ToolStatus = 'ok' | 'outdated' | 'missing';

/** One row of a compatibility report. */
export interface ToolReport {
    /** The tool that was checked. */
    tool: ToolName;
    /** Whether a failure of this tool makes the report fail. */
    required: boolean;
    /** The minimum acceptable version. */
    minimumVersion: string;
    /** The installed version, or `null` when the tool is missing. */
    installedVersion: string | null;
    /** The outcome of the check; see {@link ToolStatus}. */
    status: ToolStatus;
}

const parseToolNames = (names: string[] = []): ToolName[] => {
    const tools = names.flatMap((name) => name.split(',')).map((name) => name.trim().toLowerCase()).filter(Boolean);
    const unknown = tools.filter((tool) => !(CHECKABLE_TOOLS as readonly string[]).includes(tool));
    if (unknown.length > 0) {
        throw new DependencyError(
            `Unknown tool(s): ${unknown.join(', ')}. Expected one of: ${CHECKABLE_TOOLS.join(', ')}.`);
    }
    return tools as ToolName[];
};

/**
 * Checks every tool in `CHECKABLE_TOOLS` concurrently, so one missing or outdated tool doesn't
 * stop the others from being checked, and reports each one's installed version and status.
 *
 * Tools in `ALWAYS_REQUIRED_TOOLS` are required; others are optional unless listed in
 * `options.require`. Logs each detected version as `info` (verbose mode only), and the reason a
 * tool is missing as `debug`.
 *
 * @param options Tools to require or skip beyond the defaults; see {@link CompatibilityOptions}.
 * @param logger Logger that receives the detected versions.
 * @returns One {@link ToolReport} per checked tool, in `CHECKABLE_TOOLS` order.
 * @throws {DependencyError} When `options` names an unknown tool, skips an always-required tool,
 * or both requires and skips the same tool.
 */
async function getCompatibilityReport(options: CompatibilityOptions, logger: Logger): Promise<ToolReport[]> {
    const required = parseToolNames(options.require);
    const skipped = parseToolNames(options.skip);

    const unskippable = skipped.filter((tool) => ALWAYS_REQUIRED_TOOLS.includes(tool));
    if (unskippable.length > 0) {
        throw new DependencyError(`${unskippable.join(', ')} can't be skipped; dev-setup always requires it.`);
    }
    const conflicting = skipped.filter((tool) => required.includes(tool));
    if (conflicting.length > 0) {
        throw new DependencyError(`${conflicting.join(', ')} can't be both required and skipped.`);
    }

    const tools = CHECKABLE_TOOLS.filter((tool) => !skipped.includes(tool));

    return Promise.all(tools.map(async (tool): Promise<ToolReport> => {
        const { minimumVersion, getVersion } = TOOLS[tool];
        const isRequired = ALWAYS_REQUIRED_TOOLS.includes(tool) || required.includes(tool);
        try {
            const installedVersion = await getVersion();
            logger.info(`${tool} version: ${installedVersion}`);
            const status = compareVersions(installedVersion, minimumVersion) ? 'ok' : 'outdated';
            return { tool, required: isRequired, minimumVersion, installedVersion, status };
        } catch (ex) {
            logger.debug(ex instanceof Error ? ex.message : String(ex));
            return { tool, required: isRequired, minimumVersion, installedVersion: null, status: 'missing' };
        }
    }));
}

/**
 * Formats a compatibility report as an aligned plain-text table with the columns Tool,
 * Required, Minimum, Installed, and Status. A missing tool's installed version is shown as `-`.
 *
 * @param report The rows returned by {@link DependencyService.getCompatibilityReport}.
 * @returns The table, one line per row after the header, without a trailing newline.
 */
function formatCompatibilityReport(report: ToolReport[]): string {
    const rows = [
        ['Tool', 'Required', 'Minimum', 'Installed', 'Status'],
        ...report.map((entry) => [
            entry.tool,
            entry.required ? 'yes' : 'no',
            entry.minimumVersion,
            entry.installedVersion ?? '-',
            entry.status,
        ]),
    ];
    const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)));

    return rows
        .map((row) => row.map((cell, column) => cell.padEnd(widths[column]!)).join('  ').trimEnd())
        .join('\n');
}

/**
 * Service that verifies the developer's required tools are installed and up to date,
 * delegating the version checks to `NodeToolchainAdapter` and `DockerAdapter`.
 */
export const DependencyService = {
    checkDependencies,
    getCompatibilityReport,
    formatCompatibilityReport,
};
