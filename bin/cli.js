#!/usr/bin/env node

import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import CodeScaffold, {DEFAULT_REPLACE_OPTIONS} from "../index.js";

import packageJson from "../package.json" with {type: "json"};
const {name: packageName, version: packageVersion} = packageJson;

const DEFAULT_CONFIG = {
	tokens: {},
	ignore: [],
	replace: []
};
const DEFAULT_CONFIG_FILE_NAME = `.${packageName}.config.json`;

// Short flag aliases: maps single-char flag to its long-form key
const SHORT_FLAG_ALIASES = {
	l: "language"
};

(async function main(args) {
	console.log(`${packageName} v${packageVersion}`);
	console.log();

	if (!args.length) {
		showCommands();
		process.exit(0);
	}
	const parsedArgs = parseArgs(args);
	const {input, output, config, language, lang, ...remainingArgs} = parsedArgs;

	// Normalize --language / --lang / -l to a canonical value
	const rawLang = language ?? lang;
	const isTypeScript = ["typescript", "ts", "tsx"].includes(String(rawLang).toLowerCase());
	const canonicalLanguage = isTypeScript ? "typescript" : "javascript";

	const configPath = path.resolve(config ?? path.join(input, DEFAULT_CONFIG_FILE_NAME));

	try {
		if (!input) {
			throw new Error("Required '--input' directory");
		}
		if (!output) {
			throw new Error("Required '--output' directory");
		}
		if (!(await fsExists(configPath))) {
			throw new Error(`Required '--config' file`);
		} else {
			console.log(`USING CONFIG: '${configPath}'`);
		}

		console.log(`LANGUAGE: ${canonicalLanguage}`);
		console.log();

		const {tokens, ignore, replace} = await parseConfig(configPath, remainingArgs);
		const outputDir = path.resolve(output);

		await CodeScaffold({input, output, rulesIgnore: ignore, rulesReplace: replace, tokens});

		// Post-processing: inject patch script into output
		await injectPatchScript(outputDir);

		// Post-processing: TypeScript conversion
		if (isTypeScript) {
			const {generateTsVersion} = await import("../lib/generate-ts-version.js");
			await generateTsVersion(outputDir, tokens.name);
		}

		console.log();
		console.log("COMPLETE!");
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})(process.argv.splice(2));

// Copies the bundled patch script into <outputDir>/scripts/ and ensures the
// output package.json has a postinstall hook pointing to it.
async function injectPatchScript(outputDir) {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const assetSrc = path.resolve(__dirname, "../assets/patch-react-hooks-eslint.cjs");
	const scriptsDir = path.join(outputDir, "scripts");
	const assetDest = path.join(scriptsDir, "patch-react-hooks-eslint.cjs");

	await fs.mkdir(scriptsDir, {recursive: true});
	await fs.copyFile(assetSrc, assetDest);

	// Add postinstall to the output's package.json (if present)
	const pkgPath = path.join(outputDir, "package.json");
	if (await fsExists(pkgPath)) {
		const pkgJson = JSON.parse(await fs.readFile(pkgPath, "utf8"));
		if (!pkgJson.scripts) {
			pkgJson.scripts = {};
		}
		pkgJson.scripts.postinstall = "node scripts/patch-react-hooks-eslint.cjs";
		await fs.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2));
	}
}

function parseArgs(args) {
	const parsed = {};
	const argsLen = args.length;
	for (let i = 0; i < argsLen; i++) {
		const arg = args[i];
		if (arg.startsWith("--")) {
			const key = arg.substring(2).toLowerCase().replace(/[^\w]/g, "");
			const value = i + 1 < argsLen ? (!args[i + 1].startsWith("--") ? args[i + 1] : true) : true;
			parsed[key] = value;
		} else if (/^-[a-z]$/i.test(arg)) {
			// Short flag: -l ts
			const shortKey = arg.substring(1).toLowerCase();
			const longKey = SHORT_FLAG_ALIASES[shortKey] ?? shortKey;
			const value = i + 1 < argsLen ? (!args[i + 1].startsWith("-") ? args[i + 1] : true) : true;
			parsed[longKey] = value;
		}
	}
	return parsed;
}

function parseConfig(configFile, remainingArgs) {
	return fs
		.readFile(configFile, "utf-8")
		.then((configJson) => JSON.parse(configJson))
		.then((config) => {
			const tokens = Object.assign({}, config.tokens ? config.tokens : DEFAULT_CONFIG.tokens, remainingArgs);
			return {
				tokens,
				ignore: config.ignore ? config.ignore.map(parseRuleIgnore) : DEFAULT_CONFIG.ignore,
				replace: config.replace ? config.replace.map((rule) => parseRuleReplace(rule)) : DEFAULT_CONFIG.replace
			};
		});
}

function parseRuleIgnore(rule) {
	if (isObject(rule)) {
		const {description, type, value} = rule;
		switch (type) {
			case "regex":
				return {
					description,
					type,
					value: new RegExp(value.expression, value.flags ?? "")
				};
			case "string":
				return {
					description,
					type,
					value
				};
			default:
				throw new Error(`Invalid rule type: '${type}'`);
		}
	}
	return {
		description: rule,
		type: "string",
		value: rule
	};
}

function parseRuleReplace({description, find, replace, options = DEFAULT_REPLACE_OPTIONS, ...remaining}) {
	if (isObject(find)) {
		const {type, value} = find;
		switch (type) {
			case "regex":
				return {
					description: description ?? replace,
					find: {
						type,
						value: new RegExp(value.expression, value.flags ?? "")
					},
					replace,
					options,
					...remaining
				};
			case "string":
				return {
					description: description ?? replace,
					find: {
						type,
						value
					},
					replace,
					options,
					...remaining
				};
			default:
				throw new Error(`Invalid rule type: '${type}'`);
		}
	}
	return {
		description: description ?? replace,
		find: {
			type: "string",
			value: find
		},
		replace,
		options,
		...remaining
	};
}

function fsExists(filePath) {
	return fs
		.stat(filePath)
		.then(() => true)
		.catch(() => false);
}

function isObject(obj) {
	return obj !== null && typeof obj === "object";
}

function showCommands() {
	console.log(`USAGE:`);
	console.log(`  ${packageName} --input <inputDir> --output <outputDir>`);
	console.log(`  ${packageName} --input <inputDir> --output <outputDir> --config <configFile>`);
	console.log(`  ${packageName} --input <inputDir> --output <outputDir> --language <js|ts>`);
	console.log();
	console.log(`LANGUAGE FLAG:`);
	console.log(`  --language, --lang, -l    Accepted values:`);
	console.log(`    javascript, js, jsx     → JavaScript output (default)`);
	console.log(`    typescript, ts, tsx     → TypeScript output`);
	console.log();
	console.log(`REMARKS:`);
	console.log(`  if a config is not specified, it will look for a file named '${DEFAULT_CONFIG_FILE_NAME}' in the input directory.`);
	console.log(`  replacement tokens can be specified in the config file or as command line arguments.`);
	console.log(`  specify tokens using '--<tokenName> <tokenValue>' for example '--name MyApp'`);
	console.log();
}
