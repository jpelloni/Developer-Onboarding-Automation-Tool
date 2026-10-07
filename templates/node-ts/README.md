# {{name}}

Created with `dev-setup bootstrap`.

## Getting started

```bash
pnpm install
dev-setup init    # check Node.js and pnpm, and create .env from .env.example
pnpm dev          # run src/index.ts
```

## Scripts

| Script        | What it does                        |
| ------------- | ----------------------------------- |
| `pnpm dev`    | Runs `src/index.ts` with tsx        |
| `pnpm build`  | Compiles `src/` to `dist/` with tsc |
| `pnpm start`  | Runs the compiled `dist/index.js`   |
| `pnpm test`   | Runs the Jest tests in `tests/`     |
| `pnpm lint`   | Lints `src/` with ESLint            |
| `pnpm format` | Formats the project with Prettier   |
