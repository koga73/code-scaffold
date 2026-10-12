# code-scaffold

Templatize code bases and scaffold them into new projects

## CLI usage

Add a `.code-scaffold.config.json` file to your input directory, then run:

```bash
npx code-scaffold --input ../SampleApp --output ./MyApp --name MyApp
```

| Argument        | Description                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| `--input`       | Directory to copy from (required)                                               |
| `--output`      | Directory to create (required, must not already exist)                          |
| `--config`      | Path to the config file (defaults to `.code-scaffold.config.json` in `--input`) |
| `--<key> <val>` | Any other argument becomes a token, overriding `tokens` in the config           |

### Config

```json
{
	"tokens": {"language": "js"},
	"ignore": [
		"package-lock.json",
		"src/router/routes.js",
		{"description": "Ignored directories", "type": "regex", "value": {"expression": "(\\.git|node_modules)$", "flags": "i"}}
	],
	"replace": [
		{
			"description": "Replace 'sample' with the name token",
			"find": {"type": "regex", "value": {"expression": "\\bsample\\b", "flags": "gi"}},
			"replace": "name",
			"options": {"fileName": true, "filePath": false, "fileContents": true, "maintainCase": true}
		}
	]
}
```

- `ignore`: a string matches the file name, or the path if it contains a `/`. A regex rule matches the full path.
- `replace`: `find` is a string or a regex (regexes need the `g` flag). `replace` is a token name, or literal text if no token has that name.
- `options` controls where a replacement applies (`fileName`, `filePath`, `fileContents`) and whether to keep the original casing (`maintainCase`). Add `files` to limit content replacement to specific files.

See [test/input/.code-scaffold.config.json](./test/input/.code-scaffold.config.json) for a full example.

### Local development

```bash
npm run test:js   # scaffolds ./test/input to ./test/output
npm run test:ts   # same, with --language typescript
npm run cli -- --input ../SampleApp --output ./MyApp --config ./my-config.json
```

## Module usage

The module expects rules in parsed form: use `RegExp` objects instead of `{expression, flags}`, and `find` is always `{type, value}`.

```js
import codeScaffold from "code-scaffold";

await codeScaffold({
	input: "../SampleApp",
	output: "./MyApp",
	tokens: {name: "MyApp", language: "ts"},
	rulesIgnore: [
		{description: "node_modules", type: "regex", value: /node_modules$/i},
		{description: "JS source", type: "regex", value: /src$/, condition: {token: "language", value: /^ts$/i}}
	],
	rulesReplace: [
		{
			description: "Replace 'sample'",
			find: {type: "regex", value: /\bsample\b/gi},
			replace: "name",
			options: {fileName: true, filePath: false, fileContents: true, maintainCase: true}
		}
	]
});
```

### Conditional rules

Any `ignore` or `replace` rule object can include a `condition`. The rule only applies when the given token's value matches the regular expression. Tokens come from the config `tokens` or from command line arguments, for example `--language typescript`. If the token is not defined, the rule is skipped.

```json
{
	"description": "Ignored if JS",
	"type": "regex",
	"condition": {
		"token": "language",
		"expression": "^(js|javascript)$",
		"flags": "i"
	},
	"value": {
		"expression": "(src-ts|\\.ts(x)?)$",
		"flags": "i"
	}
}
```
