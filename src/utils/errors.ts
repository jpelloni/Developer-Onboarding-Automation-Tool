/**
 * General failure while checking or setting up a dependency.
 *
 * @param message Description of the failure.
 * @param cause The underlying error, exposed as `cause` when provided.
 */
export class DependencyError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'DependencyError';
    }
}

/**
 * A dependency is installed but its version is older than the required minimum.
 *
 * @param message Description of the version mismatch.
 * @param cause The underlying error, exposed as `cause` when provided.
 */
export class VersionError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'VersionError';
    }
}

/**
 * A dependency isn't installed, or its version command can't be run.
 *
 * @param message Description of the missing dependency.
 * @param cause The underlying error (e.g. the failed process), exposed as `cause` when provided.
 */
export class MissingDependencyError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'MissingDependencyError';
    }
}

/**
 * A filesystem operation (checking, reading, or copying a file) failed.
 *
 * @param message Description of the failed operation.
 * @param cause The underlying error (e.g. an `EACCES` error from `node:fs`), exposed as `cause` when provided.
 */
export class FileSystemError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'FileSystemError';
    }
}
