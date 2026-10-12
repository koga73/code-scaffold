#!/usr/bin/env node

//Imports
import path from "node:path";
import {promises as fs} from "node:fs";
import {createRequire} from "node:module";

import CodeScaffold, {DEFAULT_REPLACE_OPTIONS} from "../index.js";

//package.json
const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const {name: packageName, version: packageVersion} = packageJson;

const DEFAULT_CONFIG = {
	tokens: {},
	ignore: [],
	replace: []
};
const DEFAULT_CONFIG_FILE_NAME = `.${packageName}.config.json`;

(async function main(args) {
	//Welcome message
	console.log(`${packageName} v${packageVersion}`);
	console.log();

	//Parse args into key/value pairs
	if (!args.length) {
		showCommands();
		process.exit(0);
	}
	const parsedArgs = parseArgs(args);
	const {input, output, config, ...remainingArgs} = parsedArgs;
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
		const {tokens, ignore, replace} = await parseConfig(configPath, remainingArgs);
		await CodeScaffold({input, output, rulesIgnore: ignore, rulesReplace: replace, tokens});
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})(process.argv.splice(2));

function parseArgs(args) {
	const parsed = {};
	const argsLen = args.length;
	for (let i = 0; i < argsLen; i++) {
		const arg = args[i];
		if (arg.startsWith("--")) {
			const key = arg.substring(2).toLowerCase().replace(/[^\w]/g, "");
			const value = i + 1 < argsLen ? (!args[i + 1].startsWith("--") ? args[i + 1] : true) : true;
			parsed[key] = value;
		}
	}
	return parsed;
}

function parseConfig(configFile, remainingArgs) {
	return fs
		.readFile(configFile, "utf-8")
		.then((configJson) => JSON.parse(configJson))
		.then((config) => {
			//Merge tokens with remaining args
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
		const {description, type, value, condition} = rule;
		switch (type) {
			case "regex":
				return {
					description,
					type,
					value: new RegExp(value.expression, value.flags ?? ""),
					condition: parseCondition(condition)
				};
			case "string":
				return {
					description,
					type,
					value,
					condition: parseCondition(condition)
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

function parseRuleReplace({description, find, replace, options = DEFAULT_REPLACE_OPTIONS, condition, ...remaining}) {
	remaining.condition = parseCondition(condition);
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

//Condition format: {"token": "<tokenName>", "expression": "<regex>", "flags": "<flags>"}
function parseCondition(condition) {
	if (condition === undefined || condition === null) {
		return null;
	}
	if (!isObject(condition) || typeof condition.token !== "string" || typeof condition.expression !== "string") {
		throw new Error(`Invalid rule condition: '${JSON.stringify(condition)}'. Expected {"token": string, "expression": string, "flags"?: string}`);
	}
	const {token, expression, flags} = condition;
	return {
		token,
		value: new RegExp(expression, flags ?? "")
	};
}

function fsExists(path) {
	return fs
		.stat(path)
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
	console.log();
	console.log(`REMARKS:`);
	console.log(`  if a config is not specified, it will look for a file named '${DEFAULT_CONFIG_FILE_NAME}' in the input directory.`);
	console.log(`  replacement tokens can be specified in the config file or as command line arguments.`);
	console.log(`  specify tokens using '--<tokenName> <tokenValue>' for example '--name MyApp'`);
	console.log();
}
