import {Template, RuntimeModule, RuntimeGlobals} from "webpack";

export class SharedRequirePluginModule
	extends RuntimeModule
{
	#compatibility:boolean;
	#requireFunction:string;

	constructor(requireFunction:string, compatability:boolean = false) 
	{
		super("SharedRequirePlugin", RuntimeModule.STAGE_ATTACH);
		this.#requireFunction	= requireFunction;
		this.#compatibility		= compatability;
	}

	public shouldIsolate():boolean {
		return true;
	}

	public generate():string
	{
		const buf:string[] = [];
		buf.push("// Shared-Require Global Module Provider Function");
		buf.push(`${RuntimeGlobals.global}.${this.#requireFunction} = function (moduleId)`);
		buf.push("{");
		buf.push(Template.indent(`return ${RuntimeGlobals.require}(moduleId);`));
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
					Template.indent(Template.indent(`${RuntimeGlobals.global}._globalSharedModules	= new Proxy(${RuntimeGlobals.moduleFactories},`)),
					Template.indent(Template.indent("{")),
					Template.indent(Template.indent(Template.indent("get: function (target, prop, receiver)"))),
					Template.indent(Template.indent(Template.indent("{"))),
					Template.indent(Template.indent(Template.indent(Template.indent("if (isNaN(prop))")))),
					Template.indent(Template.indent(Template.indent(Template.indent(Template.indent("return target[prop];"))))),
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