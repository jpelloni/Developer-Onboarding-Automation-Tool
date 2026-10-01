---
name: generate-jest-tests
description: Generate a full Jest unit test suite for a TypeScript source file in this CLI (dev-setup), following this repo's ts-jest/ESM conventions and mirrored tests/ layout. Use when the user asks to write, generate, or scaffold tests for a file, or invokes /generate-jest-tests. This is a development-workflow tool for building the CLI itself — never wire it into the CLI's own command list (src/commands, src/index.ts).
---

# Generate Jest tests for a source file

Writes a complete, passing Jest test suite for one TypeScript file in `src/`. This is a
Claude Code workflow for developing this repo — it is **not** a `dev-setup` CLI feature.
Never add a command for this to `src/commands/` or wire it into `src/index.ts`.

## 1. Identify the target file

- If the user named a file (or passed one as an argument), use it.
- Otherwise use the file most recently opened/edited in this session.
- If neither is available, ask the user which file under `src/` to target — do not guess.
- Resolve the path and confirm it exists and lives under `src/`.

## 2. Read before writing

- Read the full target file.
- Read its direct imports (adapters/services/utils it calls) enough to know their public
  signatures — you need these to mock correctly.
- Check for an existing test file first (see path rule below). If one exists, extend/update
  it rather than overwriting working tests wholesale.
- If the target file has imports that don't resolve (this repo is mid-refactor between
  `*.util.ts` and flat `src/utils/*.ts` filenames — check `src/utils/index.ts` and the actual
  files on disk), stop and tell the user rather than silently guessing which module they meant.

## 3. Where the test file goes

Tests mirror `src/`'s directory structure under `tests/`, same base filename, suffixed
`.test.ts`:

```
src/services/dependency.service.ts  ->  tests/services/dependency.service.test.ts
src/adapters/docker.adapter.ts      ->  tests/adapters/docker.adapter.test.ts
src/commands/init.command.ts        ->  tests/commands/init.command.test.ts
src/utils/validation.ts             ->  tests/utils/validation.test.ts
```

Create the directory under `tests/` if it doesn't exist yet.

## 4. Conventions to follow (match the existing codebase)

- ESM throughout: import source modules with an explicit `.js` extension
  (`import { Logger } from '../../src/utils/logger.js'`) — `jest.config.mjs` strips it via
  `moduleNameMapper`, matching how `src/` imports itself.
- `describe`/`it`/`expect`/`beforeEach` are ambient globals, but in native ESM mode the `jest`
  object is **not** (`jest.mock(...)` fails with `ReferenceError: jest is not defined`). Get it
  with `const { jest } = import.meta;` — do not import from `@jest/globals` (it isn't a direct
  dependency here).
- To mock a module, call `jest.unstable_mockModule(specifier, factory)` and then load the module
  under test (and the mocked module, if you need its handle) with `await import(...)` *after*
  the mock. Static imports are evaluated first and would bind the real module. See the README's
  Testing section for a worked `node:child_process` example.
- 4-space indentation, single quotes, semicolons — match the surrounding code, not your own
  defaults.
- One top-level `describe` per exported function/class; one `describe` per method for classes.
- Arrange-Act-Assert structure in each `it`, one behavior per test.
- No real I/O, no real process execution, no real network, no real timers. Mock:
  - `node:child_process` (`exec`/`spawn`) wherever a service shells out (see
    `dependency.service.ts` for the `promisify(exec)` pattern).
  - `src/adapters/*` modules, with `jest.unstable_mockModule(...)`, when testing services/commands that call
    them — adapters are the isolation boundary for external systems (Docker, filesystem,
    secrets, Node) and should be treated as untested collaborators from the caller's test.
  - `Logger` — either pass a stubbed object matching its public methods
    (`info`/`warn`/`error`/`debug`/`log`), or construct a real `Logger` and `jest.spyOn` the
    underlying `console` methods. Don't let test output spam the console.
- Cover: the happy path, every branch (including `switch`/`default` cases), and every thrown
  error path (assert the thrown error's type/name and message, not just that it throws) —
  this codebase defines typed errors in `src/utils/errors.ts` (`DependencyError`,
  `VersionError`, `MissingDependencyError`, etc.); assert against those, not generic `Error`.
- For async functions that `Promise.all` over multiple independent operations (e.g.
  `checkDependencies`), test that one failure doesn't abort the others.

## 5. Verify before handing back

- Run the new/updated test file: `pnpm test -- <relative path, e.g. tests/services/dependency.service.test.ts>`
- Run `pnpm lint` and fix any violations in the test file (notably `no-console` — tests must
  not call `console.*` directly except via spies).
- Iterate until the suite is green and lint is clean. Report what you added and current
  coverage gaps, if any (e.g. a function you couldn't safely test without more context).
