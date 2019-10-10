import FS from 'fs-extra';
import Minimist from 'minimist';
import { rollup, watch } from 'rollup';

import nodePlugin from 'rollup-plugin-commonjs';
import babelPlugin from 'rollup-plugin-babel';
import terserPlugin from 'rollup-plugin-terser';
import bundlesizePlugin from 'rollup-plugin-bundle-size';
import noderesolvePlugin from 'rollup-plugin-node-resolve';

const SHEBANG = '#!/usr/bin/env node';

let args = Minimist(process.argv, {
	alias: { w: 'watch', i: 'input' },
	default: { watch: false },
});

let pkg = FS.readJSONSync('package.json');

let bundleInput = () => {
	if (pkg.source) return pkg.source;
	if (FS.existsSync('index.js')) return 'index.js';
	if (FS.existsSync('src/index.js')) return 'src/index.js';
};

let bundleExternals = () => {
	let dependencies = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];

	return dependency => {
		if (dependency.startsWith('@babel/runtime')) {
			return dependencies.includes('@babel/runtime');
		} else {
			return dependencies.includes(dependency);
		}
	};
};

let bundleExecutables = () => {
	if (pkg.bin != undefined) {
		if (typeof pkg.bin === 'string') {
			return [pkg.bin];
		} else if (typeof pkg.bin === 'object') {
			return Object.values(pkg.bin);
		}
	}
	return [];
};

let bundlePlugins = () => {
	let babel = babelPlugin({ runtimeHelpers: true });
	let node = nodePlugin();
	let terser = terserPlugin.terser({ mangle: false, safari10: true, sourcemap: true });
	let resolve = noderesolvePlugin();
	let bundlesize = bundlesizePlugin();
	return [babel, resolve, node, terser, bundlesize];
};

let run = async () => {
	let input = {
		input: bundleInput(),
		external: bundleExternals(),
		plugins: bundlePlugins(),
	};

	let output = [];

	let types = {};
	types['main'] = 'cjs';
	types['module'] = 'es';
	types['umd:main'] = 'umd';

	let executables = bundleExecutables();

	for (let prop in types) {
		let file = pkg[prop];
		if (file == undefined) continue;

		if (input.input === file) {
			throw new Error(
				`Output file "${file}" is the same as input file. This would override your input file, please specify another input or output file.`,
			);
		} else {
			output.push({
				file,
				format: types[prop],
				banner: executables.includes(file) && SHEBANG,
				sourcemap: true,
			});
		}
	}

	if (args.watch) {
		let watcher = await watch({ ...input, output });
		watcher.on('event', event => {
			if (event.error) {
				console.error(event.error.message);
			}
		});
	} else {
		try {
			let bundle = await rollup(input);
			for (let config of output) {
				await bundle.write(config);
			}
		} catch (error) {
			console.error(error.message);
		}
	}
};

run();
