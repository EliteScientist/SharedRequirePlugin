import {Template, RuntimeModule, RuntimeGlobals} from "webpack";
import {satisfyRuntimeCode} from "webpack/lib/util/semver";

export class SharedRequirePluginModule
	extends RuntimeModule
{
	#compatibility:boolean;
	#requireFunction:string;
	#logMissingShares:boolean;

	constructor(options:any) //requireFunction:string, compatability:boolean = false)
	{
		super("SharedRequirePlugin", RuntimeModule.STAGE_ATTACH);
		this.#requireFunction	= options.globalModulesRequire;
		this.#compatibility		= options.compatibility;
		this.#logMissingShares	= options.logMissingShares;
	}

	public shouldIsolate():boolean {
		return true;
	}

	public generate():string
	{
		const {compilation} 	= this;
		const {runtimeTemplate}	= compilation;
		
		const buf:string[] = [
			satisfyRuntimeCode(runtimeTemplate)
		];

		buf.push("// Shared-Require Global Module Provider Function");
		buf.push("// Initialize Sharing Scope");
		buf.push(`${RuntimeGlobals.initializeSharing}("global");`);

		// Trace Error
		buf.push(`const getInvalidSingletonVersionMessage = ${runtimeTemplate.basicFunction(
			"key, version, requiredVersion",
			[
				`return "Unsatisfied version " + version + " of shared singleton module " + key + " (required " + rangeToString(requiredVersion) + ")"`
			]
		)};`);

		// Ensure Existence
		buf.push(`const ensureExistence = ${runtimeTemplate.basicFunction("scopeName, key", [
			`const scope = ${RuntimeGlobals.shareScopeMap}[scopeName];`,
			`if(!scope || !${RuntimeGlobals.hasOwnProperty}(scope, key)) throw new Error("Shared module " + key + " doesn't exist in shared scope " + scopeName);`,
			"return scope;"
		])};`,);

		// Get Entry
		buf.push(`const get = ${runtimeTemplate.basicFunction("entry", [
			"entry.loaded = 1;",
			"return entry.get()"
		])};`);

		// Init
		buf.push(`const init = ${runtimeTemplate.returningFunction(
			Template.asString([
				"function(scopeName, a, b, c) {",
				Template.indent([
					`const promise = ${RuntimeGlobals.initializeSharing}(scopeName);`,
					`if (promise && promise.then) return promise.then(fn.bind(fn, scopeName, ${RuntimeGlobals.shareScopeMap}[scopeName], a, b, c));`,
					`return fn(scopeName, ${RuntimeGlobals.shareScopeMap}[scopeName], a, b, c);`
				]),
				"}"
			]),
			"fn"
		)};`);

		// Find Singleton Version
		buf.push(`const findSingletonVersionKey = ${runtimeTemplate.basicFunction(
			"scope, key",
			[
				"const versions = scope[key];",
				`return Object.keys(versions).reduce(${runtimeTemplate.basicFunction(
					"a, b",
					["return !a || (!versions[a].loaded && versionLt(a, b)) ? b : a;"]
				)}, 0);`
			]
		)};`);

		// Get Singleton Version
		buf.push(`const getSingletonVersion = ${runtimeTemplate.basicFunction(
			"scope, scopeName, key, requiredVersion",
			[
				"const version = findSingletonVersionKey(scope, key);",
				
				"if (requiredVersion &&!satisfy(requiredVersion, version)) " +
					'typeof console !== "undefined" && console.warn && console.warn(getInvalidSingletonVersionMessage(key, version, requiredVersion));',

				"return get(scope[key][version]);"
			]
		)};`);

		// Load Singleton
		buf.push(`const loadSingleton = /*#__PURE__*/ init(${runtimeTemplate.basicFunction(
			"scopeName, scope, key",
			[
				"ensureExistence(scopeName, key);",
				"return getSingletonVersion(scope, scopeName, key);"
			]
		)});`);

		// Load Singleton Version
		buf.push(`const loadSingletonVersionCheck = /*#__PURE__*/ init(${runtimeTemplate.basicFunction(
			"scopeName, scape, key, version",
			[
				"ensureExistence(scopeName, key);",
				"return getSingletonVersion(scope, scopeName, key, version);"
			]
		)});`);
		
		buf.push(`${RuntimeGlobals.global}.${this.#requireFunction} = function (moduleId)`);
		buf.push("{");
		buf.push(Template.indent(`try`));
		buf.push(Template.indent(`{`));
		buf.push(Template.indent(Template.indent(`const moduleGen	= loadSingleton("global", moduleId);`)));
		buf.push(Template.indent(Template.indent(`if (!moduleGen)`)));
		buf.push(Template.indent(Template.indent(`{`)));

		if (this.#logMissingShares)
			buf.push(Template.indent(Template.indent(Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`))));

		buf.push(Template.indent(Template.indent(Template.indent(`return null;`))));
		buf.push(Template.indent(Template.indent(`}`)));
		buf.push(Template.indent(Template.indent(`return moduleGen()`)));
		buf.push(Template.indent(`}`));
		buf.push(Template.indent(`catch (error)`));
		buf.push(Template.indent(`{`));

		if (this.#logMissingShares)
			buf.push(Template.indent(Template.indent(`console.warn(\`Request for shared module: \${moduleId} - Not available.\`);`)));

		buf.push(Template.indent(Template.indent(`return null;`)));
		buf.push(Template.indent(`}`));
		buf.push("}");

		if (this.#compatibility)
		{
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
					Template.indent(Template.indent(Template.indent(Template.indent("return null;")))),
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