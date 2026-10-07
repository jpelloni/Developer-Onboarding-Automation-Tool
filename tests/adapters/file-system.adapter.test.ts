import { FileSystemError } from '../../src/utils/errors.js';

const { jest } = import.meta;

const fsConstants = { F_OK: 0, COPYFILE_EXCL: 1 };
const access = jest.fn<Promise<void>, [string, number]>();
const copyFile = jest.fn<Promise<void>, [string, string, number]>();
const readFile = jest.fn<Promise<string>, [string, string]>();
const readdir = jest.fn<Promise<string[]>, [string]>();
const mkdir = jest.fn<Promise<string | undefined>, [string, { recursive: boolean }]>();
const writeFile = jest.fn<Promise<void>, [string, string, { encoding: string; flag: string }]>();

jest.unstable_mockModule('node:fs/promises', () => ({
    access, copyFile, readFile, readdir, mkdir, writeFile, constants: fsConstants,
}));

const { FileSystemAdapter } = await import('../../src/adapters/file-system.adapter.js');

const errnoError = (code: string): NodeJS.ErrnoException =>
    Object.assign(new Error(`${code}: operation failed`), { code });

beforeEach(() => {
    access.mockReset().mockResolvedValue(undefined);
    copyFile.mockReset().mockResolvedValue(undefined);
    readFile.mockReset().mockResolvedValue('PORT=3000\n');
    readdir.mockReset().mockResolvedValue([]);
    mkdir.mockReset().mockResolvedValue(undefined);
    writeFile.mockReset().mockResolvedValue(undefined);
});

describe('FileSystemAdapter', () => {
    describe('exists', () => {
        it('checks the path with F_OK', async () => {
            await FileSystemAdapter.exists('.env.example');

            expect(access).toHaveBeenCalledWith('.env.example', fsConstants.F_OK);
        });

        it('returns true when the path exists', async () => {
            const result = await FileSystemAdapter.exists('.env.example');

            expect(result).toBe(true);
        });

        it('returns false when the path does not exist', async () => {
            access.mockRejectedValue(errnoError('ENOENT'));

            const result = await FileSystemAdapter.exists('.env.example');

            expect(result).toBe(false);
        });

        it('throws a FileSystemError, keeping the cause, for other failures', async () => {
            const cause = errnoError('EACCES');
            access.mockRejectedValue(cause);

            const error = await FileSystemAdapter.exists('.env.example').catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect((error as Error).message).toBe('Failed to check whether ".env.example" exists.');
            expect((error as Error).cause).toBe(cause);
        });

        it('wraps non-Error failures in an Error cause', async () => {
            access.mockRejectedValue('disk unavailable');

            const error = await FileSystemAdapter.exists('.env.example').catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect(((error as Error).cause as Error).message).toBe('disk unavailable');
        });
    });

    describe('copyFileIfAbsent', () => {
        it('copies with COPYFILE_EXCL so the destination is never overwritten', async () => {
            await FileSystemAdapter.copyFileIfAbsent('.env.example', '.env');

            expect(copyFile).toHaveBeenCalledWith('.env.example', '.env', fsConstants.COPYFILE_EXCL);
        });

        it('returns true when the file was copied', async () => {
            const result = await FileSystemAdapter.copyFileIfAbsent('.env.example', '.env');

            expect(result).toBe(true);
        });

        it('returns false when the destination already exists', async () => {
            copyFile.mockRejectedValue(errnoError('EEXIST'));

            const result = await FileSystemAdapter.copyFileIfAbsent('.env.example', '.env');

            expect(result).toBe(false);
        });

        it('throws a FileSystemError, keeping the cause, for other failures', async () => {
            const cause = errnoError('ENOENT');
            copyFile.mockRejectedValue(cause);

            const error = await FileSystemAdapter.copyFileIfAbsent('.env.example', '.env').catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect((error as Error).message).toBe('Failed to copy ".env.example" to ".env".');
            expect((error as Error).cause).toBe(cause);
        });
    });

    describe('readTextFile', () => {
        it('reads the file as UTF-8', async () => {
            await FileSystemAdapter.readTextFile('.env');

            expect(readFile).toHaveBeenCalledWith('.env', 'utf8');
        });

        it('returns the file contents', async () => {
            const result = await FileSystemAdapter.readTextFile('.env');

            expect(result).toBe('PORT=3000\n');
        });

        it('throws a FileSystemError, keeping the cause, when the file cannot be read', async () => {
            const cause = errnoError('ENOENT');
            readFile.mockRejectedValue(cause);

            const error = await FileSystemAdapter.readTextFile('.env').catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect((error as Error).message).toBe('Failed to read ".env".');
            expect((error as Error).cause).toBe(cause);
        });
    });

    describe('listDirectory', () => {
        it('returns the entry names', async () => {
            readdir.mockResolvedValue(['package.json', 'src']);

            const result = await FileSystemAdapter.listDirectory('my-service');

            expect(readdir).toHaveBeenCalledWith('my-service');
            expect(result).toEqual(['package.json', 'src']);
        });

        it('returns null when the directory does not exist', async () => {
            readdir.mockRejectedValue(errnoError('ENOENT'));

            const result = await FileSystemAdapter.listDirectory('my-service');

            expect(result).toBeNull();
        });

        it('throws a FileSystemError, keeping the cause, for other failures', async () => {
            const cause = errnoError('ENOTDIR');
            readdir.mockRejectedValue(cause);

            const error = await FileSystemAdapter.listDirectory('my-service').catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect((error as Error).message).toBe('Failed to read the directory "my-service".');
            expect((error as Error).cause).toBe(cause);
        });
    });

    describe('writeFileIfAbsent', () => {
        it('creates the parent directories', async () => {
            await FileSystemAdapter.writeFileIfAbsent('my-service/src/index.ts', 'code');

            expect(mkdir).toHaveBeenCalledWith('my-service/src', { recursive: true });
        });

        it('writes UTF-8 with the wx flag so an existing file is never overwritten', async () => {
            await FileSystemAdapter.writeFileIfAbsent('my-service/src/index.ts', 'code');

            expect(writeFile).toHaveBeenCalledWith('my-service/src/index.ts', 'code', { encoding: 'utf8', flag: 'wx' });
        });

        it('returns true when the file was written', async () => {
            const result = await FileSystemAdapter.writeFileIfAbsent('my-service/src/index.ts', 'code');

            expect(result).toBe(true);
        });

        it('returns false when the file already exists', async () => {
            writeFile.mockRejectedValue(errnoError('EEXIST'));

            const result = await FileSystemAdapter.writeFileIfAbsent('my-service/src/index.ts', 'code');

            expect(result).toBe(false);
        });

        it('throws a FileSystemError, keeping the cause, when a directory cannot be created', async () => {
            const cause = errnoError('EACCES');
            mkdir.mockRejectedValue(cause);

            const error = await FileSystemAdapter.writeFileIfAbsent('my-service/src/index.ts', 'code')
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(FileSystemError);
            expect((error as Error).message).toBe('Failed to write "my-service/src/index.ts".');
            expect((error as Error).cause).toBe(cause);
            expect(writeFile).not.toHaveBeenCalled();
        });
    });
});
