"use strict";
/*
   MIT License

    Copyright (c) 2020 Michael Rochelle <@EliteScientist>

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
 
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SharedRequirePluginModule_1 = require("./SharedRequirePluginModule");
const webpack_1 = require("webpack");
const webpack_sources_1 = require("webpack-sources");
const identifier_1 = require("webpack/lib/util/identifier");
const RawModule_1 = __importDefault(require("webpack/lib/RawModule"));
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
            globalModulesRequire: "requireSharedModule",
            compatibility: false
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
            // Module Provider
            // Configure Compiler
            compiler.hooks.compilation.tap(pluginName, (compilation) => {
                // Add Global Shared Requre to template
                compilation.hooks.runtimeRequirementInTree
                    .for(webpack_1.RuntimeGlobals.requireScope)
                    .tap(pluginName, (chunk, runtimeRequirements) => {
                    runtimeRequirements.add(webpack_1.RuntimeGlobals.startupOnlyBefore);
                    compilation.addRuntimeModule(chunk, new SharedRequirePluginModule_1.SharedRequirePluginModule(this.options.globalModulesRequire, this.options.compatibility));
                    return true;
                });
                /*compilation.hooks.additionalChunkRuntimeRequirements.tap(pluginName, (chunk, runtimeRequirements) =>
                {
                    runtimeRequirements.add(RuntimeGlobals.startupOnlyBefore);
                    compilation.addRuntimeModule(chunk, new SharedRequirePluginModule(this.options.globalModulesRequire, this.options.compatibility));
                });
                */
                // Modify Module IDs to be requested id
                compilation.hooks.moduleIds.tap(pluginName, (modules) => {
                    modules.forEach((mod) => {
                        if ("rawRequest" in mod) {
                            const request = mod.rawRequest;
                            this.processModuleId(mod, request, compilation);
                        }
                        else if ("rootModule" in mod) // Concatenated Module
                         {
                            const request = mod.rootModule.rawRequest;
                            this.processModuleId(mod, request, compilation);
                        }
                    });
                });
            });
        }
        else if (this.options.externalModules && this.options.externalModules.length > 0) {
            // Module Consumer
            // Get Module Factory
            compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
                // Configure Resolver to resolve external modules
                factory.hooks.resolve.tap(pluginName, this.resolveModule.bind(this, webpack_1.Compilation));
                /*
                factory.hooks.resolver.tap(pluginName, resolver =>
                {
                    let extResolver = new ExternalResolver(this.options, resolver)
                    return extResolver.apply.bind(extResolver);
                });*/
                // Create external access module for external modules. The ExternalAccessModule returns JS to acquire the module from the provider.
                //factory.hooks.module.tap(pluginName, this.processModule.bind(this));
            });
        }
    }
    processModuleId(mod, request, compilation) {
        const moduleId = compilation.chunkGraph.getModuleId(mod);
        if (moduleId === 0) // Do not change the root (We may be able to simply change all modules that do not have an id of 0)
            return;
        if (request.charAt(0) === "." || request.charAt(0) === "/") // Relative Paths
            return;
        if (request.charAt(1) === ":") // Windows Drives
            return;
        if (request.indexOf("!") > -1) // Loaders
            return;
        compilation.chunkGraph.setModuleId(mod, request);
    }
    processModule(mod, context) {
        for (let i = 0; i < this.options.externalModules.length; i++) {
            let moduleName = this.options.externalModules[i];
            if (typeof moduleName === "string")
                moduleName = "^" + moduleName + "$";
            if (mod.rawRequest.match(moduleName) != null)
                return new ExternalAccessModule(mod, this.options);
        }
        return mod;
    }
    resolveModule(compilation, data, callback) {
        if (this.options.externalModules != null && this.options.externalModules.length > 0) {
            for (let i = 0; i < this.options.externalModules.length; i++) {
                let moduleName = this.options.externalModules[i];
                if (typeof moduleName === "string")
                    moduleName = "^" + moduleName + "$";
                if (data.request.match(moduleName) != null) {
                    const runtimeRequirements = new Set([
                        webpack_1.RuntimeGlobals.module,
                        webpack_1.RuntimeGlobals.require
                    ]);
                    return new RawModule_1.default(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
                }
            }
        }
    }
    getSource(request) {
        let req = JSON.stringify(request);
        const buf = [];
        //buf.push("(module, exports) =>")
        //buf.push("{");
        buf.push(webpack_1.Template.indent("try"));
        buf.push(webpack_1.Template.indent("{"));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`module.exports = ${webpack_1.RuntimeGlobals.global}.${this.options.globalModulesRequire}(${req});`)));
        buf.push(webpack_1.Template.indent("}"));
        buf.push(webpack_1.Template.indent("catch (error)"));
        buf.push(webpack_1.Template.indent("{"));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent("module.exports = null; // Shared System/Module not available")));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`console.warn('Request for shared module: ${req} - Not available.');`)));
        buf.push(webpack_1.Template.indent("}"));
        //buf.push("}");
        return webpack_1.Template.asString(buf);
    }
}
exports.default = SharedRequirePlugin;
/**
 * External Access Module
 *
 * This module creates mechanism to retrieve modules that are provided by the provider application.
 */
class ExternalAccessModule extends webpack_1.Module {
    constructor(mod, options) {
        super("javascript/dynamic", mod.context);
        this.options = options;
        // Info from Factory
        this.request = mod.rawRequest;
        this.ident = mod.ident;
        this.libIdent = mod.libIdent;
        //this._hash			= mod.hash;
        //this.renderedHash	= mod.renderedHash;
        //this.resolveOptions = mod.resolveOptions;
        //this.reasons		= mod.reasons;
        this.id = this.request;
        //this.index			= mod.index;
        //this.index2			= mod.index2;
        //this.depth			= mod.depth;
        this.buildMeta = undefined; //{};
        this.buildInfo = undefined; // {cacheable: true};
    }
    libIdent(options) {
        return (0, identifier_1.contextify)(options.context, this.userRequest);
    }
    identifier() {
        return this.request;
    }
    readableIdentifier(requestShortener) {
        return requestShortener.shorten(this.request);
    }
    needBuild(context, callback) { callback(null, false); }
    size(type) { return 12; }
    updateHash(hash, context) {
        hash.update(this.identifier());
        super.updateHash(hash, context);
    }
    source(dependencyTemplates, runtime, type) {
        // TODO: Make log console error if the glboalModulesRequire method doesn't exist or the module doesn't exist.
        let req = JSON.stringify(this.request);
        const buf = [];
        buf.push("try");
        buf.push("{");
        buf.push(webpack_1.Template.indent(`module.exports = window.${this.options.globalModulesRequire}(${req});`));
        buf.push("}");
        buf.push("catch (error)");
        buf.push("{");
        buf.push(webpack_1.Template.indent("module.exports = null; // Shared System/Module not available"));
        buf.push(webpack_1.Template.indent(`console.warn('Request for shared module: ${req} - Not available.');`));
        buf.push("}");
        return new webpack_sources_1.RawSource(webpack_1.Template.asString(buf));
    }
    build(options, compilation, resolver, fs, callback) {
        //this.built      = true;
        this.buildMeta = {};
        this.buildInfo = { cacheable: true };
        callback();
    }
    toString() {
        return `Module: ${this.request}`;
    }
}
/**
 * External Resolver
 *
 * Resolves external components. Prevents resolution error from occuring while building for components not compiled into this application.
 */
class ExternalResolver {
    constructor(options, resolver) {
        this.options = options;
        this.parentResolver = resolver;
    }
    apply(data, callback) {
        if (this.options.externalModules != null && this.options.externalModules.length > 0) {
            for (let i = 0; i < this.options.externalModules.length; i++) {
                let moduleName = this.options.externalModules[i];
                if (typeof moduleName === "string")
                    moduleName = "^" + moduleName + "$";
                if (data.request.match(moduleName) != null) {
                    callback(null, { type: "shared", resource: data.request, path: data.request, query: data.request, request: data.request, rawRequest: data.request, resolved: true, externalLibrary: true, settings: {} });
                    return true;
                }
            }
        }
        this.parentResolver(data, callback);
    }
}
module.exports = SharedRequirePlugin;
