import { RuntimeModule, RuntimeGlobals, Template } from 'webpack';
import { parseVersionRuntimeCode, versionLtRuntimeCode, rangeToStringRuntimeCode, satisfyRuntimeCode } from 'webpack/lib/util/semver';
import RawModule from 'webpack/lib/RawModule';
import ProvideSharedPlugin from 'webpack/lib/sharing/ProvideSharedPlugin';

/*
   MIT License

    Copyright (c) 2023 Michael Rochelle <@EliteScientist>

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
class SharedRequirePluginModule extends RuntimeModule {
    #options;
    constructor(options) {
        super("SharedRequirePlugin", RuntimeModule.STAGE_ATTACH);
        this.#options = options;
    }
    shouldIsolate() {
        return true;
    }
    generate() {
        const { compilation } = this;
        const { runtimeTemplate } = compilation;
        const buf = [
            parseVersionRuntimeCode(runtimeTemplate),
            versionLtRuntimeCode(runtimeTemplate),
            rangeToStringRuntimeCode(runtimeTemplate),
            satisfyRuntimeCode(runtimeTemplate)
        ];
        buf.push("// Shared-Require Global Module Provider Function");
        buf.push("// Initialize Sharing Scope");
        buf.push(`${RuntimeGlobals.initializeSharing}("global");`);
        // Trace Error
        buf.push(`const getInvalidSingletonVersionMessage = ${runtimeTemplate.basicFunction("key, version, requiredVersion", [
            `return "Unsatisfied version " + version + " of shared singleton module " + key + " (required " + rangeToString(requiredVersion) + ")"`
        ])};`);
        // Ensure Existence
        buf.push(`const ensureExistence = ${runtimeTemplate.basicFunction("scopeName, key", [
            `const scope = ${RuntimeGlobals.shareScopeMap}[scopeName];`,
            `if(!scope || !${RuntimeGlobals.hasOwnProperty}(scope, key)) throw new Error("Shared module " + key + " doesn't exist in shared scope " + scopeName);`,
            "return scope;"
        ])};`);
        // Get Entry
        buf.push(`const get = ${runtimeTemplate.basicFunction("entry", [
            "entry.loaded = 1;",
            "return entry.get()"
        ])};`);
        // Init
        buf.push(`const init = ${runtimeTemplate.returningFunction(Template.asString([
            "function(scopeName, a, b, c) {",
            Template.indent([
                `const promise = ${RuntimeGlobals.initializeSharing}(scopeName);`,
                `if (promise && promise.then) return promise.then(fn.bind(fn, scopeName, ${RuntimeGlobals.shareScopeMap}[scopeName], a, b, c));`,
                `return fn(scopeName, ${RuntimeGlobals.shareScopeMap}[scopeName], a, b, c);`
            ]),
            "}"
        ]), "fn")};`);
        // Find Singleton Version
        buf.push(`const findSingletonVersionKey = ${runtimeTemplate.basicFunction("scope, key", [
            "const versions = scope[key];",
            `return Object.keys(versions).reduce(${runtimeTemplate.basicFunction("a, b", ["return !a || (!versions[a].loaded && versionLt(a, b)) ? b : a;"])}, 0);`
        ])};`);
        // Get Singleton Version
        buf.push(`const getSingletonVersion = ${runtimeTemplate.basicFunction("scope, scopeName, key, requiredVersion", [
            "const version = findSingletonVersionKey(scope, key);",
            "if (requiredVersion &&!satisfy(requiredVersion, version)) " +
                'typeof console !== "undefined" && console.warn && console.warn(getInvalidSingletonVersionMessage(key, version, requiredVersion));',
            "return get(scope[key][version]);"
        ])};`);
        // Load Singleton
        buf.push(`const loadSingleton = /*#__PURE__*/ init(${runtimeTemplate.basicFunction("scopeName, scope, key", [
            "ensureExistence(scopeName, key);",
            "return getSingletonVersion(scope, scopeName, key);"
        ])});`);
        // Load Singleton Version
        buf.push(`const loadSingletonVersionCheck = /*#__PURE__*/ init(${runtimeTemplate.basicFunction("scopeName, scope, key, version", [
            "ensureExistence(scopeName, key);",
            "return getSingletonVersion(scope, scopeName, key, version);"
        ])});`);
        buf.push(`${RuntimeGlobals.global}.${this.#options.globalModulesRequire} = (moduleId) =>`);
        buf.push("{");
        buf.push(Template.indent(`try`));
        buf.push(Template.indent(`{`));
        buf.push(Template.indent(Template.indent(`const moduleGen	= loadSingleton("global", moduleId);`)));
        buf.push(Template.indent(Template.indent(`if (!moduleGen)`)));
        buf.push(Template.indent(Template.indent(`{`)));
        if (this.#options.logMissingShares)
            buf.push(Template.indent(Template.indent(Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`))));
        buf.push(Template.indent(Template.indent(Template.indent(`return undefined;`))));
        buf.push(Template.indent(Template.indent(`}`)));
        buf.push(Template.indent(Template.indent(`return moduleGen()`)));
        buf.push(Template.indent(`}`));
        buf.push(Template.indent(`catch (error)`));
        buf.push(Template.indent(`{`));
        if (this.#options.logMissingShares)
            buf.push(Template.indent(Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`)));
        buf.push(Template.indent(Template.indent(`return undefined;`)));
        buf.push(Template.indent(`}`));
        buf.push("}");
        if (this.#options.globalModulesRegister) {
            buf.push(`${RuntimeGlobals.global}.${this.#options.globalModulesRegister} = (moduleId, module) =>
			{
				// Inject module into module cache
				if (Object.hasOwn(${RuntimeGlobals.moduleCache}, moduleId))
					console.warn("Module: '" + moduleId + "' already exists in cache");

				${RuntimeGlobals.moduleCache}[moduleId] = {
					id: moduleId,
					exports: module,
					loaded: true
				};

				// Register module in shared scope
				const scope = ${RuntimeGlobals.shareScopeMap}["global"];

				if (!scope)
				{
					console.warn("Cannot Register '" + moduleId + "': Global scope not found");
					return;
				}

				scope[moduleId] = {
					"0.0.0": {
						from: "runtime",
						eager: true,
						get: () => (() => ${RuntimeGlobals.require}(moduleId))
					}
				};
			}`);
        }
        // Currently this simply proxies shares scoped by module to the original package name
        // TODO: register scoped packges into their own scope and query from their scope.
        if (this.#options.modules) {
            const scopeConfig = [];
            for (const moduleName in this.#options.modules) {
                const mod = this.#options.modules[moduleName];
                for (const packageName in mod)
                    scopeConfig.push(`scope["${moduleName}:${packageName}"] = {"0.0.0": {from: "${moduleName}", eager: true, get: () => (() => ${this.#options.globalModulesRequire}("${packageName}"))}};`);
            }
            buf.push("// Adding modules to the shared scope ");
            buf.push(`const configureModulesInScope = /*#__PURE__*/ init(${runtimeTemplate.basicFunction("scopeName, scope", scopeConfig)});`);
            buf.push(`configureModulesInScope("global")`);
        }
        if (this.#options.compatibility) {
            buf.push("");
            buf.push("// Shared-Require Backwards Compatiblity");
            buf.push(`Object.defineProperty(${RuntimeGlobals.global}, "globalSharedModules",`);
            buf.push("{");
            buf.push(Template.indent([
                "get: function()",
                "{",
                Template.indent(`if (!${RuntimeGlobals.global}._globalSharedModules)`),
                Template.indent("{"),
                Template.indent(Template.indent(`${RuntimeGlobals.global}._globalSharedModules	= new Proxy(${RuntimeGlobals.moduleCache},`)),
                Template.indent(Template.indent("{")),
                Template.indent(Template.indent(Template.indent("get: function (target, prop, receiver)"))),
                Template.indent(Template.indent(Template.indent("{"))),
                Template.indent(Template.indent(Template.indent(Template.indent("if (isNaN(prop))")))),
                Template.indent(Template.indent(Template.indent(Template.indent(Template.indent("return target[prop]?.exports;"))))),
                Template.indent(Template.indent(Template.indent(Template.indent("")))),
                Template.indent(Template.indent(Template.indent(Template.indent("return undefined;")))),
                Template.indent(Template.indent(Template.indent("},"))),
                Template.indent(Template.indent(Template.indent("has: function (target, prop)"))),
                Template.indent(Template.indent(Template.indent("{"))),
                Template.indent(Template.indent(Template.indent(Template.indent("if (isNaN(prop))")))),
                Template.indent(Template.indent(Template.indent(Template.indent(Template.indent("return prop in target;"))))),
                Template.indent(Template.indent(Template.indent(Template.indent("")))),
                Template.indent(Template.indent(Template.indent(Template.indent("return false;")))),
                Template.indent(Template.indent(Template.indent("}"))),
                Template.indent(Template.indent("});")),
                Template.indent("}"),
                Template.indent(""),
                Template.indent(`return ${RuntimeGlobals.global}._globalSharedModules;`),
                "},",
                "configurable: true"
            ]));
            buf.push("});");
        }
        return Template.asString(buf);
    }
}

/*
   MIT License

    Copyright (c) 2023 Michael Rochelle <@EliteScientist>

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
const pluginName = "SharedRequirePlugin";
class SharedRequirePlugin {
    options; // Plugin Configuration
    /**
     * Constructor
     * @param options
     */
    constructor(options) {
        const userOptions = options || {};
        const defaultOptions = {
            globalModulesRequire: "requireSharedModule",
            globalModulesRegister: "registerSharedModule",
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
            // Provides
            for (const packageName in this.options.provides) {
                const specs = this.options.provides[packageName];
                if (!specs.shareKey)
                    specs.shareKey = packageName;
                specs.eager = true;
                provides[packageName] = specs;
            }
            // Modules
            // TODO: register scoped packges into their own scope and query from their scope.
            for (const moduleName in this.options.modules) {
                const mod = this.options.modules[moduleName];
                for (const packageName in mod) {
                    const specs = mod[packageName];
                    if (!specs.shareKey)
                        specs.shareKey = packageName;
                    specs.eager = true;
                    provides[packageName] = specs;
                }
            }
            new ProvideSharedPlugin({
                provides: provides,
                shareScope: "global"
            }).apply(compiler);
        }
        // Configure Compiler
        compiler.hooks.compilation.tap(pluginName, (compilation) => {
            // Add Global Shared Requre to template
            compilation.hooks.runtimeRequirementInTree
                .for(RuntimeGlobals.requireScope)
                .tap(pluginName, (chunk, runtimeRequirements) => {
                // We will always need global available for providing and consuming
                runtimeRequirements.add(RuntimeGlobals.global);
                if (this.options.provides) {
                    runtimeRequirements.add(RuntimeGlobals.startupOnlyBefore);
                    runtimeRequirements.add(RuntimeGlobals.require);
                    runtimeRequirements.add(RuntimeGlobals.shareScopeMap);
                    runtimeRequirements.add(RuntimeGlobals.initializeSharing);
                    runtimeRequirements.add(RuntimeGlobals.moduleCache);
                    compilation.addRuntimeModule(chunk, new SharedRequirePluginModule(this.options));
                }
                return true;
            });
            if (this.options.provides) {
                // Modify Module IDs to be requested id -- provider only. to make modules accessible by requested name
                compilation.hooks.moduleIds.tap(pluginName, (modules) => {
                    modules.forEach((mod) => {
                        const request = mod?.rawRequest ?? mod.rootModule?.rawRequest;
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
        if ((this.options.consumes && data.request in this.options.consumes) ||
            (this.options.externalModulePrefixes
                && this.options.externalModulePrefixes.some((prefix) => String(data.request).startsWith(prefix)))) {
            const runtimeRequirements = new Set([
                RuntimeGlobals.module,
                RuntimeGlobals.require,
                RuntimeGlobals.global
            ]);
            return new RawModule(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
        }
        else if (this.options.externalModules != null && this.options.externalModules.length > 0) {
            for (let i = 0; i < this.options.externalModules.length; i++) {
                let moduleName = this.options.externalModules[i];
                if (typeof moduleName === "string")
                    moduleName = "^" + moduleName + "$";
                if (data.request.match(moduleName) != null) {
                    const runtimeRequirements = new Set([
                        RuntimeGlobals.module,
                        RuntimeGlobals.require,
                        RuntimeGlobals.global
                    ]);
                    return new RawModule(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
                }
            }
        }
    }
    getSource(request) {
        let req = JSON.stringify(request);
        const buf = [];
        buf.push(Template.indent(Template.indent('try')));
        buf.push(Template.indent(Template.indent('{')));
        buf.push(Template.indent(Template.indent(Template.indent(`module.exports = ${RuntimeGlobals.global}.${this.options.globalModulesRequire}(${req});`))));
        buf.push(Template.indent(Template.indent('}')));
        buf.push(Template.indent(Template.indent('catch (error) { module.exports = undefined; /* SharedRequirePlugin not installed on parent */}')));
        return Template.asString(buf);
    }
}

export { SharedRequirePlugin };
