export class DependencyError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'DependencyError';
    }
}

export class VersionError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'VersionError';
    }
}

export class MissingDependencyError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        if (cause) this.cause = cause;
        this.name = 'MissingDependencyError';
    }
}