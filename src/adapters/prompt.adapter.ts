import { createInterface } from 'node:readline';

/**
 * Checks whether `dev-setup` can ask the user a question: both standard input and standard output
 * are terminals. They aren't in CI, or when input is piped or output is redirected.
 *
 * @returns `true` when prompting is possible; otherwise `false`.
 */
const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/**
 * Prints a question and reads one line of input from the terminal.
 *
 * @param question The text to print before the cursor, e.g. `Continue? [y/N] `.
 * @returns The line the user typed, without the line ending, or `null` when input ends (e.g.
 * Ctrl+D) before a line is entered.
 */
const ask = (question: string): Promise<string | null> => new Promise((resolve) => {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    readline.on('close', () => {
        if (!answered) resolve(null);
    });
    readline.question(question, (answer) => {
        answered = true;
        readline.close();
        resolve(answer);
    });
});

/**
 * Adapter for the terminal: detects whether `dev-setup` is running interactively and asks the
 * user questions.
 */
export const PromptAdapter = { isInteractive, ask };
