import { access, constants, copyFile, readFile } from 'node:fs/promises';
import { FileSystemError } from '../utils/errors.js';

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

const errorCode = (error: unknown): string | undefined =>
    (error as NodeJS.ErrnoException | undefined)?.code;

/**
 * Checks whether a file or directory exists.
 *
 * @param path Path to check, relative to the current directory or absolute.
 * @returns `true` when `path` exists; `false` when it doesn't.
 * @throws {FileSystemError} When the check fails for any reason other than the path not existing.
 */
const exists = async (path: string): Promise<boolean> => {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch (error) {
        if (errorCode(error) === 'ENOENT') return false;
        throw new FileSystemError(`Failed to check whether "${path}" exists.`, toError(error));
    }
};

/**
 * Copies a file, unless the destination already exists. The check and the copy are a single
 * operation, so an existing destination is never overwritten.
 *
 * @param source Path of the file to copy.
 * @param destination Path to copy it to.
 * @returns `true` when the file was copied; `false` when `destination` already exists.
 * @throws {FileSystemError} When the copy fails for any other reason (e.g. `source` is missing
 * or the destination isn't writable).
 */
const copyFileIfAbsent = async (source: string, destination: string): Promise<boolean> => {
    try {
        await copyFile(source, destination, constants.COPYFILE_EXCL);
        return true;
    } catch (error) {
        if (errorCode(error) === 'EEXIST') return false;
        throw new FileSystemError(`Failed to copy "${source}" to "${destination}".`, toError(error));
    }
};

/**
 * Reads a text file as UTF-8.
 *
 * @param path Path of the file to read.
 * @returns The file's contents.
 * @throws {FileSystemError} When the file can't be read (e.g. it's missing or isn't readable).
 */
const readTextFile = async (path: string): Promise<string> => {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        throw new FileSystemError(`Failed to read "${path}".`, toError(error));
    }
};

/**
 * Adapter for the local filesystem, wrapping `node:fs` failures in {@link FileSystemError}.
 */
export const FileSystemAdapter = { exists, copyFileIfAbsent, readTextFile };
