// Types for scripts/generate-templates.mjs, so TypeScript tests can import it.

export interface TemplateFileEntry {
    path: string;
    contents: string;
}

export declare const TEMPLATE_DIR: string;
export declare const TEMPLATE_MODULE: string;
export declare const toOutputPath: (relativePath: string) => string;
export declare const listFiles: (dir: string, prefix?: string) => string[];
export declare const readTemplate: (dir: string) => TemplateFileEntry[];
export declare const renderTemplateModule: (files: TemplateFileEntry[]) => string;
export declare const generate: (templateDir: string, modulePath: string, options?: { check?: boolean }) => boolean;
