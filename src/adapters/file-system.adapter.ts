import { access, constants, copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
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
 * Lists the names of the entries in a directory.
 *
 * @param path Path of the directory.
 * @returns The entry names, or `null` when `path` doesn't exist.
 * @throws {FileSystemError} When `path` isn't a directory or can't be read.
 */
const listDirectory = async (path: string): Promise<string[] | null> => {
    try {
        return await readdir(path);
    } catch (error) {
        if (errorCode(error) === 'ENOENT') return null;
        throw new FileSystemError(`Failed to read the directory "${path}".`, toError(error));
    }
};

/**
 * Writes a UTF-8 text file, creating its parent directories, unless the file already exists.
 * The check and the write are a single operation, so an existing file is never overwritten.
 *
 * @param path Path of the file to write.
 * @param contents Text to write.
 * @returns `true` when the file was written; `false` when it already exists.
 * @throws {FileSystemError} When a directory can't be created or the file can't be written.
 */
const writeFileIfAbsent = async (path: string, contents: string): Promise<boolean> => {
    try {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, contents, { encoding: 'utf8', flag: 'wx' });
        return true;
    } catch (error) {
        if (errorCode(error) === 'EEXIST') return false;
        throw new FileSystemError(`Failed to write "${path}".`, toError(error));
    }
};

/**
 * Adapter for the local filesystem, wrapping `node:fs` failures in {@link FileSystemError}.
 */
export const FileSystemAdapter = { exists, copyFileIfAbsent, readTextFile, listDirectory, writeFileIfAbsent };
