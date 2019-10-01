# Roller

Roller is a minimal configuration build script based on rollup

## Basic usage

```
yarn add https://github.com/subhero24/roller.git -D
```

In your package.json, you need a source field that points to the entry point.
The main, module, or umd:main are all optional and roller will build the corresponding file if present.

For example:

```json
{
	"main": "dist/index.js",
	"module": "dist/index.es.js",
	"source": "src/index.js"
}
```

Now you can build your module with:

```
yarn run roller
```

Or create and watch your build with:

```
yarn run roller --watch
```
