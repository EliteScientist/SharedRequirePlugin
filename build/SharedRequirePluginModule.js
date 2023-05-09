"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _SharedRequirePluginModule_options;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedRequirePluginModule = void 0;
const webpack_1 = require("webpack");
const semver_1 = require("webpack/lib/util/semver");
class SharedRequirePluginModule extends webpack_1.RuntimeModule {
    constructor(options) {
        super("SharedRequirePlugin", webpack_1.RuntimeModule.STAGE_ATTACH);
        _SharedRequirePluginModule_options.set(this, void 0);
        __classPrivateFieldSet(this, _SharedRequirePluginModule_options, options, "f");
    }
    shouldIsolate() {
        return true;
    }
    generate() {
        const { compilation } = this;
        const { runtimeTemplate } = compilation;
        const buf = [
            (0, semver_1.satisfyRuntimeCode)(runtimeTemplate),
            (0, semver_1.versionLtRuntimeCode)(runtimeTemplate)
        ];
        buf.push("// Shared-Require Global Module Provider Function");
        buf.push("// Initialize Sharing Scope");
        buf.push(`${webpack_1.RuntimeGlobals.initializeSharing}("global");`);
        // Trace Error
        buf.push(`const getInvalidSingletonVersionMessage = ${runtimeTemplate.basicFunction("key, version, requiredVersion", [
            `return "Unsatisfied version " + version + " of shared singleton module " + key + " (required " + rangeToString(requiredVersion) + ")"`
        ])};`);
        // Ensure Existence
        buf.push(`const ensureExistence = ${runtimeTemplate.basicFunction("scopeName, key", [
            `const scope = ${webpack_1.RuntimeGlobals.shareScopeMap}[scopeName];`,
            `if(!scope || !${webpack_1.RuntimeGlobals.hasOwnProperty}(scope, key)) throw new Error("Shared module " + key + " doesn't exist in shared scope " + scopeName);`,
            "return scope;"
        ])};`);
        // Get Entry
        buf.push(`const get = ${runtimeTemplate.basicFunction("entry", [
            "entry.loaded = 1;",
            "return entry.get()"
        ])};`);
        // Init
        buf.push(`const init = ${runtimeTemplate.returningFunction(webpack_1.Template.asString([
            "function(scopeName, a, b, c) {",
            webpack_1.Template.indent([
                `const promise = ${webpack_1.RuntimeGlobals.initializeSharing}(scopeName);`,
                `if (promise && promise.then) return promise.then(fn.bind(fn, scopeName, ${webpack_1.RuntimeGlobals.shareScopeMap}[scopeName], a, b, c));`,
                `return fn(scopeName, ${webpack_1.RuntimeGlobals.shareScopeMap}[scopeName], a, b, c);`
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
        buf.push(`${webpack_1.RuntimeGlobals.global}.${__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").globalModulesRequire} = (moduleId) =>`);
        buf.push("{");
        buf.push(webpack_1.Template.indent(`try`));
        buf.push(webpack_1.Template.indent(`{`));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`const moduleGen	= loadSingleton("global", moduleId);`)));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`if (!moduleGen)`)));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`{`)));
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").logMissingShares)
            buf.push(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`))));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(`return undefined;`))));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`}`)));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`return moduleGen()`)));
        buf.push(webpack_1.Template.indent(`}`));
        buf.push(webpack_1.Template.indent(`catch (error)`));
        buf.push(webpack_1.Template.indent(`{`));
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").logMissingShares)
            buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`)));
        buf.push(webpack_1.Template.indent(webpack_1.Template.indent(`return undefined;`)));
        buf.push(webpack_1.Template.indent(`}`));
        buf.push("}");
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").globalModulesRegister) {
            buf.push(`${webpack_1.RuntimeGlobals.global}.${__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").globalModulesRegister} = (moduleId, module) =>
			{
				// Inject module into module cache
				if (Object.hasOwn(${webpack_1.RuntimeGlobals.moduleCache}, moduleId))
					console.warn("Module: '" + moduleId + "' already exists in cache");

				${webpack_1.RuntimeGlobals.moduleCache}[moduleId] = {
					id: moduleId,
					exports: module,
					loaded: true
				};

				// Register module in shared scope
				const scope = ${webpack_1.RuntimeGlobals.shareScopeMap}["global"];

				if (!scope)
				{
					console.warn("Cannot Register '" + moduleId + "': Global scope not found");
					return;
				}

				scope[moduleId] = {
					"0.0.0": {
						from: "runtime",
						eager: true,
						get: () => (() => ${webpack_1.RuntimeGlobals.require}(moduleId))
					}
				};
			}`);
        }
        // Currently this simply proxies shares scoped by module to the original package name
        // TODO: register scoped packges into their own scope and query from their scope.
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").modules) {
            const scopeConfig = [];
            for (const moduleName in __classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").modules) {
                const mod = __classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").modules[moduleName];
                for (const packageName in mod)
                    scopeConfig.push(`scope["${moduleName}:${packageName}"] = {"0.0.0": {from: "${moduleName}", eager: true, get: () => (() => ${__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").globalModulesRequire}("${packageName}"))}};`);
            }
            buf.push("// Adding modules to the shared scope ");
            buf.push(`const configureModulesInScope = /*#__PURE__*/ init(${runtimeTemplate.basicFunction("scopeName, scope", scopeConfig)});`);
            buf.push(`configureModulesInScope("global")`);
        }
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_options, "f").compatibility) {
            buf.push("");
            buf.push("// Shared-Require Backwards Compatiblity");
            buf.push(`Object.defineProperty(${webpack_1.RuntimeGlobals.global}, "globalSharedModules",`);
            buf.push("{");
            buf.push(webpack_1.Template.indent([
                "get: function()",
                "{",
                webpack_1.Template.indent(`if (!${webpack_1.RuntimeGlobals.global}._globalSharedModules)`),
                webpack_1.Template.indent("{"),
                webpack_1.Template.indent(webpack_1.Template.indent(`${webpack_1.RuntimeGlobals.global}._globalSharedModules	= new Proxy(${webpack_1.RuntimeGlobals.moduleCache},`)),
                webpack_1.Template.indent(webpack_1.Template.indent("{")),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("get: function (target, prop, receiver)"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("{"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("if (isNaN(prop))")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return target[prop]?.exports;"))))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return undefined;")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("},"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("has: function (target, prop)"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("{"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("if (isNaN(prop))")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return prop in target;"))))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return false;")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("}"))),
                webpack_1.Template.indent(webpack_1.Template.indent("});")),
                webpack_1.Template.indent("}"),
                webpack_1.Template.indent(""),
                webpack_1.Template.indent(`return ${webpack_1.RuntimeGlobals.global}._globalSharedModules;`),
                "},",
                "configurable: true"
            ]));
            buf.push("});");
        }
        return webpack_1.Template.asString(buf);
    }
}
exports.SharedRequirePluginModule = SharedRequirePluginModule;
_SharedRequirePluginModule_options = new WeakMap();
