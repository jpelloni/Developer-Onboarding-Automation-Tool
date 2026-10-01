# Developer Onboarding Automation Tool

A modular CLI tool designed to streamline and standardize developer onboarding. It automates environment setup, dependency validation, environment variable management, and project bootstrapping — reducing friction and improving developer productivity from day one.

---

## Features

### Environment Setup (`dev-setup init`)
- Installs and validates required dependencies  
- Generates `.env` from `.env.example`  
- Syncs and validates environment variables  
- Starts the development environment or devcontainer  
- Runs initial project checks/tests  

### Dependency Checker (`dev-setup check`)
- Verifies Node, pnpm, and Docker versions  
- Confirms required CLI tools are installed  
- Outputs a structured compatibility report  

### Environment Variable Sync (`dev-setup env`)
- Compares `.env` and `.env.example`  
- Highlights missing or unused variables  
- Optional integration with secrets managers  

### Project Bootstrap (`dev-setup bootstrap`)
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
│   │   ├── init.ts
│   │   ├── check.ts
│   │   ├── env.ts
│   │   └── bootstrap.ts
│   │
│   ├── services/
│   │   ├── dependency.service.ts
│   │   ├── env.service.ts
│   │   ├── devcontainer.service.ts
│   │   └── projectBootstrap.service.ts
│   │
│   ├── adapters/
│   │   ├── docker.adapter.ts
│   │   ├── node.adapter.ts
│   │   ├── secrets.adapter.ts
│   │   └── fileSystem.adapter.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── exec.ts
│   │   ├── validation.ts
│   │   └── errors.ts
│   │
│   ├── config/
│   │   ├── constants.ts
│   │   └── defaults.ts
│   │
│   └── index.ts
│
├── tests/                  # Mirrors src/ — one *.test.ts per source file
│   ├── commands/
│   ├── services/
│   ├── adapters/
│   └── utils/
│       └── validation.test.ts
│
├── .claude/
│   └── settings.json       # Enables the dev-workflow Claude Code plugin
│
├── scripts/
│   └── check-pr.mjs        # PR policy check (run by CI and `pnpm check:pr`)
│
├── .devcontainer/
│   ├── devcontainer.json
│   └── Dockerfile
│
├── jest.config.mjs
├── package.json
└── README.md
```
---

## Architecture Overview

### Commands
Thin wrappers that parse CLI input and call services.

### Services
Core business logic for onboarding, dependency checking, environment syncing, and bootstrapping.

### Adapters
Isolated interfaces for external systems (Docker, Node, filesystem, secrets managers).

### Utils
Shared helpers for logging, executing shell commands, validation, and error handling.

### Config
Centralized constants, defaults, and templates.

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

### Conventions

- **ESM imports with `.js` extensions.** Import source modules exactly as `src/` imports itself (`'../../src/utils/validation.js'`); `jest.config.mjs` maps the extension back to the `.ts` file.
- **Test globals are ambient, `jest` is not.** `describe`, `it`, `expect`, and `beforeEach` are globals. In native ESM mode the `jest` object isn't, so get it from `import.meta` (`const { jest } = import.meta;`) rather than adding `@jest/globals` as a dependency.
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

This repo uses the `dev-workflow` [Claude Code](https://claude.com/claude-code) plugin from the private [`jpelloni/claude-dev-skills`](https://github.com/jpelloni/claude-dev-skills) marketplace. `.claude/settings.json` enables it, so Claude Code prompts you to install it the first time you open the repo (you need access to that repository).

Its `generate-jest-tests` skill writes a full test suite for a source file following the conventions above. It reads the target and its imports, creates the mirrored file under `tests/`, then runs the tests and lint until both pass with at least 80% coverage.

In a Claude Code session at the repo root:

```text
/dev-workflow:generate-jest-tests src/utils/validation.ts
```

If you don't pass a path, it targets the file you most recently opened or edited. If the file already has tests, it extends them instead of overwriting them.

> These skills are development aids for working on this repo. They are not `dev-setup` CLI commands and aren't part of the shipped binary.

---

## Pull Request Requirements

Every PR into `master` must meet these rules. The `PR checks` workflow (`.github/workflows/pr-checks.yml`) enforces them.

- **No unresolved TODOs** in changed files under `src/` or `tests/`.
- **All unit tests pass.**
- **At least 80% coverage for each updated file.** Every changed `src/**/*.ts` file needs at least 80% lines, statements, functions, and branches.
- **Code documentation.** Every exported declaration in a changed `src/**/*.ts` file has a JSDoc (`/** ... */`) comment.
- **Project documentation updated.** A PR that changes `src/` must also update `README.md` (or `docs/**`).

The plugin's `generate-docs` skill writes the JSDoc and README updates for your changed files:

```text
/dev-workflow:generate-docs
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
