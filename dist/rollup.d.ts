import { Plugin } from 'rollup';

declare function SharedRequirePlugin(options?: SharedRequirePluginOptions): Plugin;
interface SharedRequirePluginOptions {
    external?: string[];
}

export { SharedRequirePlugin };
