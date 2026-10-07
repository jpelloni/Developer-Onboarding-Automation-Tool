import { FileSystemError } from '../../src/utils/errors.js';

const { jest } = import.meta;

const fsConstants = { F_OK: 0, COPYFILE_EXCL: 1 };
const access = jest.fn<Promise<void>, [string, number]>();
const copyFile = jest.fn<Promise<void>, [string, string, number]>();
const readFile = jest.fn<Promise<string>, [string, string]>();

jest.unstable_mockModule('node:fs/promises', () => ({ access, copyFile, readFile, constants: fsConstants }));

const { FileSystemAdapter } = await import('../../src/adapters/file-system.adapter.js');

const errnoError = (code: string): NodeJS.ErrnoException =>
    Object.assign(new Error(`${code}: operation failed`), { code });

beforeEach(() => {
    access.mockReset().mockResolvedValue(undefined);
    copyFile.mockReset().mockResolvedValue(undefined);
    readFile.mockReset().mockResolvedValue('PORT=3000\n');
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
});
