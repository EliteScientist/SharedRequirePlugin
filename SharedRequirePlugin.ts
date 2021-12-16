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
import ProvideSharedPlugin from "webpack/lib/sharing/ProvideSharedPlugin";

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
            globalModulesRequire:   "requireSharedModule",
            compatibility:          false,
            logMissingShares:       true
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
        if (this.options.provides)
        {
            const provides  = {};

            for (let packageName in this.options.provides)
            {
                const specs = this.options.provides[packageName];

                if (!specs.shareKey)
                    specs.shareKey  = packageName;

                specs.eager = true;

                provides[packageName]    = specs;
            }

            new ProvideSharedPlugin({
                provides: provides,
                shareScope: "global"
            }).apply(compiler);
        }

        // Configure Compiler
        compiler.hooks.compilation.tap(pluginName, (compilation) =>
        {
             // Add Global Shared Requre to template
             compilation.hooks.runtimeRequirementInTree
                .for(RuntimeGlobals.requireScope)
                .tap(pluginName, (chunk, runtimeRequirements) =>
                {
                    // We will always need global available for providing and consuming
                    runtimeRequirements.add(RuntimeGlobals.global);

                    if (this.options.provides)
                    {
                        runtimeRequirements.add(RuntimeGlobals.startupOnlyBefore);
                        runtimeRequirements.add(RuntimeGlobals.require);
                        runtimeRequirements.add(RuntimeGlobals.shareScopeMap);
                        runtimeRequirements.add(RuntimeGlobals.initializeSharing);

                        if (this.options.compatibility)
                            runtimeRequirements.add(RuntimeGlobals.moduleCache);

                        compilation.addRuntimeModule(chunk, new SharedRequirePluginModule(this.options));
                    }

                    return true;
                }
            );
            
            if (this.options.provides)
            {
                // Modify Module IDs to be requested id -- provider only. to make modules accessible by requested name
                compilation.hooks.moduleIds.tap(pluginName, (modules) =>
                {
                    modules.forEach((mod) =>
                    {
                        const request = mod?.rawRequest ?? mod.rootModule?.rawRequest;

                        if (request in this.options.provides)
                            this.processModuleId(mod, request, compilation);
                    });
                });
            }

        });
      
        // Consumer
        if (this.options.consumes || this.options.externalModules)
        {
            // Module Consumer
            // Get Module Factory
            compiler.hooks.normalModuleFactory.tap(pluginName, (factory) =>
            {
                // Configure Resolver to resolve external modules
                factory.hooks.resolve.tap(pluginName, this.resolveModule.bind(this));
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
	
    resolveModule(data:any, callback: Function):Module | boolean | undefined
    {
        if (this.options.consumes && data.request in this.options.consumes)
        {
            const runtimeRequirements    = new Set([
                RuntimeGlobals.module,
                RuntimeGlobals.require,
                RuntimeGlobals.global
            ]);

            return new RawModule(this.getSource(data.request), `External::${data.request}`, data.request, runtimeRequirements);
        }
        else
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
                        RuntimeGlobals.require,
                        RuntimeGlobals.global
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
		
        buf.push(Template.indent(Template.indent(`module.exports = ${RuntimeGlobals.global}.${this.options.globalModulesRequire}(${req});`)));
        
        return Template.asString(buf);
    }
}

/**
 * Shared Require Plugin Options
 */
interface SharedRequirePluginOptions
{
    provides?:{[key:string]: {eager?:boolean, shareKey?:string, version?:string}};
    consumes?:{[key:string]: {eager?:boolean}};
    externalModules?:Array<string>;  // List of external modules that are provided by the provider application
    globalModulesRequire:string;     // Global require method name
    compatibility:boolean;          // True to enable compatibility other projects built with older mechanism
    logMissingShares:boolean;       // Log Missing Share warnings to console.
}

module.exports = SharedRequirePlugin;