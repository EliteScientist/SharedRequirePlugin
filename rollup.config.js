import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";
import del from "rollup-plugin-delete";
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
	{
		input: "src/SharedRequirePlugin.ts",
		external: [
			"webpack",
			"webpack/lib/util/semver",
			"webpack/lib/sharing/ProvideSharedPlugin",
			"webpack/lib/RawModule"
		],
		output: [
			{
				file: "dist/webpack.esm.js",
				format: "es"
			},
			{
				file: "dist/webpack.cjs",
				format: "cjs",
				name: "sharedrequireplugin"
			}
		],
		plugins: [
			nodeResolve(),

			typescript({
				sourceMap: false
			}),
			//terser(), terser currently has a bug with modules: https://github.com/rollup/plugins/issues/1366
			del({
				targets: [
					"dist"
				],
				hook: "buildStart"
			})
		]
	},
	{
		input: "dist/dts/SharedRequirePlugin.d.ts",
		output: {
			file: "dist/webpack.d.ts",
			format: "es"
		},
		plugins: [
			dts({
				compilerOptions: {
					paths: {
						"*": [
							"dts/*"
						]
					}
				}
			})
		]
	},
	{
		input: "src/RollupPlugin.ts",
		external: [
			"rollup",
		],
		output: [
			{
				file: "dist/rollup.esm.js",
				format: "es"
			},
			{
				file: "dist/rollup.cjs.js",
				format: "cjs",
				name: "sharedrequireplugin"
			}
		],
		plugins: [
			nodeResolve(),
			typescript({
				sourceMap: false
			}),
			//terser(), terser currently has a bug with modules: https://github.com/rollup/plugins/issues/1366
		]
	},
	{
		input: "dist/dts/RollupPlugin.d.ts",
		output: {
			file: "dist/rollup.d.ts",
			format: "es"
		},
		plugins: [
			dts({
				compilerOptions: {
					paths: {
						"*": [
							"dts/*"
						]
					}
				}
			}),
			del({
				targets: "dist/dts/",
				hook: "buildEnd"
			})
		]
	}
];