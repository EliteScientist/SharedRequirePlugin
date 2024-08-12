'use strict';

var path = require('node:path');

function _interopNamespaceDefault(e) {
   var n = Object.create(null);
   if (e) {
      Object.keys(e).forEach(function (k) {
         if (k !== 'default') {
            var d = Object.getOwnPropertyDescriptor(e, k);
            Object.defineProperty(n, k, d.get ? d : {
               enumerable: true,
               get: function () { return e[k]; }
            });
         }
      });
   }
   n.default = e;
   return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);

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
function SharedRequirePlugin(options = {}) {
    const sharedTypes = options.external ?? [];
    return {
        name: 'shared-require',
        resolveId: {
            order: 'pre',
            async handler(request, requester, options) {
                if (sharedTypes.includes(request)) {
                    return {
                        id: request,
                        moduleSideEffects: true
                    };
                }
                return null;
            }
        },
        load(id) {
            if (sharedTypes.includes(id)) {
                const importName = path__namespace.basename(id).replace(/\W/, "_");
                return {
                    code: `
export const ${importName}SharedModule = globalThis.requireSharedModule("${id}");
export default ${importName}SharedModule.default;
					`,
                    moduleSideEffects: "no-treeshake",
                    syntheticNamedExports: `${importName}SharedModule`
                };
            }
            return null;
        }
    };
}

exports.SharedRequirePlugin = SharedRequirePlugin;
