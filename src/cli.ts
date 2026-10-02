import { Command } from "commander";
import { commandFactories } from './commands/registry.js';

/**
 * Builds the `dev-setup` command-line program with its global options and commands.
 *
 * Commands come from `src/commands/registry.ts`, which `scripts/generate-commands.mjs`
 * generates from the `*.command.ts` files, so adding a command doesn't require editing this
 * file. The program isn't parsed here, so callers decide which arguments to parse
 * (`process.argv` in `index.ts`, or a fixed list in tests).
 *
 * @returns A configured `commander` program, ready to parse.
 * @throws {Error} When two commands share a name (raised by `commander`).
 */
export const createProgram = (): Command => {
    const program = new Command()
        .name('dev-setup')
        .description('CLI for automating developer onboarding tasks')
        .version('1.0.0')
        .option('-v, --verbose', 'Enable verbose logging')
        .option('-d, --debug', 'Enable debug mode');

    for (const createCommand of commandFactories) {
        program.addCommand(createCommand());
    }

    return program;
};
