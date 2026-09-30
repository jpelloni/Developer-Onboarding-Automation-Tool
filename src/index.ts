import { program } from "commander";
import { DependencyService } from './services/index.js';
import { Logger } from './utils/logger.util.js';

program
    .name('dev-setup')
    .description('CLI for automating developer onboarding tasks')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-d, --debug', 'Enable debug mode');

program.command('init')
    .description('Initialize the developer onboarding setup')
    .action(() => {
        const options = program.opts();
        const logger = new Logger(options['verbose'], options['debug']);
        logger.log('Developer onboarding setup initialized.');
        DependencyService.checkDependencies(['node', 'pnpm'], logger);
    });

program.parse();
