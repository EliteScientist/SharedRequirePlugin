

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
			
			compiler.plugin("compilation", function (compiler, options)
			{
				// Remove Ignored Modules
				if (config != null && "ignoredPackages" in config)
				{
					compiler.plugin("optimize-modules", function (modules)
					{
						var ignoredPackages	= config.ignoredPackages;
						
						if (ignoredPackages instanceof Array)
						{
							for (var i = modules.length - 1; i >=0; i--)
							{
								var module	= modules[i];
								
								if ("rawRequest" in module && ignoredPackages.indexOf(module.rawRequest) > -1)
									modules.splice(i, 1);
							}
						}
						else
						if (ignoredPackages === "*")
						{
							// Remove all imported
							for (var i = modules.length - 1; i >=0; i--)
							{
								var module	= modules[i];
								
								if ("rawRequest" in module)
									modules.splice(i, 1);
							}
						}
					});
				}
								
				// Modify Module IDs to use requested path instead of integer
				compiler.plugin("optimize-module-ids", function (modules)
				{
					modules.forEach(function (module)
					{
						if ("rawRequest" in module)
						{
							var request	= module.rawRequest;
							
							if (request.charAt(0) === ".") // Relative Paths
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

module.exports	= SharedRequirePlugin;