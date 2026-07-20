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

import path from "node:path";
import { LoadResult, RenderedChunk, Plugin } from "rollup";

export function SharedRequirePlugin (options: SharedRequirePluginOptions = {}) : Plugin
{
	const sharedTypes = (options.externalModules ?? options.external)?.map((sharedItem) =>
	{
		if (typeof sharedItem === "string")
			return new RegExp(`^${sharedItem}$`);

		return sharedItem;
	});

	const sharedPrefixes = options.externalModulePrefixes;
	const modulesRequire = options.globalModulesRequire ?? "requireSharedModule";
	const modulesRegister = options.globalModulesRegister ?? "registerSharedModule";
	const provides = options.provides
		? options.provides.map((pattern) => new RegExp(pattern))
		: undefined;

	const providedModels = options.modules;

	const idToFileMap = new Map();

	const isShared = (request: string): boolean =>
	{
		if (sharedPrefixes?.some((prefix) => request.startsWith(prefix)))
			return true;

		return sharedTypes?.some((moduleName) =>
			moduleName.test(request)
		) ?? false;
	};

	const toProvide = (request: string): boolean =>
	{
		return provides?.some((pattern) => pattern.test(request)) ?? false;
	};

	return {
		name: 'shared-require', // this name will show up in logs and errors
		
		resolveId: {
			order: 'pre',
			async handler(source: string, requester: string | undefined, options)
			{
				if (isShared(source))
				{
					return {
						id: source,
						moduleSideEffects: true
					};
				}

				// Only provide modules used the in the application and not dependencies of included libraries
				if (toProvide(source))
				{
					return {
						id: source,
						moduleSideEffects: "no-treeshake",
						meta: {sharedId: source}
					};
				}

				return null;
			}
		},

		async load (id: string): Promise<LoadResult>
		{
			if (isShared(id)) 
			{
				const importName = path.basename(id).replace(/\W/,"_");
				const code = `
export const ${importName}SharedModule = globalThis.${modulesRequire}("${id}");
export default ${importName}SharedModule.default;
					`;

				return {
					code,
					ast: this.parse(code),
					moduleSideEffects: "no-treeshake",
					syntheticNamedExports: `${importName}SharedModule`
				}
			}

			if (toProvide(id))
			{
				const resolution = await this.resolve(id);

				const mod = await this.load(
					resolution
						? {... resolution, moduleSideEffects: true, resolveDependencies: true}
						: {id, moduleSideEffects: true, resolveDependencies: true}
				);

				if (resolution)
					idToFileMap.set(resolution.id, id);

				const requestImportVar = id.replace(/\W/g,"_");
												
				let code = `export const ${requestImportVar} = globalThis.${modulesRequire}("${id}");`

				if (mod.hasDefaultExport)
					code += `export default ${requestImportVar}.default`;

				return {
					code,
					moduleSideEffects: "no-treeshake",
					ast: this.parse(code),
					syntheticNamedExports: requestImportVar
				}
			}

			return null;
		},

		intro(chunk: RenderedChunk): string
		{
			if (!provides || provides.length < 1)
				return "";

			const results: string[] = [];
			results.push(
				generateHeader(
					modulesRegister,
					modulesRequire
				)
			);
			
			idToFileMap.forEach((id, fileId) =>
			{
				const mod = this.getModuleInfo(fileId);

				if (mod)
					results.push(`${modulesRegister}("${id}", {${mod.code}});`);
			});
			
			return results.join('\n');
		}
	};
}



interface SharedRequirePluginOptions
{
	external?: string[];				// Kept for compatibility
	externalModules?: string[];			// Used to create consistent api between webpack
	externalModulePrefixes?: string[];	// Assume all modules that begin with this prefix is shared
	provides?: string[]; 				// Packages provided by this project.
	modules?: Record<string, string[]>;

	globalModulesRequire?: string;
	globalModulesRegister?: string;
}

function generateHeader(registerMethod: string, requireMethod: string): string
{
	return `
const componentMap = new Map();
globalThis.${registerMethod} = (moduleName, moduleInstance) =>
{
	componentMap.set(moduleName, moduleInstance);
};

const existingSharedRequire = ${requireMethod};

globalThis.${requireMethod} = (moduleName) =>
{
	return existingSharedRequire?.(moduleName) ?? componentMap.get(moduleName);
};
`;
}