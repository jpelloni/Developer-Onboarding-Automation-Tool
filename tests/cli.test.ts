import { Command } from 'commander';

const { jest } = import.meta;

const fooAction = jest.fn();
const commandFactories: Array<() => Command> = [];

jest.unstable_mockModule('../src/commands/registry.js', () => ({ commandFactories }));

const { createProgram } = await import('../src/cli.js');

const setCommands = (...names: string[]): void => {
    commandFactories.splice(0, commandFactories.length, ...names.map((name) => () => new Command(name).action(fooAction)));
};

beforeEach(() => {
    jest.clearAllMocks();
    setCommands('foo');
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

    it('adds every command from the registry, in registry order', () => {
        setCommands('foo', 'bar', 'baz');

        const program = createProgram();

        expect(program.commands.map((command) => command.name())).toEqual(['foo', 'bar', 'baz']);
    });

    it('creates fresh command instances for each program', () => {
        const first = createProgram();
        const second = createProgram();

        expect(first.commands[0]).not.toBe(second.commands[0]);
    });

    it('has no commands when the registry is empty', () => {
        setCommands();

        const program = createProgram();

        expect(program.commands).toEqual([]);
    });

    it('throws when two commands share a name', () => {
        setCommands('foo', 'foo');

        expect(() => createProgram()).toThrow("cannot add command 'foo'");
    });

    it('parses global flags before running a command', async () => {
        const program = createProgram();

        await program.parseAsync(['--verbose', '--debug', 'foo'], { from: 'user' });

        expect(fooAction).toHaveBeenCalledTimes(1);
        expect(program.opts()).toEqual({ verbose: true, debug: true });
    });
});
