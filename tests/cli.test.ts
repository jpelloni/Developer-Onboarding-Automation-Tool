import { Command } from 'commander';

const { jest } = import.meta;

const initAction = jest.fn();
const createInitCommand = jest.fn(() => new Command('init').action(initAction));

jest.unstable_mockModule('../src/commands/init.command.js', () => ({ createInitCommand }));

const { createProgram } = await import('../src/cli.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('createProgram', () => {
    it('names the program dev-setup', () => {
        const program = createProgram();

        expect(program.name()).toBe('dev-setup');
    });

    it('defines the global --verbose and --debug options', () => {
        const program = createProgram();

        expect(program.options.map((option) => option.long)).toEqual(
            expect.arrayContaining(['--verbose', '--debug']),
        );
    });

    it('registers the init command', () => {
        const program = createProgram();

        expect(program.commands.map((command) => command.name())).toEqual(['init']);
    });

    it('parses global flags before running init', async () => {
        const program = createProgram();

        await program.parseAsync(['--verbose', '--debug', 'init'], { from: 'user' });

        expect(initAction).toHaveBeenCalledTimes(1);
        expect(program.opts()).toEqual({ verbose: true, debug: true });
    });

    it('returns a new program on each call', () => {
        expect(createProgram()).not.toBe(createProgram());
    });
});
