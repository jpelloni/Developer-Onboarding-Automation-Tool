import { NODE_VERSION } from '../config/constants.js';

export function checkDependency(dependency: string): boolean {
    try {
        switch (dependency) {
            case 'node':
                if (Number(process.versions.node.split('.')[0]) < Number(NODE_VERSION.replace(/^v/, '').split('.')[0])) {
                    console.warn(`Node.js ${NODE_VERSION} or newer is required; found ${process.version}.`);
                    return false;
                }
                console.info(`Node version: ${process.version}`);
                break;
            case 'pnpm':
                // Add logic to check pnpm version if needed
               break;
            default: 
                require.resolve(dependency);
                console.info(`Dependency "${dependency}" is installed with version ${require(dependency).version}`);
                break;
        }

        return true;
    } catch (e) {
        console.warn(`Dependency "${dependency}" is not installed.`);
        return false;
    }
}

export function checkDependencies(dependencies: string[]): boolean {
    return dependencies.every(checkDependency);
}