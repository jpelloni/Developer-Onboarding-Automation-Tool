import { join } from 'node:path';
import { BootstrapError, FileSystemError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const listDirectory = jest.fn<Promise<string[] | null>, [string]>();
const writeFileIfAbsent = jest.fn<Promise<boolean>, [string, string]>();

jest.unstable_mockModule('../../src/adapters/file-system.adapter.js', () => ({
    FileSystemAdapter: { listDirectory, writeFileIfAbsent },
}));
jest.unstable_mockModule('../../src/config/project-template.js', () => ({
    PROJECT_TEMPLATE: [
        { path: 'README.md', contents: '# {{name}}\n\n{{name}} was bootstrapped.\n' },
        { path: 'src/index.ts', contents: 'export {};\n' },
    ],
}));

const { ProjectBootstrapService: { bootstrapProject } } =
    await import('../../src/services/project-bootstrap.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

const bootstrap = (name: string, options = {}, logger = createLogger()) =>
    bootstrapProject(name, options, logger as unknown as Logger);

beforeEach(() => {
    listDirectory.mockReset().mockResolvedValue(null);
    writeFileIfAbsent.mockReset().mockResolvedValue(true);
});

describe('bootstrapProject', () => {
    it('writes every template file into ./<name>', async () => {
        await bootstrap('my-service');

        expect(writeFileIfAbsent).toHaveBeenCalledTimes(2);
        expect(writeFileIfAbsent).toHaveBeenCalledWith(join('my-service', 'src/index.ts'), 'export {};\n');
    });

    it('replaces every {{name}} placeholder with the project name', async () => {
        await bootstrap('my-service');

        expect(writeFileIfAbsent).toHaveBeenCalledWith(
            join('my-service', 'README.md'), '# my-service\n\nmy-service was bootstrapped.\n');
    });

    it('returns the directory and the written files', async () => {
        const result = await bootstrap('my-service');

        expect(result).toEqual({ directory: 'my-service', files: ['README.md', 'src/index.ts'], skipped: [] });
    });

    it('logs each created file as info and a summary with the next steps', async () => {
        const logger = createLogger();

        await bootstrap('my-service', {}, logger);

        expect(logger.info).toHaveBeenCalledWith('Created my-service/README.md');
        expect(logger.log).toHaveBeenCalledWith(
            'Created 2 file(s) in my-service/. Next steps:\n  cd my-service\n  pnpm install\n  dev-setup init');
    });

    it('accepts an existing empty directory', async () => {
        listDirectory.mockResolvedValue([]);

        const result = await bootstrap('my-service');

        expect(result.files).toHaveLength(2);
    });

    it('reports files that already exist as skipped instead of overwriting them', async () => {
        const logger = createLogger();
        writeFileIfAbsent.mockImplementation(async (path) => !path.endsWith('README.md'));

        const result = await bootstrap('my-service', {}, logger);

        expect(result).toEqual({ directory: 'my-service', files: ['src/index.ts'], skipped: ['README.md'] });
        expect(logger.log).toHaveBeenCalledWith('Left 1 existing file(s) unchanged: README.md');
    });

    it('in a dry run, lists the files without writing them', async () => {
        const logger = createLogger();

        const result = await bootstrap('my-service', { dryRun: true }, logger);

        expect(writeFileIfAbsent).not.toHaveBeenCalled();
        expect(result).toEqual({ directory: 'my-service', files: ['README.md', 'src/index.ts'], skipped: [] });
        expect(logger.log).toHaveBeenCalledWith('Would create 2 file(s) in my-service/:\n  README.md\n  src/index.ts');
    });

    it('throws a BootstrapError when the directory exists and is not empty', async () => {
        listDirectory.mockResolvedValue(['package.json']);

        const error = await bootstrap('my-service').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BootstrapError);
        expect((error as Error).message).toBe('"my-service" already exists and isn\'t empty. Choose another name or remove it.');
        expect(writeFileIfAbsent).not.toHaveBeenCalled();
    });

    it('checks for a non-empty directory even in a dry run', async () => {
        listDirectory.mockResolvedValue(['package.json']);

        await expect(bootstrap('my-service', { dryRun: true })).rejects.toThrow(BootstrapError);
    });

    it.each(['my-service', 'svc2', 'a', 'my.lib_v2', '0day'])('accepts the valid name %p', async (name) => {
        await expect(bootstrap(name)).resolves.toBeDefined();
    });

    it.each(['My-Service', '-svc', '.hidden', '_private', 'a/b', '../escape', 'has space', '', 'a'.repeat(215)])(
        'throws a BootstrapError for the invalid name %p without touching the filesystem',
        async (name) => {
            const error = await bootstrap(name).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(BootstrapError);
            expect((error as Error).message).toContain(`"${name}" isn't a valid project name.`);
            expect(listDirectory).not.toHaveBeenCalled();
        });

    it('propagates FileSystemErrors from writing a file', async () => {
        const error = new FileSystemError('Failed to write "my-service/README.md".');
        writeFileIfAbsent.mockRejectedValue(error);

        await expect(bootstrap('my-service')).rejects.toBe(error);
    });
});
