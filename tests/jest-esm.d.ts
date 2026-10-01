/**
 * `@types/jest` types `import.meta.jest` but omits the ESM-only `unstable_mockModule`.
 * This augments the global `jest` namespace so tests using it type-check.
 */
declare namespace jest {
    function unstable_mockModule<T = unknown>(
        moduleName: string,
        moduleFactory: () => T | Promise<T>,
        options?: { virtual?: boolean },
    ): typeof jest;
}
