/** Minimum Node.js version `dev-setup` accepts, checked by `NodeToolchainAdapter.checkNodeVersion`. */
export const NODE_VERSION = "v24.0.0";
/** Minimum pnpm version `dev-setup` accepts, checked by `NodeToolchainAdapter.checkPnpmVersion`. */
export const PNPM_VERSION = "12.0.0";
/** Minimum Docker version `dev-setup check` accepts. */
export const DOCKER_VERSION = "24.0.0";
/** Tools `dev-setup check` can check, in report order. */
export const CHECKABLE_TOOLS = ["node", "pnpm", "docker"] as const;
/** Name of a tool `dev-setup check` can check. */
export type ToolName = typeof CHECKABLE_TOOLS[number];
/** Tools `dev-setup check` always requires. They can't be skipped; other tools are optional unless `--require`d. */
export const ALWAYS_REQUIRED_TOOLS: readonly ToolName[] = ["node", "pnpm"];
/** Name of the environment file `dev-setup init` creates in the current directory. */
export const ENV_FILE = ".env";
/** Name of the template `dev-setup init` copies to {@link ENV_FILE}. */
export const ENV_EXAMPLE_FILE = ".env.example";
