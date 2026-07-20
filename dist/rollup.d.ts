import { Plugin } from 'rollup';

declare function SharedRequirePlugin(options?: SharedRequirePluginOptions): Plugin;
interface SharedRequirePluginOptions {
    external?: string[];
    externalModules?: (string | RegExp)[];
    externalModulePrefixes?: string[];
    provides?: string[];
    modules?: Record<string, string[]>;
    globalModulesRequire?: string;
    globalModulesRegister?: string;
}

export { SharedRequirePlugin };
