import { EventEmitter } from 'node:events';

const { jest } = import.meta;

class FakeInterface extends EventEmitter {
    question = jest.fn<void, [string, (answer: string) => void]>();
    close = jest.fn(() => {
        this.emit('close');
    });
}

let readline: FakeInterface;
const createInterface = jest.fn(() => readline);

jest.unstable_mockModule('node:readline', () => ({ createInterface }));

const { PromptAdapter } = await import('../../src/adapters/prompt.adapter.js');

const stdinIsTTY = process.stdin.isTTY;
const stdoutIsTTY = process.stdout.isTTY;

const setTTY = (stdin: boolean | undefined, stdout: boolean | undefined): void => {
    Object.defineProperty(process.stdin, 'isTTY', { value: stdin, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: stdout, configurable: true });
};

beforeEach(() => {
    readline = new FakeInterface();
    createInterface.mockClear();
});

afterAll(() => {
    setTTY(stdinIsTTY, stdoutIsTTY);
});

describe('PromptAdapter', () => {
    describe('isInteractive', () => {
        it('returns true when stdin and stdout are terminals', () => {
            setTTY(true, true);

            expect(PromptAdapter.isInteractive()).toBe(true);
        });

        it.each([[false, true], [true, undefined], [undefined, undefined]])(
            'returns false when stdin.isTTY is %p and stdout.isTTY is %p', (stdin, stdout) => {
                setTTY(stdin, stdout);

                expect(PromptAdapter.isInteractive()).toBe(false);
            });
    });

    describe('ask', () => {
        it('prints the question on the terminal and resolves with the answer', async () => {
            readline.question.mockImplementation((_question, callback) => callback('d'));

            await expect(PromptAdapter.ask('Which? ')).resolves.toBe('d');
            expect(createInterface).toHaveBeenCalledWith({ input: process.stdin, output: process.stdout });
            expect(readline.question).toHaveBeenCalledWith('Which? ', expect.any(Function));
            expect(readline.close).toHaveBeenCalled();
        });

        it('resolves with null when input ends before an answer', async () => {
            readline.question.mockImplementation(() => {
                readline.emit('close');
            });

            await expect(PromptAdapter.ask('Which? ')).resolves.toBeNull();
        });
    });
});
