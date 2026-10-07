import { DependencyError, FileSystemError, MissingDependencyError, VersionError } from '../../src/utils/errors.js';

const errorClasses = [
    ['DependencyError', DependencyError],
    ['VersionError', VersionError],
    ['MissingDependencyError', MissingDependencyError],
    ['FileSystemError', FileSystemError],
] as const;

describe.each(errorClasses)('%s', (name, ErrorClass) => {
    it('is an Error with the given message', () => {
        const error = new ErrorClass('something failed');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ErrorClass);
        expect(error.message).toBe('something failed');
    });

    it(`sets name to "${name}"`, () => {
        const error = new ErrorClass('something failed');

        expect(error.name).toBe(name);
    });

    it('stores the cause when one is provided', () => {
        const cause = new Error('root cause');

        const error = new ErrorClass('something failed', cause);

        expect(error.cause).toBe(cause);
    });

    it('leaves cause unset when none is provided', () => {
        const error = new ErrorClass('something failed');

        expect(error.cause).toBeUndefined();
        expect(Object.hasOwn(error, 'cause')).toBe(false);
    });
});
