# CLAUDE.md

## Claude Code tooling

The `generate-jest-tests` and `setup-pr-policy` skills come from the `typescript-dev-workflow`
plugin, and `generate-docs` from the `shared-dev-workflow` plugin (both in
`jpelloni/claude-dev-skills`), which `.claude/settings.json` enables. They
are development aids for building this repo. Never add commands for them to `src/commands/`, and
never wire them into `src/index.ts`; they are not `dev-setup` CLI features.

## Testing conventions

Follow the README's **Testing** section (mirrored `tests/` layout, native ESM with
`const { jest } = import.meta;`, `jest.unstable_mockModule` followed by `await import(...)`).
In addition:

- `src/adapters/*` are the boundary to external systems (Docker, filesystem, secrets, Node).
  Mock them when testing services and commands.
- Stub `Logger` (`info`/`warn`/`error`/`debug`/`log`) or spy on `console`. Tests must not print.
- Assert the typed errors from `src/utils/errors.ts` (`DependencyError`, `VersionError`,
  `MissingDependencyError`, `FileSystemError`, `BootstrapError`), not generic `Error`.
- For functions that `Promise.all` over independent checks (e.g. `checkDependencies`), test
  that one failure doesn't abort the others.
- `src/utils` uses flat filenames (`logger.ts`, `errors.ts`, `validation.ts`), imported with a
  `.js` extension. There are no `*.util.ts` files.

## Documentation conventions

- `src/utils/validation.ts` is the reference for JSDoc style.
- README sections to keep current: **Features** (one subsection per `dev-setup` command),
  **Project Structure**, **Architecture Overview**, **Testing**, and **Pull Request
  Requirements**.
- When a planned feature is implemented, remove its **(planned)** marker in the README and
  update `docs/portfolio-entry.json` (the portfolio site's project entry) so its
  `description` and `technologies` describe only what is built, plus a short "In progress:"
  sentence for what's next.

## Pull request rules

Every PR into `master` must satisfy all of the following before it is opened or merged.
CI enforces these in `.github/workflows/pr-checks.yml`.

1. **No unresolved TODOs.** Changed files under `src/` and `tests/` must not contain `TODO`
   comments. Resolve the work, or remove the comment and track it elsewhere (e.g. an issue).
2. **All unit tests pass.**
3. **At least 80% coverage for every updated file.** Each changed `src/**/*.ts` file needs
   >= 80% lines, statements, functions, and branches. Use the `typescript-dev-workflow:generate-jest-tests` skill to
   add or extend tests.
4. **Code documentation.** Every exported function, class, constant, interface, type, and enum
   in a changed `src/**/*.ts` file has a JSDoc (`/** ... */`) comment directly above it.
5. **Project documentation updated.** A PR that changes `src/` must also update `README.md`
   (or `docs/**`) to reflect the change — commands, features, project structure, architecture.

Use the `shared-dev-workflow:generate-docs` skill to write the code and project documentation for changed files.

Verify locally before creating a PR:

```bash
pnpm test:pr      # run tests and write coverage/coverage-summary.json
pnpm check:pr     # check changed files vs origin/master
```

Do not create a PR, or declare PR-bound work finished, while `pnpm check:pr` fails.
