import { MissingDependencyError, VersionError } from '../../src/utils/errors.js';
import type { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

const checkNodeVersion = jest.fn<Promise<void>, [Logger]>();
const checkPnpmVersion = jest.fn<Promise<void>, [Logger]>();

jest.unstable_mockModule('../../src/adapters/node.adapter.js', () => ({
    NodeAdapter: { checkNodeVersion, checkPnpmVersion },
}));

const { checkDependencies } = await import('../../src/services/dependency.service.js');

const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
});

beforeEach(() => {
    checkNodeVersion.mockReset().mockResolvedValue(undefined);
    checkPnpmVersion.mockReset().mockResolvedValue(undefined);
});

describe('checkDependencies', () => {
    it('checks node and pnpm through the NodeAdapter', async () => {
        const logger = createLogger();

        await checkDependencies(['node', 'pnpm'], logger as unknown as Logger);

        expect(checkNodeVersion).toHaveBeenCalledWith(logger);
        expect(checkPnpmVersion).toHaveBeenCalledWith(logger);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs other dependencies as installed without checking them', async () => {
        const logger = createLogger();

        await checkDependencies(['docker'], logger as unknown as Logger);

        expect(logger.info).toHaveBeenCalledWith('Dependency "docker" is installed.');
        expect(checkNodeVersion).not.toHaveBeenCalled();
    });

    it('logs adapter errors with their original type', async () => {
        const logger = createLogger();
        const versionError = new VersionError('Node v1.0.0 is older than the required v20.0.0.');
        checkNodeVersion.mockRejectedValue(versionError);

        await checkDependencies(['node'], logger as unknown as Logger);

        expect(logger.error).toHaveBeenCalledWith(versionError);
    });

    it('keeps checking other dependencies when one fails', async () => {
        const logger = createLogger();
        checkNodeVersion.mockRejectedValue(new MissingDependencyError('Failed to run "node --version".'));

        await checkDependencies(['node', 'pnpm'], logger as unknown as Logger);

        expect(checkPnpmVersion).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('wraps non-Error rejections in an Error before logging', async () => {
        const logger = createLogger();
        checkPnpmVersion.mockRejectedValue('boom');

        await checkDependencies(['pnpm'], logger as unknown as Logger);

        expect(logger.error).toHaveBeenCalledWith(new Error('boom'));
    });
});
