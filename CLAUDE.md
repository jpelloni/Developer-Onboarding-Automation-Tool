# CLAUDE.md

## Pull request rules

Every PR into `master` must satisfy all of the following before it is opened or merged.
CI enforces these in `.github/workflows/pr-checks.yml`.

1. **No unresolved TODOs.** Changed files under `src/` and `tests/` must not contain `TODO`
   comments. Resolve the work, or remove the comment and track it elsewhere (e.g. an issue).
2. **All unit tests pass.**
3. **At least 80% coverage for every updated file.** Each changed `src/**/*.ts` file needs
   >= 80% lines, statements, functions, and branches. Use the `generate-jest-tests` skill to
   add or extend tests.
4. **Code documentation.** Every exported function, class, constant, interface, type, and enum
   in a changed `src/**/*.ts` file has a JSDoc (`/** ... */`) comment directly above it.
5. **Project documentation updated.** A PR that changes `src/` must also update `README.md`
   (or `docs/**`) to reflect the change — commands, features, project structure, architecture.

Use the `generate-docs` skill to write the code and project documentation for changed files.

Verify locally before creating a PR:

```bash
pnpm test:pr      # run tests and write coverage/coverage-summary.json
pnpm check:pr     # check changed files vs origin/master
```

Do not create a PR, or declare PR-bound work finished, while `pnpm check:pr` fails.
