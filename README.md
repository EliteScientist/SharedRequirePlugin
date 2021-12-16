# Shared Require Plugin for Webpack

This Webpack plugin enables you to share the code require()'d in one project with another. With this plugin, you can compile code in one js file and use it in another without having duplicate instances of code.

## Install

> use "npm install sharedrequireplugin" to download and install

## Examples
> ### ProjectA - Contains JQuery - 
> webpack.config.js
``` javascript
const SharedRequirePlugin = require("sharedrequireplugin");
module.exports = {
    entry: "...",
    output: {..},
    resolve: {...},
    module: {...},
    plugins: [
		new SharedRequirePlugin({
			provides: {
				"@polymer/polymer": { eager: true },
				"jquery": { eager: true },
				
				...
			}
		}),
    ]
};
```

> ### ProjectB - Uses JQuery - 
> webpack.config.js
``` javascript
const SharedRequirePlugin = require("sharedrequireplugin");
module.exports = {
    entry: "...",
    output: {..},
    resolve: {...},
    module: {...},
    plugins: [
		new SharedRequirePlugin({
			externalModules: [
				/\@polymer\/polymer/g,
				"jquery"
			]
		}),
        ...
    ]
};
```

externalModules now support regex expressions.

This will reduce the size of ProjectB's JS file.
Ensure ProjectA is loaded before ProjectB attempts to use the jquery library.

If ProjectA has not been loaded then a the require("jquery") call in ProjectB will return null.

This component uses the internal ProvideSharedPlugin to enter shared modules into webpack's shared space, then provides a mechanism for accessing these shared modules globally.