/*
	The MIT License (MIT)

	Copyright (c) 2015 Michael Rochelle (@EliteScientist)

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

	 https://github.com/EliteScientist/SharedRequirePlugin/
*/

/**
 *  Require Function
 *  
 *  This function outputs the JS code for the require method.
 * 
 * @param {type} source
 * @param {Chunk} chunk
 * @param {string} hash
 * @returns {string}
 */
function requireFunction(source, chunk, hash) 
{
	// Copied from MainTemplate.js to override behavior of require js output
	// source, -- Removed source so we do not copy the original function
	return this.asString([
		"// Check if module is in cache",
		"if(installedModules[moduleId])",
		this.indent("return installedModules[moduleId].exports;"),
		"",
		"// Check the global table for the existence of a module",
		"if (\"globalSharedModules\" in window)",
		"{",
		this.indent("if (window.globalSharedModules[moduleId])"),
		this.indent(this.indent("return window.globalSharedModules[moduleId].exports;")),
		"}",
		"",
		"if (!modules.hasOwnProperty(moduleId))",
		"\treturn null;",
		"// Create a new module (and put it into the cache)",
		"var module = installedModules[moduleId] = {",
		this.indent(this.applyPluginsWaterfall("module-obj", "", chunk, hash, "moduleId")),
		"};",
		"",
		"// Execute the module function",
		"modules[moduleId].call(module.exports, module, module.exports, " + this.renderRequireFunctionForModule(hash, chunk, "moduleId") + ");",
		"",
		"// Flag the module as loaded",
		"module.loaded = true;",
		"",
		"// Add the module to the global modules table if the module has a compatible id",
		"if ((typeof moduleId === \"string\") && (moduleId.charAt(0) !== '.') && (moduleId.charAt(1) !== ':') && (moduleId.charAt(2) !== '!'))",
		"{",
		this.indent("var globalModules	= window.globalSharedModules || {};"),
		this.indent("globalModules[moduleId] = module;"),
		this.indent("window.globalSharedModules = globalModules;"),
		"}",
		"",
		"// Return the exports of the module",
		"return module.exports;"
	]);
}

/**
 * Render Chunk Modules
 * 
 * This method is responsible for rendering each module
 * 
 * @param {Chunk} chunk
 * @param {Template} moduleTemplate
 * @param {Template} dependencyTemplates
 * @param {String} prefix
 * @param {Array} externalModules
 * @returns {source|ConcatSource}
 * 
 */
function renderChunkModules(chunk, moduleTemplate, dependencyTemplates, prefix, externalModules) 
{
	// Copied From Template.js to override behavior of function in MainTemplate
	
	var ConcatSource = require("webpack/node_modules/webpack-core/lib/ConcatSource");
	
	if (!prefix)
		prefix = "";
	
	var source = new ConcatSource();
	
	if (chunk.modules.length === 0) 
	{
		source.add("[]");
		return source;
	}
	
	var bounds = this.getModulesArrayBounds(chunk.modules);
	
	if (bounds) 
	{
		// Render a spare array
		var minId = bounds[0];
		var maxId = bounds[1];
		
		if (minId !== 0)
			source.add("Array(" + minId + ").concat(");
		
		source.add("[\n");
		
		var modules = {};
		
		chunk.modules.forEach(function(module) 
		{
			modules[module.id] = module;
		});
		
		for (var idx = minId; idx <= maxId; idx++) 
		{
			var module = modules[idx];
			
			if (idx !== minId)
				source.add(",\n");
			
			source.add("/* " + idx + " */");
			
			if (module) 
			{
				source.add("\n");
				source.add(moduleTemplate.render(module, dependencyTemplates, chunk));
			}
		}
		source.add("\n" + prefix + "]");
		
		if (minId !== 0)
			source.add(")");
	} 
	else 
	{
		// Render an object
		source.add("{\n");
		
		chunk.modules.forEach(function(module, idx) 
		{
			// Suppress rendering of external modules
			if (externalModules instanceof Array)
			{	
				if ("rawRequest" in module && externalModules.indexOf(module.rawRequest) > -1)
					return;
			}
			else
			if (externalModules === "*" && idx !== 0)
				return;
			
			if (idx !== 0)
				source.add(",\n");
			
			source.add("\n/***/ " + JSON.stringify(module.id) + ":\n");
			source.add(moduleTemplate.render(module, dependencyTemplates, chunk));
		});
		
		source.add("\n\n" + prefix + "}");
	}
	return source;
};

/**
 * Shared Require Plugin
 * 
 * This plugin allows require("projectName") to be shared across webpack contexts.
 * 
 * @param {type} config
 * @returns {SharedRequirePlugin}
 */
function SharedRequirePlugin(config)
{
	this.config	= config;
}

SharedRequirePlugin.prototype	= Object.create(Object.prototype,
{
	config:
	{
		value: null,
		enumerable: true,
		configurable: false,
		writable: true
	},

	apply:
	{
		value: function (compiler)
		{
			var config = this.config;
			
			if (config != null && "externalModules" in config)
			{								
				// Create Resolver to allow us to require an external library.
				compiler.resolvers.normal.apply(new ExternalResolverPlugin(this));
			
				// Enable the module factory to construct a stub module for external modules
				// This allows us to create requires for modules that we know will be available
				// at runtime.
				compiler.plugin("normal-module-factory", function (factory)
				{

					// Flag the item as externalLibrary if it is listed in the configuration
					// as an external library.
					factory.plugin("after-resolve", function (result, callback)
					{
						if (result == null)
							return callback();
						
						if (config.externalModules.indexOf(result.rawRequest) > -1)
							result.externalLibrary	= true;
						
						callback(null, result);
					});
					
					// Create ExternalLibraryModule instance for modules listed as external.
					factory.plugin("create-module", function (data)
					{
						if ("externalLibrary" in data)
						{
							var result	= new ExternalLibraryModule(data.rawRequest);
							return result;
						}
						
						
						return null;
					});
				});
			}
			
			compiler.plugin("compilation", function (compilation, options)
			{	
				// Change JS Require Method to expose modules globally.
				compilation.mainTemplate.plugin("require", requireFunction);
				
				// Suppress output of external modules
				if (config != null && "externalModules" in config)
				{
					var externalModules	= config.externalModules;
														
					// Redefine method that renders chunk modules to use our chunk
					// module renderer method
					compilation.mainTemplate.renderChunkModules = function()
					{
						// Copy args into an array and add the externalModules var.
						var params	= [];
						var i		= 0;
						
						while (true)
						{
							if (!arguments.hasOwnProperty(i))
								break;
							
							params[i]	= arguments[i];
							
							i++;
						}
						
						params[4]	= externalModules;
												
						// Call our chunk module renderer function						
						return renderChunkModules.apply(this, params);
					};
				}
								
				// Modify Module IDs to use requested path instead of integer
				// This will allow multiple contexts to find libs that are
				// be shared by name.
				compilation.plugin("optimize-module-ids", function (modules)
				{
					modules.forEach(function (module)
					{
						if ("rawRequest" in module)
						{
							var request	= module.rawRequest;
							
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
			});
		},
		enumerable: true,
		configurable: false,
		writable: false
	}
});


/**
 * External Resolver Plugin
 * 
 * This plugin enabled webpack to build external libraries without throwing errors.
 * 
 * @param {type} parent
 * @returns {ExternalResolverPlugin}
 * 
 */
function ExternalResolverPlugin(parent)
{
	this._parentPlugin	= parent;
}

ExternalResolverPlugin.prototype	= Object.create(Object.prototype,
{
	parentPlugin:
	{
		get: function()
		{
			return this._parentPlugin;
		},
		enumerable: true,
		configurable: false
	},
	
	apply:
	{
		value: function (resolver)
		{
			var parent	= this.parentPlugin;
			
			if (parent.config != null && "externalModules" in parent.config)
			{
				var externalModules	= parent.config.externalModules;
				
				resolver.plugin("module", function (result, callback)
				{
					if (externalModules instanceof Array)
					{
						// If module is defined as external, return stub resolution
						if (externalModules.indexOf(result.request) > -1)
						{
							callback(null, {path: result.request, query: result.request, resolved: true});
							return true;
						}
					}
					else
					if (externalModules === "*")
					{
						// TODO: Check for root module. allow root and incompatible modules to go through doResult method.
						callback(null, {path: result.request, query: result.request, resolved: true});
						return true;
					}					
					
					this.doResolve(["file", "directory"], result, callback, true);
				});	
			}
		},
		enumerable: true,
		configurable: false,
		writable: false
	}
});

var NormalModule = require("webpack/lib/NormalModule");

/**
 * External Library Module
 * 
 * Extends Normal Module and suppresses build. 
 * 
 * These modules enable accessing modules from the global module table.
 * 
 * @param {type} rawRequest
 * @returns {ExternalLibraryModule}
 */
function ExternalLibraryModule(rawRequest)
{
	NormalModule.call(this, rawRequest, rawRequest, rawRequest, [], rawRequest);
}

ExternalLibraryModule.prototype	= Object.create(NormalModule.prototype,
{
	build:
	{
		value: function (options, moduleContext, resolver, fs, callback)
		{
			return callback(); // Do nothing
		},
		enumerable: true,
		configurable: false,
		writable: false
	}
});



module.exports	= SharedRequirePlugin;