// Types for scripts/generate-commands.mjs, so TypeScript tests can import it.

export interface CommandModule {
    file: string;
    identifier: string;
}

export declare const REGISTRY_FILE: string;
export declare const hasCode: (source: string) => boolean;
export declare const hasDefaultExport: (source: string) => boolean;
export declare const toIdentifier: (name: string) => string;
export declare const findCommands: (dir: string) => CommandModule[];
export declare const renderRegistry: (commands: CommandModule[]) => string;
export declare const generate: (dir: string, options?: { check?: boolean }) => boolean;
