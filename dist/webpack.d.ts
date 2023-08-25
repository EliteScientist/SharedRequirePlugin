import { Compilation, Module } from 'webpack';

declare class SharedRequirePlugin {
    options: SharedRequirePluginOptions;
    /**
     * Constructor
     * @param options
     */
    constructor(options: any);
    /**
     * Plugin Compilation Entry Point
     * @param compiler
     */
    apply(compiler: any): void;
    processModuleId(mod: any, request: string, compilation: Compilation): void;
    resolveModule(data: any, callback: Function): Module | boolean | undefined;
    getSource(request: any): string;
}
/**
 * Shared Require Plugin Options
 */
interface SharedRequirePluginOptions {
    provides?: {
        [key: string]: {
            eager?: boolean;
            shareKey?: string;
            version?: string;
        };
    };
    consumes?: {
        [key: string]: {
            eager?: boolean;
        };
    };
    modules?: {
        [key: string]: {
            [key: string]: {
                eager?: boolean;
                shareKey?: string;
                version?: string;
            };
        };
    };
    externalModules?: Array<string>;
    globalModulesRequire: string;
    globalModulesRegister: string;
    externalModulePrefixes: string[];
    compatibility: boolean;
    logMissingShares: boolean;
}

export { SharedRequirePlugin, type SharedRequirePluginOptions };
