# {{name}}

Created with `dev-setup bootstrap`.

## Getting started

```bash
dev-setup init    # set up in the devcontainer or on this machine, create .env, install, lint, and test
pnpm dev          # run src/index.ts
```

`dev-setup init` asks where to set the project up:

- **Devcontainer** (needs Docker and the [Dev Container CLI](https://github.com/devcontainers/cli)):
  starts the container defined in `.devcontainer/devcontainer.json` (Node.js 24, pnpm, ESLint,
  and Prettier) and installs the dependencies inside it. You can also open the folder in VS Code
  and run **Dev Containers: Reopen in Container**.
- **Local** (needs Node.js 24 and pnpm): installs the dependencies on this machine.

## Scripts

| Script        | What it does                        |
| ------------- | ----------------------------------- |
| `pnpm dev`    | Runs `src/index.ts` with tsx        |
| `pnpm build`  | Compiles `src/` to `dist/` with tsc |
| `pnpm start`  | Runs the compiled `dist/index.js`   |
| `pnpm test`   | Runs the Jest tests in `tests/`     |
| `pnpm lint`   | Lints `src/` with ESLint            |
| `pnpm format` | Formats the project with Prettier   |
