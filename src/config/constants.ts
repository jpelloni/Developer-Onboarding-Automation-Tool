/** Minimum Node.js version `dev-setup` accepts, checked by `dev-setup check` and `init`. */
export const NODE_VERSION = "v24.0.0";
/** Minimum pnpm version `dev-setup` accepts, checked by `dev-setup check` and `init`. */
export const PNPM_VERSION = "12.0.0";
/** Minimum Docker version `dev-setup` accepts, checked by `dev-setup check` and `init`. */
export const DOCKER_VERSION = "24.0.0";
/** Minimum Dev Container CLI version `dev-setup init --target devcontainer` accepts. */
export const DEVCONTAINER_CLI_VERSION = "0.60.0";
/** Every tool `dev-setup` knows how to check. */
export const KNOWN_TOOLS = ["node", "pnpm", "docker", "devcontainer"] as const;
/** Name of a tool `dev-setup` knows how to check. */
export type ToolName = typeof KNOWN_TOOLS[number];
/** Tools `dev-setup check` (and `init` on the local machine) checks, in report order. */
export const CHECKABLE_TOOLS: readonly ToolName[] = ["node", "pnpm", "docker"];
/** Tools `dev-setup check` always requires. They can't be skipped; other tools are optional unless `--require`d. */
export const ALWAYS_REQUIRED_TOOLS: readonly ToolName[] = ["node", "pnpm"];
/** Tools `dev-setup init --target devcontainer` checks, in report order. Node.js and pnpm come from the container. */
export const DEVCONTAINER_TOOLS: readonly ToolName[] = ["docker", "devcontainer"];
/** Where `dev-setup init` sets up the project: in the project's devcontainer, or on the local machine. */
export const INIT_TARGETS = ["devcontainer", "local"] as const;
/** Name of a place `dev-setup init` can set up the project; see {@link INIT_TARGETS}. */
export type InitTarget = typeof INIT_TARGETS[number];
/** Name of the environment file `dev-setup init` creates in the current directory. */
export const ENV_FILE = ".env";
/** Name of the template `dev-setup init` copies to {@link ENV_FILE}. */
export const ENV_EXAMPLE_FILE = ".env.example";
/** Name of the manifest whose dependencies `dev-setup init` installs. */
export const PACKAGE_MANIFEST_FILE = "package.json";
/** Devcontainer configuration files `dev-setup init` looks for, in order of precedence. */
export const DEVCONTAINER_CONFIG_FILES: readonly string[] = [".devcontainer/devcontainer.json", ".devcontainer.json"];
/** Docker Compose files `dev-setup init` looks for, in the order Docker Compose prefers them. */
export const COMPOSE_FILES: readonly string[] = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
/** `package.json` scripts `dev-setup init` runs as the project's initial checks, in order. Missing scripts are skipped. */
export const PROJECT_CHECK_SCRIPTS: readonly string[] = ["lint", "test"];
