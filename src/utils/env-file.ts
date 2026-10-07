const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Lists the variable names defined in the contents of a `.env` file.
 *
 * Each line of the form `KEY=value` or `export KEY=value` defines `KEY`; whitespace around the
 * key and the `=` is ignored. Blank lines, `#` comments, and lines without a valid key (letters,
 * digits, and `_`, not starting with a digit) are skipped. Values are never inspected, so a
 * multi-line quoted value only matters if one of its continuation lines looks like `KEY=value`.
 *
 * @param content The text of a `.env` file. Both `\n` and `\r\n` line endings are accepted.
 * @returns The defined keys in the order they first appear, each listed once.
 */
export const parseEnvKeys = (content: string): string[] => {
    const keys = new Set<string>();

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;

        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = line.slice(0, equalsIndex).trim().replace(/^export\s+/, '');
        if (ENV_KEY.test(key)) keys.add(key);
    }

    return [...keys];
};

/** `.env` file helpers, grouped for namespaced imports. */
export const EnvFile = {
    parseEnvKeys,
};
