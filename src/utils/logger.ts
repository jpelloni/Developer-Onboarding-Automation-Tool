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