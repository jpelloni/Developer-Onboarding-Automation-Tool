/**
 * Console logger with prefixed output (`[INFO]`, `[WARN]`, …) whose verbosity is set by the
 * CLI's `--verbose` and `--debug` flags.
 *
 * `info` messages print only in verbose mode. `warn` and `debug` messages print only in debug
 * mode. `error` and `log` always print, and `error` also prints the stack trace in debug mode.
 *
 * @param verbose Whether to print `info` messages.
 * @param debugMode Whether to print `warn` and `debug` messages and error stack traces.
 */
export class Logger {
    private verbose = true;
    private debugMode = true;

    constructor(verbose: boolean, debugMode: boolean) {
        this.verbose = verbose;
        this.debugMode = debugMode;
    }

    info(message: string): void {
        if (!this.verbose) return;
        console.info(`[INFO] ${message}\n`);
    }

    warn(message: string): void {
        if (!this.debugMode) return;
        console.warn(`[WARN] ${message}\n`);
    }

    error(error: Error): void {
        console.error(`[ERROR] ${error.message}\n`);
        if (this.debugMode) console.error(error.stack?.toString());
    }

    debug(message: string): void {
        if (!this.debugMode) return;
        console.debug(`[DEBUG] ${message}\n`);
    }

    log(message: string): void {
        console.log(`[LOG] ${message}\n`);
    }
}