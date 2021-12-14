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

import {SharedRequirePluginModule} from "./SharedRequirePluginModule";
import {Template, RuntimeGlobals, Module, Compilation} from "webpack";
import RawModule from "webpack/lib/RawModule";

const pluginName	= "SharedRequirePlugin";

export default class SharedRequirePlugin
{
    options:SharedRequirePluginOptions;     // Plugin Configuration

    /**
     * Constructor
     * @param options
     */
    constructor(options)
    {
        const userOptions = options || {};

        const defaultOptions =
        {
            provider:               false,
            externalModules:        [],
            globalModulesRequire:   "requireSharedModule",
            compatibility:          false
        };

        this.options        = Object.assign(defaultOptions, userOptions);
    }

    /**
     * Plugin Compilation Entry Point
     * @param compiler 
     */
    apply (compiler):void
    {
        // Begin Compilation
        if (this.options.provider)
        {            
            // Module Provider
            // Configure Compiler
            compiler.hooks.compilation.tap(pluginName, (compilation) =>
            {
                 // Add Global Shared Requre to template
                 compilation.hooks.runtimeRequirementInTree
                    .for(RuntimeGlobals.requireScope)
                    .tap(pluginName, (chunk, runtimeRequirements) =>
                    {
                        runtimeRequirements.add(RuntimeGlobals.startupOnlyBefore);
                        compilation.addRuntimeModule(chunk, new SharedRequirePluginModule(this.options.globalModulesRequire, this.options.compatibility));

                        return true;
                    });
				
                // Modify Module IDs to be requested id
                compilation.hooks.moduleIds.tap(pluginName, (modules) =>
                {
                    modules.forEach((mod) =>
					{
						if ("rawRequest" in mod) 
						{
							const request = mod.rawRequest;
							this.processModuleId(mod, request, compilation);
						}
						else
						if ("rootModule" in mod) // Concatenated Module
						{
							const request = mod.rootModule.rawRequest;
							this.processModuleId(mod, request, compilation);
						}
					});
                });
            });
        }
        else
        if (this.options.externalModules && this.options.externalModules.length > 0)
        {
            // Module Consumer
            // Get Module Factory
            compiler.hooks.normalModuleFactory.tap(pluginName, (factory) =>
            {
                // Configure Resolver to resolve external modules
                factory.hooks.resolve.tap(pluginName, this.resolveModule.bind(this, Compilation));
            });
        }
    }

	processModuleId(mod, request:string, compilation:Compilation):void
	{		
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
	
    resolveModule(compilation:Compilation, data:any, callback: Function):Module | boolean | undefined
    {
        if (this.options.externalModules != null && this.options.externalModules.length > 0)
        {
            for (let i:number = 0; i < this.options.externalModules.length; i++)
            {
                let moduleName  = this.options.externalModules[i];
				
				if (typeof moduleName === "string")
					moduleName	= "^" + moduleName + "$";
    
                if (data.request.match(moduleName) != null)
                {
                    const runtimeRequirements    = new Set([
                        RuntimeGlobals.module,
                        RuntimeGlobals.require
                    ]);

                    return new RawModule(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
                }
            }
        }
    }

    getSource(request):string
    {
        let req	= JSON.stringify(request);
		
		const buf = [];
		
        //buf.push("(module, exports) =>")
        //buf.push("{");
		buf.push(Template.indent("try"));
		buf.push(Template.indent("{"));
        buf.push(Template.indent(Template.indent(`module.exports = ${RuntimeGlobals.global}.${this.options.globalModulesRequire}(${req});`)));
        buf.push(Template.indent("}"));
		buf.push(Template.indent("catch (error)"));
		buf.push(Template.indent("{"));
		buf.push(Template.indent(Template.indent("module.exports = null; // Shared System/Module not available")));
		buf.push(Template.indent(Template.indent(`console.warn('Request for shared module: ${req} - Not available.');`)));
		buf.push(Template.indent("}"));
        //buf.push("}");
        return Template.asString(buf);
    }
}

/**
 * Shared Require Plugin Options
 */
interface SharedRequirePluginOptions
{
    provider:Boolean;               // True if this project provides libraries to loaded applications and libraries
    externalModules:Array<string>;  // List of external modules that are provided by the provider application
    globalModulesRequire:string;     // Global require method name
    compatibility:boolean;          // True to enable compatibility other projects built with older mechanism
}

module.exports = SharedRequirePlugin;