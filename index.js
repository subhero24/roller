import Minimist from 'minimist';
import Filesystem from 'fs-extra';

import { rollup, watch } from 'rollup';

import nodePlugin from '@rollup/plugin-commonjs';
import nodeResolvePlugin from '@rollup/plugin-node-resolve';

import babelPlugin from 'rollup-plugin-babel';
import terserPlugin from 'rollup-plugin-terser';
import bundlesizePlugin from 'rollup-plugin-bundle-size';
import localResolvePlugin from 'rollup-plugin-local-resolve';

const SHEBANG = '#!/usr/bin/env node';

let args = Minimist(process.argv.slice(2), {
	alias: { w: 'watch' },
	default: { watch: false },
});

let source = args._[0];

let pkg = Filesystem.readJSONSync('package.json');
let bundleExternals = () => {
	let dependencies = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];

	return dependency => {
		for (let packageDependency of dependencies) {
			let dependencyId;
			if (typeof dependency === 'string') {
				dependencyId = dependency;
			} else if (typeof dependency === 'object' && dependency.id != undefined) {
				dependencyId = dependency.id;
			}
			if (dependencyId === packageDependency || dependencyId.startsWith(packageDependency + '/')) {
				return true;
			}
		}
		return false;
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
	let node = nodePlugin();
	let babel = babelPlugin({ runtimeHelpers: true });
	let terser = terserPlugin.terser({
		mangle: false,
		safari10: true,
		sourcemap: true,
	});
	let bundlesize = bundlesizePlugin();
	let nodeResolve = nodeResolvePlugin({ preferBuiltins: false });
	let localResolve = localResolvePlugin();

	return [babel, localResolve, nodeResolve, node, terser, bundlesize];
};

let run = async () => {
	let input = {
		input: source != undefined ? source : pkg.source,
		plugins: bundlePlugins(),
		external: bundleExternals(),
	};

	let output = [];

	let types = {};
	types['main'] = 'cjs';
	types['module'] = 'es';

	let executables = bundleExecutables();

	for (let prop in types) {
		let file = pkg[prop];
		if (file == undefined) continue;

		if (input.input === file) {
			throw new Error(`Output and input file can not be the same. Both are set to ${file}.`);
		} else {
			output.push({
				file,
				format: types[prop],
				banner: executables.includes(file) && SHEBANG,
				exports: 'named',
				sourcemap: args.watch,
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
