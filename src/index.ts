import { program } from "commander";
import { dependencyService } from './services/index.js';

program
    .name('dev-setup')
    .description('CLI for automating developer onboarding tasks')
    .version('1.0.0');

program.command('init')
    .description('Initialize the developer onboarding setup')
    .action(() => {
        console.log('Developer onboarding setup initialized.');
    });

// const main = () => {
program.parse();
const options = program.opts();
const args = program.args;
console.log({ options, args });
// };

// main();

dependencyService.checkDependencies(['node', 'pnpm']);