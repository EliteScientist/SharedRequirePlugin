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
const Module    = require("webpack").Module;
const Template  = require("webpack").Template;
const RawSource = require("webpack-sources").RawSource;

const pluginName	= "SharedRequirePlugin";

class SharedRequirePlugin
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
            // Configure Compiler
            compiler.hooks.compilation.tap(pluginName, (compilation, params) =>
            {
                const { mainTemplate, chunkTemplate, moduleTemplates, runtimeTemplate } = compilation;

                // Add Global Shared Requre to template
                mainTemplate.hooks.beforeStartup.tap(pluginName, (source, chunk, hash) =>
                {
                    const buf = [source];
                    buf.push("// Shared-Require Global Module Provider Function");
                    buf.push("window.requireSharedModule = function (moduleId)");
                    buf.push("{");
                    buf.push(Template.indent(`return ${mainTemplate.requireFn}(moduleId);`));
                    buf.push("}");

                    if (this.options.compatibility)
                    {
                        buf.push("");
                        buf.push("// Shared-Require Backwards Compatiblity");
                        buf.push("Object.defineProperty(window, \"globalSharedModules\",");
                        buf.push("{");
                        buf.push(Template.indent([
                            "get: function()",
                            "{",
                            Template.indent("return installedModules;"),
                            "},",
                            "configurable: true"
                        ]));
                        buf.push("});");
                    }

                    return Template.asString(buf);
                });
                
                // Modify Module IDs to be requested id
                compilation.hooks.optimizeModuleIds.tap(pluginName, (modules) =>
                {
                    modules.forEach((module) =>
					{
						if ("rawRequest" in module)
						{
							let request	= module.rawRequest;
							
							if (module.id === 0) // Do not change the root (We may be able to simply change all modules that do not have an id of 0)
								return;
							
							if (request.charAt(0) === "." || request.charAt(0) === "/") // Relative Paths
								return;
							
							if (request.charAt(1) === ":") // Windows Drives
								return;
							
							if (request.charAt(2) === "!") // Loaders
								return;
							
							module.id	= request;
						}
					});

                });


                // Process Chunk Module Ids
                compilation.hooks.afterOptimizeChunkIds.tap(pluginName, (chunks) =>
                {
                    chunks.forEach((chunk) =>
                    {
                        chunk.getModules().forEach((module) =>
                        {
                            if ("rawRequest" in module)
                            {
                                let request	= module.rawRequest;
                                
                                if (module.id === 0) // Do not change the root (We may be able to simply change all modules that do not have an id of 0)
                                    return;
                                
                                if (request.charAt(0) === "." || request.charAt(0) === "/") // Relative Paths
                                    return;
                                
                                if (request.charAt(1) === ":") // Windows Drives
                                    return;
                                
                                if (request.charAt(2) === "!") // Loaders
                                    return;
                                
                                module.id	= request;
                            }
                        });
                    });

                    return chunks;
                });
            });
        }
        
        // Get Module Factory
        compiler.hooks.normalModuleFactory.tap(pluginName, factory =>
        {
            if (!this.options.provider && this.options.externalModules != null)
            {
                // Configure Resolver to resolve external modules
                factory.hooks.resolver.tap(pluginName, resolver =>
                {
                    let extResolver = new ExternalResolver(this.options, resolver)
                    return extResolver.apply.bind(extResolver);
                });

                // Create external access module for external modules. The ExternalAccessModule returns JS to acquire the module from the provider.
                factory.hooks.module.tap(pluginName, this.processModule.bind(this));
            }
        });
    }

    processModule(mod, context)
    {
        for (let i:number = 0; i < this.options.externalModules.length; i++)
        {
            let moduleName  = this.options.externalModules[i];

            if (mod.rawRequest.match(moduleName) != null)
                return new ExternalAccessModule(mod, context, this.options);
        }

        return mod;
    }

    /**
     * Process the AST documents found by webpack's parser
     * 
     * @param ast AST instance
     * @param comments Code comment blocks
     */
    processAst(ast, comments)
    {
    // TODO:
    }
}

/**
 * External Access Module
 * 
 * This module creates mechanism to retrieve modules that are provided by the provider application.
 */
class ExternalAccessModule extends Module
{
    request:String;
    ident:String;
    options:SharedRequirePluginOptions;

    constructor(mod, context, options) 
    {
        super("javascript/dynamic", context);

        this.options        = options;

        // Info from Factory
        this.request        = mod.rawRequest;
        this.ident          = this.request;
    }

    libIdent():String
    {
        return this.ident;
    }

    identifier():String
    {
        return this.ident;
    }

    readableIdentifier():String
    {
        return this.ident;
    }

    needRebuild(fileTimestamps: any, contextTimestamps:any):boolean { return false; }
    size():Number { return 12; }

    updateHash(hash):void
    {
        hash.update(this.identifier());
        super.updateHash(hash);
    }

    source(dependencyTemplates, runtime)
    {
        // TODO: Make log console error if the glboalModulesRequire method doesn't exist or the module doesn't exist.
        let src = `module.exports = window.${this.options.globalModulesRequire}("${this.request}");`;
        return new RawSource(src);
    }

    build(options, compilation, resolver, fs, callback) 
    {
        this.built      = true;
        this.buildMeta  = {};
        this.buildInfo  = {};
        callback();
    }
}

/**
 * Shared Require Plugin Options
 */
class SharedRequirePluginOptions
{
    provider:Boolean;               // True if this project provides libraries to loaded applications and libraries
    externalModules:Array<String>;  // List of external modules that are provided by the provider application
    globalModulesRequire:String     // Global require method name
    compatibility:Boolean;          // True to enable compatibility other projects built with older mechanism
}

/**
 * External Resolver
 * 
 * Resolves external components. Prevents resolution error from occuring while building for components not compiled into this application.
 */
class ExternalResolver
{
    options:SharedRequirePluginOptions;
    parentResolver:Function;

    constructor(options:SharedRequirePluginOptions, resolver:Function)
    {
        this.options        = options;
        this.parentResolver = resolver;
    }

    apply(data, callback)
    {
        if (this.options.externalModules != null && this.options.externalModules.length > 0)
        {
            for (let i:number = 0; i < this.options.externalModules.length; i++)
            {
                let moduleName  = this.options.externalModules[i];
    
                if (data.request.match(moduleName) != null)
                {
                    callback(null, {type: "shared", resource: data.request, path: data.request, query: data.request, request: data.request, rawRequest: data.request, resolved: true, externalLibrary: true, settings: {}});
                    return true;
                }
            }
        }

        this.parentResolver(data, callback);
    }
}


module.exports = SharedRequirePlugin;