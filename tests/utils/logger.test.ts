import { Logger } from '../../src/utils/logger.js';

const { jest } = import.meta;

let infoSpy: jest.SpiedFunction<typeof console.info>;
let warnSpy: jest.SpiedFunction<typeof console.warn>;
let errorSpy: jest.SpiedFunction<typeof console.error>;
let debugSpy: jest.SpiedFunction<typeof console.debug>;
let logSpy: jest.SpiedFunction<typeof console.log>;

beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Logger', () => {
    describe('info', () => {
        it('prints a prefixed message in verbose mode', () => {
            const logger = new Logger(true, false);

            logger.info('hello');

            expect(infoSpy).toHaveBeenCalledWith('[INFO] hello\n');
        });

        it('prints nothing when verbose mode is off', () => {
            const logger = new Logger(false, true);

            logger.info('hello');

            expect(infoSpy).not.toHaveBeenCalled();
        });
    });

    describe('warn', () => {
        it('prints a prefixed message in debug mode', () => {
            const logger = new Logger(false, true);

            logger.warn('careful');

            expect(warnSpy).toHaveBeenCalledWith('[WARN] careful\n');
        });

        it('prints nothing when debug mode is off', () => {
            const logger = new Logger(true, false);

            logger.warn('careful');

            expect(warnSpy).not.toHaveBeenCalled();
        });
    });

    describe('error', () => {
        it('prints the message without the stack when debug mode is off', () => {
            const logger = new Logger(true, false);

            logger.error(new Error('boom'));

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledWith('[ERROR] boom\n');
        });

        it('also prints the stack trace in debug mode', () => {
            const logger = new Logger(false, true);
            const error = new Error('boom');

            logger.error(error);

            expect(errorSpy).toHaveBeenNthCalledWith(1, '[ERROR] boom\n');
            expect(errorSpy).toHaveBeenNthCalledWith(2, error.stack);
        });

        it('prints undefined for the stack when the error has none', () => {
            const logger = new Logger(false, true);
            const error = new Error('boom');
            delete error.stack;

            logger.error(error);

            expect(errorSpy).toHaveBeenNthCalledWith(2, undefined);
        });
    });

    describe('debug', () => {
        it('prints a prefixed message in debug mode', () => {
            const logger = new Logger(false, true);

            logger.debug('details');

            expect(debugSpy).toHaveBeenCalledWith('[DEBUG] details\n');
        });

        it('prints nothing when debug mode is off', () => {
            const logger = new Logger(true, false);

            logger.debug('details');

            expect(debugSpy).not.toHaveBeenCalled();
        });
    });

    describe('log', () => {
        it('always prints a prefixed message', () => {
            const logger = new Logger(false, false);

            logger.log('done');

            expect(logSpy).toHaveBeenCalledWith('[LOG] done\n');
        });
    });
});
