import { Command } from "commander";
import { createInitCommand } from './commands/init.command.js';

/**
 * Builds the `dev-setup` command-line program with its global options and commands.
 *
 * The program isn't parsed here, so callers decide which arguments to parse
 * (`process.argv` in `index.ts`, or a fixed list in tests).
 *
 * @returns A configured `commander` program, ready to parse.
 */
export const createProgram = (): Command =>
    new Command()
        .name('dev-setup')
        .description('CLI for automating developer onboarding tasks')
        .version('1.0.0')
        .option('-v, --verbose', 'Enable verbose logging')
        .option('-d, --debug', 'Enable debug mode')
        .addCommand(createInitCommand());
