import { join } from 'node:path';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';
import { PROJECT_TEMPLATE } from '../config/project-template.js';
import { BootstrapError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';

const PROJECT_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_PROJECT_NAME_LENGTH = 214;

/** Options for {@link ProjectBootstrapService.bootstrapProject}. */
export interface BootstrapOptions {
    /** List the files that would be created without writing anything. */
    dryRun?: boolean;
}

/** Result of {@link ProjectBootstrapService.bootstrapProject}. */
export interface BootstrapResult {
    /** Directory the project was created in (or, in a dry run, would be created in). */
    directory: string;
    /** Files written, or in a dry run the files that would be written, relative to `directory`. */
    files: string[];
    /** Files left unchanged because they already existed. Always empty in a dry run. */
    skipped: string[];
}

const validateProjectName = (name: string): void => {
    if (!PROJECT_NAME.test(name) || name.length > MAX_PROJECT_NAME_LENGTH) {
        throw new BootstrapError(
            `"${name}" isn't a valid project name. Use lowercase letters, digits, ".", "_", and "-", `
            + `starting with a letter or digit (at most ${MAX_PROJECT_NAME_LENGTH} characters).`);
    }
};

/**
 * Creates a new Node.js + TypeScript + pnpm project in `./<name>` from the project template
 * (`templates/node-ts/`, embedded in `src/config/project-template.ts`), replacing `{{name}}` in
 * each file with `name`.
 *
 * The directory must not exist or must be empty, and an existing file is never overwritten.
 * Logs a summary with the next steps (always printed), and each created file as `info` (verbose
 * mode only). It doesn't install dependencies or initialize Git.
 *
 * @param name Project name, used as the directory name and the `package.json` name. It must be
 * a valid npm package name without a scope: lowercase letters, digits, `.`, `_`, and `-`,
 * starting with a letter or digit.
 * @param options See {@link BootstrapOptions}.
 * @param logger Logger that receives the progress and summary.
 * @returns What was (or would be) created; see {@link BootstrapResult}.
 * @throws {BootstrapError} When `name` is invalid or `./<name>` exists and isn't empty.
 * @throws {FileSystemError} When the directory can't be read or a file can't be written.
 */
async function bootstrapProject(name: string, options: BootstrapOptions, logger: Logger): Promise<BootstrapResult> {
    validateProjectName(name);

    const entries = await FileSystemAdapter.listDirectory(name);
    if (entries && entries.length > 0) {
        throw new BootstrapError(`"${name}" already exists and isn't empty. Choose another name or remove it.`);
    }

    const templateFiles = PROJECT_TEMPLATE.map((file) => ({
        path: file.path,
        contents: file.contents.replaceAll('{{name}}', name),
    }));

    if (options.dryRun) {
        const files = templateFiles.map((file) => file.path);
        logger.log(`Would create ${files.length} file(s) in ${name}/:\n${files.map((file) => `  ${file}`).join('\n')}`);
        return { directory: name, files, skipped: [] };
    }

    const files: string[] = [];
    const skipped: string[] = [];
    for (const file of templateFiles) {
        if (await FileSystemAdapter.writeFileIfAbsent(join(name, file.path), file.contents)) {
            files.push(file.path);
            logger.info(`Created ${name}/${file.path}`);
        } else {
            skipped.push(file.path);
        }
    }

    if (skipped.length > 0) {
        logger.log(`Left ${skipped.length} existing file(s) unchanged: ${skipped.join(', ')}`);
    }
    logger.log(`Created ${files.length} file(s) in ${name}/. Next steps:\n  cd ${name}\n  pnpm install\n  dev-setup init`);

    return { directory: name, files, skipped };
}

/**
 * Service that scaffolds new projects from the project template, delegating file access to
 * `FileSystemAdapter`.
 */
export const ProjectBootstrapService = {
    bootstrapProject,
};
