import { greet } from '../src/greet.js';

describe('greet', () => {
    it('greets by name', () => {
        const result = greet('Ada');

        expect(result).toBe('Hello, Ada!');
    });
});
