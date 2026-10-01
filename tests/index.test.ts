const { jest } = import.meta;

const parseAsync = jest.fn<Promise<unknown>, []>().mockResolvedValue(undefined);
const createProgram = jest.fn(() => ({ parseAsync }));

jest.unstable_mockModule('../src/cli.js', () => ({ createProgram }));

describe('index', () => {
    it('builds the program and parses the process arguments', async () => {
        await import('../src/index.js');

        expect(createProgram).toHaveBeenCalledTimes(1);
        expect(parseAsync).toHaveBeenCalledWith();
    });
});
