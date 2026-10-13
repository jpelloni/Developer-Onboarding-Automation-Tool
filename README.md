# Developer Onboarding Automation Tool

A modular CLI tool designed to streamline and standardize developer onboarding. It automates environment setup, dependency validation, environment variable management, and project bootstrapping — reducing friction and improving developer productivity from day one.

---

## Features

Sections marked **(planned)** describe features that aren't implemented yet.

### Environment Setup (`dev-setup init`)
The one command to run in a freshly cloned project. It sets the project up either **in its devcontainer** or **on the local machine**:

- `--target devcontainer` or `--target local` chooses explicitly. `--target devcontainer` fails when the project has no devcontainer configuration (`.devcontainer/devcontainer.json` or `.devcontainer.json`), or when `init` is already running inside a container.
- Without `--target`, `init` asks when the project has a devcontainer configuration and isn't already running inside a container. Pressing Enter chooses the devcontainer.
- It uses the local machine without asking when there's no devcontainer configuration, when it's already inside a container, or when it can't prompt (CI, piped input).
- Running inside a container is detected from `REMOTE_CONTAINERS` (VS Code Dev Containers), `CODESPACES`, or `/.dockerenv`.

```text
$ dev-setup init
This project has a devcontainer (.devcontainer/devcontainer.json). Set it up in the devcontainer or on this machine? [D]evcontainer / [l]ocal:
```

#### On the local machine

In order, `init`:

1. Prints the same tool compatibility report as [`dev-setup check`](#dependency-checker-dev-setup-check). `--require` and `--skip` work the same way.
2. Installs the project's dependencies by running `pnpm install` in the current directory, with its output shown as it runs. The step is skipped when there's no `package.json`, pnpm is missing or outdated, or the tool check failed. Pass `--no-install` to skip it. Run with `--verbose` to see why it was skipped.
3. Creates `.env` by copying `.env.example` in the current directory. An existing `.env` is never overwritten, and the step is skipped when there's no `.env.example`. Run with `--verbose` to see why it was skipped.
4. If `.env` already existed, compares it with `.env.example` like [`dev-setup env`](#environment-variable-sync-dev-setup-env) and lists missing or unused variables.
5. Starts the development environment, with the output shown as it runs:
   - If there's a devcontainer configuration and `init` isn't already running inside a container, it runs `devcontainer up --workspace-folder .`, which also starts any Compose services the devcontainer uses.
   - Otherwise, if there's a Compose file (`compose.yaml`, `compose.yml`, `docker-compose.yaml`, or `docker-compose.yml`), it runs `docker compose up -d`.
   - The step is skipped when neither configuration exists, Docker was skipped with `--skip docker`, or the tool check failed. Pass `--no-start` to skip it. Run with `--verbose` to see why it was skipped.
   - If Docker is missing or outdated, or the devcontainer needs the [Dev Container CLI](https://github.com/devcontainers/cli) and it isn't installed, `init` prints a warning with a hint and doesn't start anything. That isn't counted as a problem, because Docker is optional. Pass `--require docker` to make a missing Docker fail `init`.
6. Runs the project's initial checks: the `lint` and `test` scripts in `package.json`, in that order, with `pnpm run <script>` and its output shown as it runs. Scripts the project doesn't define are skipped, and a failing script doesn't stop the next one. The step is skipped when there's no `package.json`, it defines neither script, pnpm is missing or outdated, or the tool check or install failed. Pass `--no-checks` to skip it. Run with `--verbose` to see why it was skipped.
7. Ends with `Setup complete.`, or a list of the problems found.

#### In the devcontainer

Node.js and pnpm come from the container, so `init` doesn't check them on the local machine. In order, it:

1. Prints a tool compatibility report for Docker and the [Dev Container CLI](https://github.com/devcontainers/cli) (`devcontainer`), which are both required. `--require` and `--skip` only accept these two tools, and neither can be skipped.
2. Creates `.env` and compares it with `.env.example`, as on the local machine. This happens before the container starts, so `devcontainer.json` can load `.env` (for example, with `--env-file` in `runArgs`).
3. Starts the devcontainer with `devcontainer up --workspace-folder .`. The step is skipped when Docker or the Dev Container CLI is missing or outdated (the report already lists that as a problem), or the tool check failed. Pass `--no-start` to skip it.
4. Installs the project's dependencies inside the container with `devcontainer exec --workspace-folder . pnpm install`. The step is skipped when there's no `package.json`, or the devcontainer wasn't started. Pass `--no-install` to skip it.
5. Runs the `lint` and `test` scripts inside the container with `devcontainer exec --workspace-folder . pnpm run <script>`, under the same rules as on the local machine. The step is skipped when the devcontainer wasn't started, or the install failed. Pass `--no-checks` to skip it.
6. Ends with `Setup complete.`, or a list of the problems found.

Each step runs even if an earlier one fails. `init` exits with code `1` when `--target devcontainer` can't be used, a required tool is missing or outdated, `pnpm install` fails, `.env` is missing variables, the dev environment fails to start, a project check fails, or a step fails.

```text
$ dev-setup init
[LOG] Dependency report:
Tool    Required  Minimum  Installed  Status
node    yes       v24.0.0  v24.20.0   ok
pnpm    yes       12.0.0   12.6.0     ok
docker  no        24.0.0   29.8.2     ok

[LOG] Installing dependencies with pnpm install...

Already up to date
Done in 53ms using pnpm v12.6.0
[LOG] Dependencies installed.

[LOG] .env is missing 1 variable(s) defined in .env.example: API_KEY

[LOG] Starting Docker Compose services from compose.yaml...
 ✔ Container my-service-db-1  Started
[LOG] Docker Compose services started.

[LOG] Running pnpm run lint...
[LOG] pnpm run lint passed.

[LOG] Running pnpm run test...
Tests:       12 passed, 12 total
[LOG] pnpm run test passed.

[LOG] Setup finished with 1 problem(s):
  - .env is missing 1 variable(s).
```

### Dependency Checker (`dev-setup check`)
- Checks Node.js, pnpm, and Docker concurrently against the minimum versions in `src/config/constants.ts`, and prints a compatibility report with each tool's minimum and installed version and its status (`ok`, `outdated`, or `missing`).
- Node.js and pnpm are always required. Docker is optional by default: it's reported, but doesn't fail the check.
- `--require <tools...>` makes optional tools required for that run (e.g. `--require docker` in a CI job that builds containers). `--skip <tools...>` leaves optional tools out. Both accept several names (`--require docker pnpm` or `--require docker,pnpm`). Unknown names, skipping Node.js or pnpm, or requiring and skipping the same tool are errors.
- Exits with code `1` when a required tool is missing or outdated, or the options are invalid. Run with `--verbose` to see each detected version, or `--debug` to see why a tool was reported missing.

```text
$ dev-setup check --require docker
[LOG] Dependency report:
Tool    Required  Minimum  Installed  Status
node    yes       v24.0.0  v24.1.0    ok
pnpm    yes       12.0.0   12.6.0     ok
docker  yes       24.0.0   -          missing

[LOG] 1 required tool(s) missing or outdated: docker (missing)
```

### Environment Variable Sync (`dev-setup env`)
- Compares the variables defined in `.env` with those in `.env.example`. Only names are compared, and values are never printed.
- Lists the variables `.env` is **missing** (defined in `.env.example` but not in `.env`) and the **unused** ones (in `.env` but not in `.env.example`), or reports that the files are in sync.
- Exits with code `1` when variables are missing or either file doesn't exist, so it can gate CI or scripts. Unused variables alone don't fail it. Run `dev-setup init` first if there's no `.env`.
- Understands blank lines, `#` comments, and `export KEY=value`. Run with `--verbose` to see how many variables each file defines.

```text
$ dev-setup env
[LOG] .env is missing 2 variable(s) defined in .env.example: PORT, API_KEY
[LOG] .env has 1 variable(s) not defined in .env.example: LEGACY
```

**Planned:**
- Optional integration with secrets managers  

### Project Bootstrap (`dev-setup bootstrap`)
- `dev-setup bootstrap <name>` creates a new Node.js + TypeScript + pnpm project in `./<name>` from the project template in [`templates/node-ts/`](templates/node-ts/): `package.json` with `dev`, `build`, `start`, `test`, `lint`, and `format` scripts, `tsconfig.json`, ESLint, Prettier, and Jest (native ESM) configs, a starter module and test, `.gitignore`, `.env.example`, `pnpm-workspace.yaml`, a README, and a [devcontainer](#devcontainer-template).
- `<name>` is used as the directory and the `package.json` name, so it must be a valid unscoped npm package name (lowercase letters, digits, `.`, `_`, and `-`, starting with a letter or digit).
- Refuses to write into a directory that exists and isn't empty, and never overwrites a file. `--dry-run` lists the files without writing them.
- Doesn't install dependencies or initialize Git. It prints the next steps instead: `cd <name>`, then `dev-setup init`, which installs the dependencies in the devcontainer or on the local machine. Exits with code `1` on an invalid name, a non-empty directory, or a write failure.

```text
$ dev-setup bootstrap my-service
[LOG] Created 14 file(s) in my-service/. Next steps:
  cd my-service
  dev-setup init
```

#### Updating the template

Edit the files in `templates/node-ts/` directly; they're ordinary files. `{{name}}` anywhere in a file is replaced with the project name. Store a gitignore as `_gitignore` (it's created as `.gitignore`), so it doesn't apply to this repo. After editing, run `pnpm generate:templates`, or any script that runs it (see [Project template](#project-template)), and commit both the template and the regenerated `src/config/project-template.ts`.

### Devcontainer Template
Every project `dev-setup bootstrap` creates includes `.devcontainer/devcontainer.json` ([`templates/node-ts/.devcontainer/`](templates/node-ts/.devcontainer/)), so [`dev-setup init`](#environment-setup-dev-setup-init) can set it up in a container:

- The `typescript-node` image with Node.js 24 and TypeScript, plus the pnpm feature.
- `postCreateCommand` runs `pnpm install` once the container is created, so opening the folder in VS Code with **Dev Containers: Reopen in Container** also installs the dependencies.
- Recommended VS Code extensions: ESLint and Prettier, with Prettier as the default formatter and format on save.
- Optional AI-assisted development tools: the Claude Code feature and extension, commented out.
- `{{name}}` is replaced with the project name, which becomes the container's name.

Like the rest of the template, it's embedded in the binary at build time, so the standalone `dev-setup` executables include it.

---

## Project Structure
```
dev-setup/
├── src/
│   ├── commands/
│   │   ├── init.command.ts       # dev-setup init
│   │   ├── check.command.ts      # dev-setup check
│   │   ├── env.command.ts        # dev-setup env
│   │   ├── bootstrap.command.ts  # dev-setup bootstrap
│   │   └── registry.ts           # Generated list of commands (do not edit)
│   │
│   ├── services/
│   │   ├── dependency.service.ts  # Checks tool versions, builds the compatibility report, and installs project dependencies
│   │   ├── env.service.ts         # Generates .env and compares it with .env.example
│   │   ├── project-checks.service.ts  # Runs the project's lint and test scripts
│   │   ├── devcontainer.service.ts    # Chooses where init sets up, starts the devcontainer or Docker Compose services
│   │   └── project-bootstrap.service.ts  # Creates projects from the template
│   │
│   ├── adapters/
│   │   ├── devcontainer.adapter.ts
│   │   ├── docker.adapter.ts
│   │   ├── node-toolchain.adapter.ts
│   │   ├── prompt.adapter.ts     # Asks the user questions in the terminal
│   │   ├── secrets.adapter.ts
│   │   └── file-system.adapter.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── env-file.ts     # Parses variable names from .env files
│   │   ├── exec.ts         # Runs shell commands (getToolVersion, runCommand)
│   │   ├── validation.ts
│   │   └── errors.ts
│   │
│   ├── config/
│   │   ├── constants.ts
│   │   ├── project-template.ts  # Generated from templates/node-ts/ (do not edit)
│   │   └── defaults.ts
│   │
│   ├── cli.ts              # Builds the dev-setup program (createProgram)
│   └── index.ts            # Entry point: parses process arguments
│
├── tests/                  # Mirrors src/ — one *.test.ts per source file
│   ├── commands/
│   │   ├── bootstrap.command.test.ts
│   │   ├── check.command.test.ts
│   │   ├── env.command.test.ts
│   │   ├── init.command.test.ts
│   │   └── registry.test.ts
│   ├── services/
│   │   ├── dependency.service.test.ts
│   │   ├── devcontainer.service.test.ts
│   │   ├── env.service.test.ts
│   │   ├── project-checks.service.test.ts
│   │   └── project-bootstrap.service.test.ts
│   ├── adapters/
│   │   ├── devcontainer.adapter.test.ts
│   │   ├── docker.adapter.test.ts
│   │   ├── file-system.adapter.test.ts
│   │   ├── node-toolchain.adapter.test.ts
│   │   └── prompt.adapter.test.ts
│   ├── config/
│   │   └── project-template.test.ts
│   ├── scripts/
│   │   ├── generate-commands.test.ts
│   │   └── generate-templates.test.ts
│   ├── utils/
│   │   ├── env-file.test.ts
│   │   ├── errors.test.ts
│   │   ├── exec.test.ts
│   │   ├── logger.test.ts
│   │   └── validation.test.ts
│   ├── cli.test.ts
│   ├── index.test.ts
│   ├── jest-esm.d.ts       # Types for ESM-only jest APIs (jest.unstable_mockModule)
│   └── tsconfig.json       # Editor type-checking for tests (not used by the build)
│
├── .claude/
│   └── settings.json       # Enables the Claude Code dev-workflow plugins
│
├── scripts/
│   ├── check-pr.mjs              # PR policy check (run by CI and `pnpm check:pr`)
│   ├── generate-commands.mjs     # Writes src/commands/registry.ts
│   ├── generate-commands.d.mts   # Types for importing the generator in tests
│   ├── generate-templates.mjs    # Writes src/config/project-template.ts
│   └── generate-templates.d.mts  # Types for importing the generator in tests
│
├── templates/
│   └── node-ts/            # Project template for dev-setup bootstrap (edit these files)
│       └── .devcontainer/  # Devcontainer template included in bootstrapped projects
│
├── .devcontainer/
│   └── devcontainer.json   # This repo's own development container
│
├── jest.config.mjs
├── tsconfig.json           # Builds src/ only
├── package.json
└── README.md
```
---

## Architecture Overview

### Entry point
`src/cli.ts` exports `createProgram()`, which builds the `commander` program with its global options (`--verbose`, `--debug`) and adds every command listed in `src/commands/registry.ts`. It doesn't parse anything, so tests can run commands against a fixed argument list. `src/index.ts` only calls `createProgram().parseAsync()` on the process arguments.

### Commands
Thin wrappers that parse CLI input and call services. Each `src/commands/<name>.command.ts` default-exports a factory (e.g. `createInitCommand()`) that returns a `commander` `Command`, and reads the global options with `optsWithGlobals()`.

Commands are discovered at build time, not at runtime. `scripts/generate-commands.mjs` scans `src/commands/` and writes `src/commands/registry.ts`, a typed list of static imports. Static imports keep every command visible to `tsc`, `tsx`, Jest, and `deno compile`, which only bundles imports it can find in the code. The generator runs automatically before `pnpm dev`, `build`, `test`, `test:coverage`, `test:pr`, and the `compile:*` scripts. The registry is committed, and CI fails if it's out of date.

The generator enforces these rules:

- Filenames must be kebab-case (`env-sync.command.ts` registers as `envSyncCommand`).
- Placeholder files with no code (only comments or `export {}`) are skipped.
- A file with code but no default export stops the generator with an error, so a command is never silently left out.
- A default export that isn't a `() => Command` fails type checking in `registry.ts`, and two commands with the same name make `createProgram()` throw.

#### Adding a command

1. Create `src/commands/<name>.command.ts` with a default-exported factory:

   ```ts
   import { Command } from "commander";

   /** Builds the `check` command, which ... */
   export default function createCheckCommand(): Command {
       return new Command('check')
           .description('Verify required tools and versions')
           .action(async (_options: unknown, command: Command) => {
               const { verbose, debug } = command.optsWithGlobals();
               // ...
           });
   }
   ```

2. Run `pnpm generate:commands`, or any script that runs it, such as `pnpm dev` or `pnpm test`.
3. Commit the new command file and the updated `registry.ts`, then add `tests/commands/<name>.command.test.ts`.

`src/cli.ts` doesn't change.

### Services
Core business logic for onboarding, dependency checking, environment syncing, and bootstrapping. `DependencyService.getCompatibilityReport` checks every tool concurrently and returns one row per tool, marking each required or optional, and `summarizeRequiredFailures` turns the failed required tools into one line for `check` and `init`. Its `profile` option picks which tools to check: by default Node.js, pnpm, and Docker, or `DEVCONTAINER_PROFILE` (Docker and the Dev Container CLI, both required) when `init` sets up in the devcontainer. `DependencyService.installProjectDependencies` runs `pnpm install` when there's a `package.json` and the report shows pnpm as `ok`, or inside the devcontainer when given the `devcontainer` target. `EnvService.generateEnvFile` creates `.env` from `.env.example`, and `EnvService.compareEnvFiles` reports the variables `.env` is missing or doesn't need, `DevcontainerService.resolveInitTarget` decides whether `init` sets up in the devcontainer or on the local machine (from `--target`, or by asking), `DevcontainerService.startDevEnvironment` starts the devcontainer (outside a container) or the Docker Compose services when the report shows Docker as `ok`, `DevcontainerService.startDevcontainer` starts only the devcontainer for the `devcontainer` target, `ProjectChecksService.runProjectChecks` runs the project's `lint` and `test` scripts (`PROJECT_CHECK_SCRIPTS`), locally or inside the devcontainer, and returns which passed and failed, and `ProjectBootstrapService.bootstrapProject` creates a project from the template. They log their results to the `Logger` they're given, and commands decide the exit code (for example, `env` sets `process.exitCode` to `1` when variables are missing). `init` composes these services rather than adding its own logic.

### Adapters
Isolated interfaces for external systems (Docker, devcontainers, Node, the terminal, filesystem, secrets managers). Adapters wrap failures from the underlying system in the typed errors from `src/utils/errors.ts`. `NodeToolchainAdapter` and `DockerAdapter` get tool versions through `getToolVersion` in `src/utils/exec.ts`, which throws `MissingDependencyError` when a tool can't be run. `NodeToolchainAdapter.installDependencies` runs `pnpm install`, and `NodeToolchainAdapter.runScript` runs `pnpm run <script>`, through `runCommand`, which runs a command in the shell with its output streamed to the terminal and throws `DependencyError` when the command can't start or exits with a non-zero code. `DockerAdapter.composeUp` (`docker compose up -d`), `DevcontainerAdapter.up` (`devcontainer up --workspace-folder .`), and `DevcontainerAdapter.exec` (`devcontainer exec --workspace-folder . <command>`) also use `runCommand`. `DevcontainerAdapter.isInsideContainer` checks `REMOTE_CONTAINERS`, `CODESPACES`, and `/.dockerenv`. `PromptAdapter.isInteractive` checks that stdin and stdout are terminals, and `PromptAdapter.ask` reads one line with `node:readline`, returning `null` when input ends. `FileSystemAdapter` throws `FileSystemError`. `FileSystemAdapter.copyFileIfAbsent` copies with `COPYFILE_EXCL`, and `FileSystemAdapter.writeFileIfAbsent` writes with the `wx` flag, so the existence check and the write happen in one step and an existing file is never overwritten.

### Utils
Shared helpers for logging, running shell commands (`getToolVersion`, `runCommand`), version parsing and comparison (`extractVersion`, `compareVersions`), `.env` parsing (`EnvFile.parseEnvKeys`), and error handling.

### Config
Centralized constants, defaults, and the generated project template.

### Project template
`dev-setup bootstrap` creates projects from the files in `templates/node-ts/`. They're kept as real files so they're easy to edit, but `deno compile` only bundles code the program imports, so files read from disk at runtime would be missing from the standalone binaries. Instead, `scripts/generate-templates.mjs` embeds them in `src/config/project-template.ts`, the same approach as the command registry. It renames `_gitignore` to `.gitignore` and normalizes line endings to `\n`. The generator runs before `pnpm dev`, `build`, `test`, `test:coverage`, `test:pr`, and the `compile:*` scripts. The generated module is committed, and CI fails if it's out of date.

### Module exports
Services, adapters, and utils have no `index.ts` barrel files. Import each module directly by its filename (e.g. `./services/dependency.service.js`). Services and adapters export a single named object that groups their public functions, such as `DependencyService.getCompatibilityReport` and `NodeToolchainAdapter.getNodeVersion`.

---

## Testing

Unit tests use [Jest](https://jestjs.io/) with [ts-jest](https://kulshekhar.github.io/ts-jest/) in native ESM mode (configured in `jest.config.mjs`).

### Running tests

```bash
# Run the full suite
pnpm test

# Run a single test file
pnpm test -- tests/utils/validation.test.ts

# Run tests whose name matches a pattern
pnpm test -- -t "pre-release"

# Generate a coverage report (written to coverage/)
pnpm test:coverage
```

### Layout

Tests live under `tests/` and mirror the `src/` directory structure, using the same base filename with a `.test.ts` suffix:

| Source file                          | Test file                                   |
| ------------------------------------ | ------------------------------------------- |
| `src/utils/validation.ts`            | `tests/utils/validation.test.ts`            |
| `src/services/dependency.service.ts` | `tests/services/dependency.service.test.ts` |
| `src/adapters/docker.adapter.ts`     | `tests/adapters/docker.adapter.test.ts`     |
| `src/commands/init.command.ts`       | `tests/commands/init.command.test.ts`       |
| `src/cli.ts`                         | `tests/cli.test.ts`                         |

### Conventions

- **ESM imports with `.js` extensions.** Import source modules exactly as `src/` imports itself (`'../../src/utils/validation.js'`); `jest.config.mjs` maps the extension back to the `.ts` file.
- **Test globals are ambient, `jest` is not.** `describe`, `it`, `expect`, and `beforeEach` are globals. In native ESM mode the `jest` object isn't, so get it from `import.meta` (`const { jest } = import.meta;`) rather than adding `@jest/globals` as a dependency.
- **Editor type checking.** The root `tsconfig.json` only covers `src/`, so `tests/tsconfig.json` extends it to cover `tests/`, which loads the Jest types in your editor. `@types/jest` doesn't declare `jest.unstable_mockModule`, so `tests/jest-esm.d.ts` adds it. If your editor reports `Cannot find name 'expect'`, restart the TypeScript server.
- **One behavior per test**, written as Arrange / Act / Assert, grouped in one `describe` per exported function (or per method, for classes).
- **No real side effects.** Mock `node:child_process`, `src/adapters/*`, and the network. Stub or spy on `Logger` so tests don't write to the console.
- **Assert typed errors.** Check the error type and message against the classes in `src/utils/errors.ts` (`DependencyError`, `MissingDependencyError`, `FileSystemError`, `BootstrapError`), not just that something threw.

### Example

`tests/utils/validation.test.ts` covers `compareVersions`, which checks whether an installed version meets a minimum requirement using SemVer precedence (including pre-release tags and build metadata):

```ts
import { compareVersions } from '../../src/utils/validation.js';

describe('compareVersions', () => {
    describe('pre-release versions', () => {
        it('returns false when a pre-release is compared against its release', () => {
            const result = compareVersions('20.0.0-rc.1', '20.0.0');

            expect(result).toBe(false);
        });

        it('compares numeric identifiers numerically', () => {
            const result = compareVersions('1.0.0-alpha.10', '1.0.0-alpha.2');

            expect(result).toBe(true);
        });
    });
});
```

When the code under test shells out, mock the module with `jest.unstable_mockModule` and then import it **dynamically**. Under native ESM, `jest.mock` is not hoisted above static imports, so a static import would load the real module. For example, here is how you would stub `node --version` for code that uses `promisify(exec)`:

```ts
import { promisify } from 'node:util';

const { jest } = import.meta;

jest.unstable_mockModule('node:child_process', () => ({
    exec: jest.fn((_cmd: string, callback: (err: Error | null, out: { stdout: string; stderr: string }) => void) => {
        callback(null, { stdout: 'v20.11.1\n', stderr: '' });
    }),
}));

// Import after mocking, so the mock is what gets loaded.
const { exec } = await import('node:child_process');

it('reads the stubbed Node version', async () => {
    const { stdout } = await promisify(exec)('node --version');

    expect(stdout).toBe('v20.11.1\n');
});
```

The same pattern applies to `src/adapters/*` and to the module under test: mock its dependencies first, then `await import(...)` it.

### Generating tests with Claude Code

This repo uses the `typescript-dev-workflow` and `shared-dev-workflow` [Claude Code](https://claude.com/claude-code) plugins from the private [`jpelloni/claude-dev-skills`](https://github.com/jpelloni/claude-dev-skills) marketplace. `.claude/settings.json` enables them, so Claude Code prompts you to install them the first time you open the repo (you need access to that repository).

The `typescript-dev-workflow` plugin's `generate-jest-tests` skill writes a full test suite for a source file following the conventions above. It reads the target and its imports, creates the mirrored file under `tests/`, then runs the tests and lint until both pass with at least 80% coverage.

In a Claude Code session at the repo root:

```text
/typescript-dev-workflow:generate-jest-tests src/utils/validation.ts
```

If you don't pass a path, it targets the file you most recently opened or edited. If the file already has tests, it extends them instead of overwriting them.

> These skills are development aids for working on this repo. They are not `dev-setup` CLI commands and aren't part of the shipped binary.

---

## Pull Request Requirements

Every PR into `master` must meet these rules. The `PR checks` workflow (`.github/workflows/pr-checks.yml`) enforces them.

- **No unresolved TODOs** in changed files under `src/` or `tests/`.
- **All unit tests pass.**
- **At least 80% coverage for each updated file.** Every changed `src/**/*.ts` file needs at least 80% lines, statements, functions, and branches. Placeholder files with no code (only comments or `export {}`) are skipped.
- **Code documentation.** Every exported declaration in a changed `src/**/*.ts` file has a JSDoc (`/** ... */`) comment.
- **Project documentation updated.** A PR that changes `src/` must also update `README.md` (or `docs/**`).

The `shared-dev-workflow` plugin's `generate-docs` skill writes the JSDoc and README updates for your changed files:

```text
/shared-dev-workflow:generate-docs
```

Check locally before opening a PR:

```bash
pnpm test:pr     # run tests and write coverage/coverage-summary.json
pnpm check:pr    # check files changed vs origin/master (pass another base ref as an argument if needed)
```

---

## Goals

- Reduce onboarding time  
- Standardize development environments  
- Improve reliability and consistency across teams  
- Provide a foundation for future DevProd tooling  
- Demonstrate automation, tooling design, and developer empathy  

---

## Future Enhancements

- AI-assisted code review  
- CI/CD pipeline generator  
- Log analysis tooling  
- Secrets manager integrations  
