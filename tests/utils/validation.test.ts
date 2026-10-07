import { compareVersions, extractVersion, Validation } from '../../src/utils/validation.js';

describe('compareVersions', () => {
    describe('equal versions', () => {
        it('returns true when versions are identical', () => {
            const result = compareVersions('1.2.3', '1.2.3');

            expect(result).toBe(true);
        });

        it('treats missing trailing components as zero on the package side', () => {
            const result = compareVersions('1.2', '1.2.0');

            expect(result).toBe(true);
        });

        it('treats missing trailing components as zero on the required side', () => {
            const result = compareVersions('1.2.0', '1.2');

            expect(result).toBe(true);
        });
    });

    describe('package version newer than required', () => {
        it('returns true when the major component is greater', () => {
            const result = compareVersions('2.0.0', '1.9.9');

            expect(result).toBe(true);
        });

        it('returns true when the minor component is greater', () => {
            const result = compareVersions('1.3.0', '1.2.9');

            expect(result).toBe(true);
        });

        it('returns true when the patch component is greater', () => {
            const result = compareVersions('1.2.4', '1.2.3');

            expect(result).toBe(true);
        });

        it('returns true when the package version has an extra non-zero component', () => {
            const result = compareVersions('1.2.0.1', '1.2');

            expect(result).toBe(true);
        });
    });

    describe('package version older than required', () => {
        it('returns false when the major component is smaller', () => {
            const result = compareVersions('1.9.9', '2.0.0');

            expect(result).toBe(false);
        });

        it('returns false when the minor component is smaller', () => {
            const result = compareVersions('1.2.9', '1.3.0');

            expect(result).toBe(false);
        });

        it('returns false when the patch component is smaller', () => {
            const result = compareVersions('1.2.3', '1.2.4');

            expect(result).toBe(false);
        });

        it('returns false when the required version has an extra non-zero component', () => {
            const result = compareVersions('1.2', '1.2.0.1');

            expect(result).toBe(false);
        });
    });

    describe('numeric comparison', () => {
        it('compares components numerically rather than lexically', () => {
            const result = compareVersions('1.10.0', '1.9.0');

            expect(result).toBe(true);
        });

        it('ignores leading zeros within a component', () => {
            const result = compareVersions('1.02.0', '1.2.0');

            expect(result).toBe(true);
        });
    });

    describe('leading "v" prefix', () => {
        it('ignores a leading "v" on the package version', () => {
            const result = compareVersions('v20.11.1', '20.0.0');

            expect(result).toBe(true);
        });

        it('ignores a leading "v" on the required version', () => {
            const result = compareVersions('18.0.0', 'v20.0.0');

            expect(result).toBe(false);
        });

        it('ignores a leading "v" on both versions', () => {
            const result = compareVersions('v1.2.3', 'v1.2.3');

            expect(result).toBe(true);
        });
    });

    describe('non-numeric components', () => {
        it('treats a non-numeric component as zero', () => {
            const result = compareVersions('1.x.0', '1.0.0');

            expect(result).toBe(true);
        });

        it('treats an empty version string as zero', () => {
            const result = compareVersions('', '0.0.0');

            expect(result).toBe(true);
        });
    });

    describe('pre-release versions', () => {
        it('compares the core version of a pre-release numerically', () => {
            const result = compareVersions('1.2.3-beta', '1.2.1');

            expect(result).toBe(true);
        });

        it('returns false when a pre-release is compared against its release', () => {
            const result = compareVersions('20.0.0-rc.1', '20.0.0');

            expect(result).toBe(false);
        });

        it('returns true when a release is compared against its pre-release', () => {
            const result = compareVersions('20.0.0', '20.0.0-rc.1');

            expect(result).toBe(true);
        });

        it('returns true when pre-release versions are identical', () => {
            const result = compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1');

            expect(result).toBe(true);
        });

        it('compares alphanumeric identifiers lexically', () => {
            const result = compareVersions('1.0.0-alpha', '1.0.0-beta');

            expect(result).toBe(false);
        });

        it('compares numeric identifiers numerically', () => {
            const result = compareVersions('1.0.0-alpha.10', '1.0.0-alpha.2');

            expect(result).toBe(true);
        });

        it('ranks numeric identifiers below alphanumeric identifiers', () => {
            const result = compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta');

            expect(result).toBe(false);
        });

        it('ranks alphanumeric identifiers above numeric identifiers', () => {
            const result = compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1');

            expect(result).toBe(true);
        });

        it('ranks a shorter identifier list below a longer one with the same prefix', () => {
            const result = compareVersions('1.0.0-alpha', '1.0.0-alpha.1');

            expect(result).toBe(false);
        });

        it('ranks a longer identifier list above a shorter one with the same prefix', () => {
            const result = compareVersions('1.0.0-alpha.1', '1.0.0-alpha');

            expect(result).toBe(true);
        });

        it('treats a pre-release with missing core components as zero-padded', () => {
            const result = compareVersions('1.2-beta', '1.2.0-beta');

            expect(result).toBe(true);
        });

        it('ignores a leading "v" before a pre-release version', () => {
            const result = compareVersions('v1.0.0-rc.2', '1.0.0-rc.1');

            expect(result).toBe(true);
        });
    });

    describe('build metadata', () => {
        it('ignores build metadata when versions are otherwise equal', () => {
            const result = compareVersions('1.0.0+build.5', '1.0.0+build.9');

            expect(result).toBe(true);
        });

        it('ignores build metadata after a pre-release', () => {
            const result = compareVersions('1.0.0-beta+exp.sha.5114f85', '1.0.0');

            expect(result).toBe(false);
        });
    });

    describe('whitespace', () => {
        it('ignores surrounding whitespace such as a trailing newline', () => {
            const result = compareVersions('v20.11.1\n', '20.0.0');

            expect(result).toBe(true);
        });
    });
});

describe('extractVersion', () => {
    it('extracts the version from surrounding text', () => {
        const result = extractVersion('Docker version 27.3.1, build ce12230\n');

        expect(result).toBe('27.3.1');
    });

    it('keeps a leading "v" and drops a trailing newline', () => {
        const result = extractVersion('v24.1.0\n');

        expect(result).toBe('v24.1.0');
    });

    it('keeps pre-release and build metadata', () => {
        const result = extractVersion('tool 1.2.3-rc.1+build.5 (linux)');

        expect(result).toBe('1.2.3-rc.1+build.5');
    });

    it('returns the trimmed output when it contains no version number', () => {
        const result = extractVersion('  unknown\n');

        expect(result).toBe('unknown');
    });
});

describe('Validation', () => {
    it('exposes compareVersions and extractVersion', () => {
        expect(Validation).toEqual({ compareVersions, extractVersion });
    });
});
