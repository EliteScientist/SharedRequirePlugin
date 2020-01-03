/*import webpack from "webpack";
import sources from "webpack-sources";

import Module       = webpack.compilation.Module;
import RawSource    = sources.RawSource;
*/
const Module = require("webpack").Module;
const Template = require("webpack").Template;
const RawSource = require("webpack-sources").RawSource;
//const OriginalSource    = require("webpack-sources").OriginalSource;
const pluginName = "SharedRequirePlugin";
class SharedRequirePlugin {
    /**
     * Constructor
     * @param options
     */
    constructor(options) {
        const userOptions = options || {};
        const defaultOptions = {
            provider: false,
            externalModules: [],
            globalModulesRequire: "requireSharedModule"
        };
        this.options = Object.assign(defaultOptions, userOptions);
    }
    /**
     * Plugin Compilation Entry Point
     * @param compiler
     */
    apply(compiler) {
        // Begin Compilation
        if (this.options.provider) {
            compiler.hooks.compilation.tap(pluginName, (compilation, params) => {
                const { mainTemplate, chunkTemplate, moduleTemplates, runtimeTemplate } = compilation;
                mainTemplate.hooks.beforeStartup.tap(pluginName, (source, chunk, hash) => {
                    const buf = [];
                    buf.push("// Global Module Provider Function");
                    buf.push("window.requireSharedModule = function (moduleId)");
                    buf.push("{");
                    buf.push(Template.indent(`return ${mainTemplate.requireFn}(moduleId);`));
                    buf.push("}");
                    return Template.asString(buf);
                });
                compilation.hooks.optimizeModuleIds.tap(pluginName, (modules) => {
                    modules.forEach(function (module) {
                        if ("rawRequest" in module) {
                            let request = module.rawRequest;
                            if (module.id === 0) // Do not change the root (We may be able to simply change all modules that do not have an id of 0)
                                return;
                            if (request.charAt(0) === "." || request.charAt(0) === "/") // Relative Paths
                                return;
                            if (request.charAt(1) === ":") // Windows Drives
                                return;
                            if (request.charAt(2) === "!") // Loaders
                                return;
                            module.id = request;
                        }
                    });
                });
            });
        }
        // Get Module Factory
        compiler.hooks.normalModuleFactory.tap(pluginName, factory => {
            if (!this.options.provider) {
                // If we're not creating a pod then tap into factory's module creation to injecty our External Access Module
                factory.hooks.module.tap(pluginName, this.processModule.bind(this));
            }
        });
    }
    processModule(mod, context) {
        if (this.options.externalModules.indexOf(mod.rawRequest) > -1)
            return new ExternalAccessModule(mod, context, this.options);
        return mod;
    }
    /**
     * Process the AST documents found by webpack's parser
     *
     * @param ast AST instance
     * @param comments Code comment blocks
     */
    processAst(ast, comments) {
        // TODO:
    }
}
class ExternalAccessModule extends Module {
    constructor(mod, context, options) {
        super("javascript/dynamic", context);
        this.options = options;
        // Info from Factory
        this.request = mod.rawRequest;
        this.ident = this.request;
    }
    libIdent() {
        return this.ident;
    }
    identifier() {
        return this.ident;
    }
    readableIdentifier() {
        return this.ident;
    }
    needRebuild(fileTimestamps, contextTimestamps) { return false; }
    size() { return 12; }
    updateHash(hash) {
        hash.update(this.identifier());
        super.updateHash(hash);
    }
    source(dependencyTemplates, runtime) {
        // TODO: Make log console error if the glboalModulesRequire method doesn't exist or the module doesn't exist.
        let src = `module.exports = window.${this.options.globalModulesRequire}("${this.request}");`;
        return new RawSource(src);
    }
    build(options, compilation, resolver, fs, callback) {
        this.built = true;
        this.buildMeta = {};
        this.buildInfo = {};
        callback();
    }
}
class SharedRequirePluginOptions {
}
module.exports = SharedRequirePlugin;
