// Enforces the pull request rules on files changed relative to a base ref:
//   1. No TODO comments remain in changed files under src/ or tests/.
//   2. Every changed src/**/*.ts file has >= COVERAGE_THRESHOLD% coverage
//      (lines, statements, functions, and branches).
//   3. Every exported declaration in a changed src/**/*.ts file has a JSDoc
//      (/** ... */) comment directly above it.
//   4. A PR that changes src/ also updates project documentation
//      (README.md or docs/**).
//
// Changed files include uncommitted and untracked work, so this can be run
// locally before committing.
//
// Run `pnpm test:pr` first so coverage/coverage-summary.json exists.
// Usage: node scripts/check-pr.mjs [base-ref]   (default: origin/master)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const baseRef = process.argv[2] ?? process.env.BASE_REF ?? 'origin/master';
const threshold = Number(process.env.COVERAGE_THRESHOLD ?? 80);
const summaryPath = path.resolve('coverage/coverage-summary.json');
const metrics = ['lines', 'statements', 'functions', 'branches'];
const todoPattern = /\bTODO\b/i;
// Exported declarations that need JSDoc. Re-exports (`export * from`, `export { ... }`) are excluded.
const exportPattern = /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+(\w+)/;
const docPattern = /^(README\.md|docs\/.+)$/;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);

const changedFiles = [...new Set([
    ...git('diff', '--name-only', '--diff-filter=ACMR', '--merge-base', baseRef),
    ...git('ls-files', '--others', '--exclude-standard'),
])];

const failures = [];

for (const file of changedFiles.filter((f) => /^(src|tests)\//.test(f))) {
    readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
            if (todoPattern.test(line)) {
                failures.push(`${file}:${index + 1}: unresolved TODO -> ${line.trim()}`);
            }
        });
}

const changedSources = changedFiles.filter((f) => /^src\/.*\.ts$/.test(f));

for (const file of changedSources) {
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
        const match = exportPattern.exec(line);
        if (!match) return;

        let prev = index - 1;
        while (prev >= 0 && lines[prev].trim() === '') prev--;

        let start = prev;
        while (start >= 0 && !lines[start].includes('/*')) start--;

        const hasJsDoc = prev >= 0 && lines[prev].trim().endsWith('*/') && start >= 0 && lines[start].trim().startsWith('/**');
        if (!hasJsDoc) {
            failures.push(`${file}:${index + 1}: exported \`${match[1]}\` is missing a JSDoc comment`);
        }
    });
}

if (changedFiles.some((f) => f.startsWith('src/')) && !changedFiles.some((f) => docPattern.test(f))) {
    failures.push('src/ changed but no documentation was updated (README.md or docs/**)');
}

if (changedSources.length > 0) {
    if (!existsSync(summaryPath)) {
        console.error(`Missing ${summaryPath}. Run \`pnpm test:pr\` first.`);
        process.exit(1);
    }

    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

    for (const file of changedSources) {
        const entry = summary[path.resolve(file)];

        if (!entry) {
            failures.push(`${file}: 0% coverage (not exercised by any test)`);
            continue;
        }

        for (const metric of metrics) {
            const { pct } = entry[metric];
            if (pct < threshold) {
                failures.push(`${file}: ${metric} coverage ${pct}% is below ${threshold}%`);
            }
        }
    }
}

if (failures.length > 0) {
    console.error(`PR checks failed against ${baseRef}:\n`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
}

console.log(
    `PR checks passed: ${changedFiles.length} changed file(s), ` +
    `${changedSources.length} source file(s) at >= ${threshold}% coverage, no TODOs, code and project docs updated.`,
);
