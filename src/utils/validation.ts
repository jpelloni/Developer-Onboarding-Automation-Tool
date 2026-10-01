interface ParsedVersion {
    core: number[];
    preRelease: string[];
}

const NUMERIC_IDENTIFIER = /^\d+$/;

const parseVersion = (version: string): ParsedVersion => {
    const [withoutBuild] = version.trim().replace(/^v/, '').split('+');
    const dashIndex = withoutBuild.indexOf('-');
    const coreText = dashIndex === -1 ? withoutBuild : withoutBuild.slice(0, dashIndex);
    const preReleaseText = dashIndex === -1 ? '' : withoutBuild.slice(dashIndex + 1);

    return {
        core: coreText.split('.').map((part) => Number(part) || 0),
        preRelease: preReleaseText ? preReleaseText.split('.') : [],
    };
};

/**
 * Compares two pre-release identifier lists using SemVer precedence rules.
 *
 * @returns A negative number when `a` has lower precedence than `b`, a positive
 * number when it has higher precedence, and `0` when they are equal.
 */
const comparePreRelease = (a: string[], b: string[]): number => {
    // A version without a pre-release outranks one with a pre-release.
    if (a.length === 0 || b.length === 0) return b.length - a.length;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const aNumeric = NUMERIC_IDENTIFIER.test(a[i]);
        const bNumeric = NUMERIC_IDENTIFIER.test(b[i]);

        if (aNumeric && bNumeric) {
            const diff = Number(a[i]) - Number(b[i]);
            if (diff !== 0) return diff;
        } else if (aNumeric !== bNumeric) {
            // Numeric identifiers have lower precedence than alphanumeric ones.
            return aNumeric ? -1 : 1;
        } else if (a[i] !== b[i]) {
            return a[i] < b[i] ? -1 : 1;
        }
    }

    return a.length - b.length;
};

/**
 * Checks whether a package version meets or exceeds the required version.
 *
 * Versions are compared using SemVer precedence. A single leading `v` and any
 * build metadata (`+...`) are ignored, and missing core components are treated
 * as zero, so `1.2` is equivalent to `1.2.0`. A pre-release version has lower
 * precedence than its release (`1.2.3-beta` < `1.2.3`), and pre-release
 * identifiers are compared field by field (`1.2.3-alpha.2` < `1.2.3-alpha.10`
 * < `1.2.3-beta`).
 *
 * @param packageVersion The installed package version.
 * @param requiredVersion The minimum acceptable version.
 * @returns `true` when the package version is equal to or newer than the
 * required version; otherwise, `false`.
 */
export const compareVersions = (packageVersion: string, requiredVersion: string): boolean => {
    const pv = parseVersion(packageVersion);
    const rv = parseVersion(requiredVersion);

    for (let i = 0; i < Math.max(pv.core.length, rv.core.length); i++) {
        const num1 = pv.core[i] || 0;
        const num2 = rv.core[i] || 0;
        if (num1 > num2) return true;
        if (num1 < num2) return false;
    }

    return comparePreRelease(pv.preRelease, rv.preRelease) >= 0;
};
