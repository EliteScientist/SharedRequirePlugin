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
const RawModule_1 = __importDefault(require("webpack/lib/RawModule"));
const ProvideSharedPlugin_1 = __importDefault(require("webpack/lib/sharing/ProvideSharedPlugin"));
const pluginName = "SharedRequirePlugin";
class SharedRequirePlugin {
    /**
     * Constructor
     * @param options
     */
    constructor(options) {
        const userOptions = options || {};
        const defaultOptions = {
            globalModulesRequire: "requireSharedModule",
            compatibility: false,
            logMissingShares: true
        };
        this.options = Object.assign(defaultOptions, userOptions);
    }
    /**
     * Plugin Compilation Entry Point
     * @param compiler
     */
    apply(compiler) {
        // Begin Compilation
        if (this.options.provides) {
            const provides = {};
            for (let packageName in this.options.provides) {
                const specs = this.options.provides[packageName];
                if (!specs.shareKey)
                    specs.shareKey = packageName;
                specs.eager = true;
                provides[packageName] = specs;
            }
            new ProvideSharedPlugin_1.default({
                provides: provides,
                shareScope: "global"
            }).apply(compiler);
        }
        // Configure Compiler
        compiler.hooks.compilation.tap(pluginName, (compilation) => {
            // Add Global Shared Requre to template
            compilation.hooks.runtimeRequirementInTree
                .for(webpack_1.RuntimeGlobals.requireScope)
                .tap(pluginName, (chunk, runtimeRequirements) => {
                // We will always need global available for providing and consuming
                runtimeRequirements.add(webpack_1.RuntimeGlobals.global);
                if (this.options.provides) {
                    runtimeRequirements.add(webpack_1.RuntimeGlobals.startupOnlyBefore);
                    runtimeRequirements.add(webpack_1.RuntimeGlobals.require);
                    runtimeRequirements.add(webpack_1.RuntimeGlobals.shareScopeMap);
                    runtimeRequirements.add(webpack_1.RuntimeGlobals.initializeSharing);
                    if (this.options.compatibility)
                        runtimeRequirements.add(webpack_1.RuntimeGlobals.moduleCache);
                    compilation.addRuntimeModule(chunk, new SharedRequirePluginModule_1.SharedRequirePluginModule(this.options));
                }
                return true;
            });
            if (this.options.provides) {
                // Modify Module IDs to be requested id -- provider only. to make modules accessible by requested name
                compilation.hooks.moduleIds.tap(pluginName, (modules) => {
                    modules.forEach((mod) => {
                        var _a, _b;
                        const request = (_a = mod === null || mod === void 0 ? void 0 : mod.rawRequest) !== null && _a !== void 0 ? _a : (_b = mod.rootModule) === null || _b === void 0 ? void 0 : _b.rawRequest;
                        if (request in this.options.provides)
                            this.processModuleId(mod, request, compilation);
                    });
                });
            }
        });
        // Consumer
        if (this.options.consumes || this.options.externalModules) {
            // Module Consumer
            // Get Module Factory
            compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
                // Configure Resolver to resolve external modules
                factory.hooks.resolve.tap(pluginName, this.resolveModule.bind(this));
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
    resolveModule(data, callback) {
        if (this.options.consumes && data.request in this.options.consumes) {
            const runtimeRequirements = new Set([
                webpack_1.RuntimeGlobals.module,
                webpack_1.RuntimeGlobals.require,
                webpack_1.RuntimeGlobals.global
            ]);
            return new RawModule_1.default(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
        }
        else if (this.options.externalModules != null && this.options.externalModules.length > 0) {
            for (let i = 0; i < this.options.externalModules.length; i++) {
                let moduleName = this.options.externalModules[i];
                if (typeof moduleName === "string")
                    moduleName = "^" + moduleName + "$";
                if (data.request.match(moduleName) != null) {
                    const runtimeRequirements = new Set([
                        webpack_1.RuntimeGlobals.module,
                        webpack_1.RuntimeGlobals.require,
                        webpack_1.RuntimeGlobals.global
                    ]);
                    return new RawModule_1.default(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
                }
            }
        }
    }
    getSource(request) {
        let req = JSON.stringify(request);
        const buf = [];
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`module.exports = ${webpack_1.RuntimeGlobals.global}.${this.options.globalModulesRequire}(${req});`)));
        return webpack_1.Template.asString(buf);
    }
}
exports.default = SharedRequirePlugin;
module.exports = SharedRequirePlugin;
