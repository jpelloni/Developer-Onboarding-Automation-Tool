import path from 'node:path';
import { generate, TEMPLATE_DIR, TEMPLATE_MODULE } from '../../scripts/generate-templates.mjs';
import { PROJECT_TEMPLATE } from '../../src/config/project-template.js';

const root = path.resolve(import.meta.dirname, '../..');

describe('PROJECT_TEMPLATE', () => {
    it('matches the files in templates/node-ts', () => {
        expect(generate(path.join(root, TEMPLATE_DIR), path.join(root, TEMPLATE_MODULE), { check: true })).toBe(true);
    });

    it('is sorted by path with no duplicates', () => {
        const paths = PROJECT_TEMPLATE.map((file) => file.path);

        expect(paths).toEqual([...new Set(paths)].sort());
    });

    it('stores the gitignore as .gitignore', () => {
        const paths = PROJECT_TEMPLATE.map((file) => file.path);

        expect(paths).toContain('.gitignore');
        expect(paths).not.toContain('_gitignore');
    });

    it('uses the {{name}} placeholder for the package name', () => {
        const packageJson = PROJECT_TEMPLATE.find((file) => file.path === 'package.json');

        expect(JSON.parse(packageJson?.contents ?? '{}').name).toBe('{{name}}');
    });
});
