import { Command } from "commander";
import { DependencyService } from '../services/dependency.service.js';
import { Logger } from '../utils/logger.js';

/**
 * Builds the `init` command, which starts the developer onboarding setup.
 *
 * When run, it creates a {@link Logger} from the global `--verbose` and `--debug` options,
 * then checks that Node.js and pnpm are installed and meet the minimum versions. Dependency
 * failures are logged rather than thrown.
 *
 * @returns The `init` command, which `src/cli.ts` adds to the program through the registry.
 */
export default function createInitCommand(): Command {
    return new Command('init')
        .description('Initialize the developer onboarding setup')
        .action(async (_options: unknown, command: Command) => {
            const options = command.optsWithGlobals();
            const logger = new Logger(options['verbose'], options['debug']);
            logger.log('Developer onboarding setup initialized.');
            await DependencyService.checkDependencies(['node', 'pnpm'], logger);
        });
}
