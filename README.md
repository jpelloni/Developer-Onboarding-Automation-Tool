# Developer Onboarding Automation Tool

A modular CLI tool designed to streamline and standardize developer onboarding. It automates environment setup, dependency validation, environment variable management, and project bootstrapping — reducing friction and improving developer productivity from day one.

---

## Features

Sections marked **(planned)** describe features that aren't implemented yet.

### Environment Setup (`dev-setup init`)
- Checks that Node.js and pnpm are installed and meet the minimum versions in `src/config/constants.ts`

**Planned:**
- Install missing dependencies  
- Generate `.env` from `.env.example`  
- Sync and validate environment variables  
- Start the development environment or devcontainer  
- Run initial project checks/tests  

### Dependency Checker (`dev-setup check`) (planned)
- Verifies Node, pnpm, and Docker versions  
- Confirms required CLI tools are installed  
- Outputs a structured compatibility report  

### Environment Variable Sync (`dev-setup env`) (planned)
- Compares `.env` and `.env.example`  
- Highlights missing or unused variables  
- Optional integration with secrets managers  

### Project Bootstrap (`dev-setup bootstrap`) (planned)
- Generates folder structure and boilerplate code  
- Sets up linting, formatting, and testing configs  
- Ensures consistent project scaffolding  

### Devcontainer Template
- Preconfigured development environment  
- Node + TypeScript + pnpm  
- Recommended VS Code extensions  
- Optional AI-assisted development tools  

---

## Project Structure
```
dev-setup/
├── src/
│   ├── commands/
│   │   ├── init.command.ts       # dev-setup init
│   │   ├── check.command.ts      # Placeholder
│   │   ├── env.command.ts        # Placeholder
│   │   ├── bootstrap.command.ts  # Placeholder
│   │   └── registry.ts           # Generated list of commands (do not edit)
│   │
│   ├── services/
│   │   ├── dependency.service.ts
│   │   ├── env.service.ts
│   │   ├── devcontainer.service.ts
│   │   └── projectBootstrap.service.ts
│   │
│   ├── adapters/
│   │   ├── docker.adapter.ts
│   │   ├── node-toolchain.adapter.ts
│   │   ├── secrets.adapter.ts
│   │   └── fileSystem.adapter.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── exec.ts         # Placeholder for shell-execution helpers
│   │   ├── validation.ts
│   │   └── errors.ts
│   │
│   ├── config/
│   │   ├── constants.ts
│   │   └── defaults.ts
│   │
│   ├── cli.ts              # Builds the dev-setup program (createProgram)
│   └── index.ts            # Entry point: parses process arguments
│
├── tests/                  # Mirrors src/ — one *.test.ts per source file
│   ├── commands/
│   │   ├── init.command.test.ts
│   │   └── registry.test.ts
│   ├── services/
│   │   └── dependency.service.test.ts
│   ├── adapters/
│   │   └── node-toolchain.adapter.test.ts
│   ├── scripts/
│   │   └── generate-commands.test.ts
│   ├── utils/
│   │   ├── errors.test.ts
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
│   └── generate-commands.d.mts   # Types for importing the generator in tests
│
├── .devcontainer/
│   ├── devcontainer.json
│   └── Dockerfile
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
Core business logic for onboarding, dependency checking, environment syncing, and bootstrapping.

### Adapters
Isolated interfaces for external systems (Docker, Node, filesystem, secrets managers).

### Utils
Shared helpers for logging, executing shell commands, validation, and error handling.

### Config
Centralized constants, defaults, and templates.

### Module exports
Services, adapters, and utils have no `index.ts` barrel files. Import each module directly by its filename (e.g. `./services/dependency.service.js`). Services and adapters export a single named object that groups their public functions, such as `DependencyService.checkDependencies` and `NodeToolchainAdapter.checkNodeVersion`.

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
- **Assert typed errors.** Check the error type and message against the classes in `src/utils/errors.ts` (`DependencyError`, `VersionError`, `MissingDependencyError`), not just that something threw.

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
