---
name: generate-docs
description: Write the code documentation (JSDoc) and project documentation (README.md / docs/**) required by this repo's PR policy for files changed on the current branch of this CLI (dev-setup). Use when the user asks to document changes, add JSDoc, update the README for a change, get a branch ready for a PR, or invokes /generate-docs. This is a development-workflow tool for building the CLI itself — never wire it into the CLI's own command list (src/commands, src/index.ts).
---

# Generate documentation for changed files

Brings the current branch into line with PR rules 4 and 5 in `CLAUDE.md`:

- **Code documentation:** every exported declaration in a changed `src/**/*.ts` file has a
  JSDoc (`/** ... */`) comment directly above it.
- **Project documentation:** a change to `src/` comes with a matching update to `README.md`
  (or `docs/**`).

`scripts/check-pr.mjs` enforces both rules in CI. This is a Claude Code workflow for developing
this repo. It is **not** a `dev-setup` CLI feature, so never add it to `src/commands/` or
`src/index.ts`.

## 1. Find the target files

- If the user named files or a directory, use those and skip the rest of this step.
- Otherwise collect everything changed relative to the base branch (default `origin/master`,
  or the ref the user gives), including uncommitted and untracked work:

  ```bash
  git diff --name-only --diff-filter=ACMR --merge-base origin/master
  git ls-files --others --exclude-standard
  ```

- Keep the files under `src/` for JSDoc. Keep the full list for deciding what the README needs.
- If nothing under `src/` changed, say so and stop. The policy doesn't require docs then.

## 2. Understand what changed

For each target file:

- Read the whole file, and look at its diff (`git diff --merge-base origin/master -- <file>`)
  to see what is new or different.
- Read its direct imports enough to describe parameters, return values, and thrown errors
  accurately. Don't guess at behavior. If a function's intent is unclear, say so instead of
  inventing documentation.

## 3. Write the JSDoc

Required: every top-level `export function | class | const | let | interface | type | enum`
(also with `default`, `async`, or `abstract`). Re-exports (`export * from`, `export { ... }`)
don't need comments.

Encouraged, not enforced: public class methods, and non-trivial internal helpers when the
surrounding file already documents its helpers.

Match the existing style. `src/utils/validation.ts` is the reference:

```ts
/**
 * Checks whether a package version meets or exceeds the required version.
 *
 * Versions are compared using SemVer precedence. A single leading `v` and any
 * build metadata (`+...`) are ignored ...
 *
 * @param packageVersion The installed package version.
 * @param requiredVersion The minimum version required.
 * @returns `true` if `packageVersion` is greater than or equal to `requiredVersion`.
 */
export const compareVersions = (packageVersion: string, requiredVersion: string): boolean => {
```

Conventions:

- Start with a one-line summary sentence in the present tense ("Checks…", "Returns…").
  Add a paragraph after it only for behavior a caller needs and can't see in the signature:
  edge cases, normalization, side effects such as logging or shelling out.
- `@param name Description.` for each parameter, in order. No `{type}`: TypeScript supplies
  the types.
- `@returns` for non-void functions. For `Promise<void>`, describe what completing means only
  when that isn't obvious.
- `@throws {ErrorClass} When…` for every typed error from `src/utils/errors.ts` that can escape
  the function. Leave it out when the function catches and logs errors instead.
- Classes get a summary of what they represent. Constants get one line saying what the value
  is and where it's used (for example, the minimum version `checkDependencies` enforces).
- Put the comment directly above the declaration, with no blank line in between.
- Use 4-space indentation and wrap at about 100 columns, like the surrounding code.
- Only add or change comments. Never change code while documenting it. If you spot a bug,
  report it to the user instead.
- Don't add comments that only repeat the name (`/** The logger. */`).

## 4. Update the project documentation

Compare the changes against `README.md` and update every section the change affects:

| Change in the branch                                        | README section to update                       |
| ----------------------------------------------------------- | ---------------------------------------------- |
| New or changed command, flag, or user-visible behavior      | **Features** (that command's subsection)       |
| Added, removed, or renamed file/directory under `src/` etc. | **Project Structure** tree                     |
| New layer, adapter, or a change in how layers interact      | **Architecture Overview**                      |
| Test tooling, conventions, or scripts changed               | **Testing**                                    |
| New `package.json` script or PR rule                        | **Testing** or **Pull Request Requirements**   |
| New `.claude/skills/*`                                      | Project Structure tree, plus a short usage note |

- Keep the README's tone and formatting: short bullets, fenced examples, tables where it
  already uses them.
- Describe what the code does now, not what the PR did. The README isn't a changelog.
- If a topic would make the README unwieldy, put it in `docs/<topic>.md` and link to it from
  the relevant README section.
- If a change truly has no user- or contributor-visible effect (for example, an internal
  refactor), make the smallest accurate update, such as fixing a renamed file in the Project
  Structure tree. If nothing in the README is affected, tell the user rather than padding the
  docs to satisfy the check.

## 5. Verify before handing back

- Run `pnpm check:pr` (pass the base ref as an argument if it isn't `origin/master`).
  Confirm that no `missing a JSDoc comment` or `no documentation was updated` failures remain.
  Other failures (TODOs, coverage) fall outside this skill: list them for the user and suggest
  `/generate-jest-tests` for coverage.
- Run `pnpm lint` to make sure nothing broke.
- Report which declarations you documented, which README sections you changed, and anything
  you couldn't document confidently.
