import { Command } from 'commander';
import path from 'node:path';
import { generate } from '../../scripts/generate-commands.mjs';
import { commandFactories } from '../../src/commands/registry.js';
import createInitCommand from '../../src/commands/init.command.js';

describe('commandFactories', () => {
    it('includes the init command', () => {
        expect(commandFactories).toContain(createInitCommand);
    });

    it('contains only factories that return a Command', () => {
        for (const createCommand of commandFactories) {
            expect(createCommand()).toBeInstanceOf(Command);
        }
    });

    it('has a unique name for every command', () => {
        const names = commandFactories.map((createCommand) => createCommand().name());

        expect(new Set(names).size).toBe(names.length);
    });

    it('matches the command files in src/commands', () => {
        const dir = path.resolve(import.meta.dirname, '../../src/commands');

        expect(generate(dir, { check: true })).toBe(true);
    });
});
