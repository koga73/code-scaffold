//Copies files from input to output directory while ignoring specific rules
//This forms the foundation of the template

import {promises as fs} from "fs";
import path from "path";

export const DEFAULT_REPLACE_OPTIONS = {
	fileName: true,
	filePath: true,
	fileContents: false,
	maintainCase: false,
	caseTransforms: null
};

export const CASE_CONDITIONS = {
	HYPHENATE: "hyphenate"
};

//Entry point: validates the output directory, applies rule conditions, then copies the files
async function main({input, output, rulesIgnore, rulesReplace, tokens}) {
	const inputDir = path.resolve(input);
	const outputDir = path.resolve(output);
	if (await isDirectory(outputDir)) {
		throw new Error(`Output directory already exists: '${outputDir}'`);
	}

	console.log(`COPY FROM:\n  '${inputDir}'\nTO:\n  '${outputDir}'`);
	const activeRulesIgnore = filterRulesByCondition(rulesIgnore, tokens, "IGNORE");
	const activeRulesReplace = filterRulesByCondition(rulesReplace, tokens, "REPLACE");
	await copyFiles(inputDir, outputDir, activeRulesIgnore, activeRulesReplace, tokens);
	console.log("\nCOMPLETE!");
}
export default main;

//Returns only the rules without a condition or whose condition is met by the tokens
function filterRulesByCondition(rules, tokens, ruleType) {
	return rules.filter(({description, condition}) => {
		if (!condition || (condition.token in tokens && matches(condition.value, String(tokens[condition.token])))) {
			return true;
		}
		console.log(`SKIP ${ruleType} RULE: '${description}'`);
		console.log(`  REASON: condition not met for token '${condition.token}' (value: '${tokens[condition.token] ?? ""}', expected: ${condition.value})`);
		return false;
	});
}

//Recursively copies the input directory to the output directory, applying ignore and replace rules
async function copyFiles(inputDir, outputDir, rulesIgnore, rulesReplace, tokens) {
	let outputDirExists = await isDirectory(outputDir);
	for (const file of await fs.readdir(inputDir)) {
		const inputPath = path.join(inputDir, file);
		const ignoredReason = shouldIgnore(file, inputPath, rulesIgnore);
		if (ignoredReason) {
			console.log(`IGNORED: ${inputPath}\n  REASON: '${ignoredReason}'`);
			continue;
		}

		const isDir = await isDirectory(inputPath);
		let outputPath = path.join(outputDir, file);
		const replacement = await doReplace(file, inputPath, outputPath, isDir, rulesReplace, tokens);
		if (replacement.fileName) {
			console.log(`REPLACE FILE NAME: '${file}'\n  REASON: '${replacement.description}'`);
			outputPath = path.join(outputDir, replacement.fileName);
		}
		if (replacement.filePath) {
			console.log(`REPLACE FILE PATH: '${outputPath}'\n  REASON: '${replacement.description}'`);
			outputPath = path.resolve(replacement.filePath);
		}

		//Only create the output directory once something is copied into it
		if (!outputDirExists) {
			console.log(`\nMKDIR: '${outputDir}'`);
			await fs.mkdir(outputDir, {recursive: true});
			outputDirExists = true;
		}

		if (isDir) {
			await copyFiles(inputPath, outputPath, rulesIgnore, rulesReplace, tokens);
			continue;
		}
		console.log(`COPY: '${inputPath}'\n  TO: '${outputPath}'`);
		if (replacement.fileContents) {
			console.log(`  REPLACE FILE CONTENTS: '${outputPath}'`);
			replacement.description.forEach((description) => console.log(`    REASON: '${description}'`));
			await fs.writeFile(outputPath, replacement.fileContents);
		} else {
			await fs.copyFile(inputPath, outputPath);
		}
	}
}

//Returns the reason the file should be ignored or false if it should not be ignored
function shouldIgnore(fileName, filePath, rules) {
	const rule = rules.find(({type, value}) => {
		switch (type) {
			case "regex":
				return matches(value, filePath);
			case "string":
				//Rules containing a slash match against the path, otherwise against the file name
				return /[\/\\]/.test(value) ? filePath.includes(toPlatformPath(value)) : fileName.includes(value);
			default:
				throw new Error(`Invalid ignore rule type: '${type}'`);
		}
	});
	return rule ? rule.description : false;
}

//Returns the descriptions of the matched rules and the replaced values (null when not replaced)
async function doReplace(fileName, inputPath, outputPath, isDir, rules, tokens) {
	const output = {description: [], fileName: null, filePath: null, fileContents: null};
	let originalContents = null;

	for (const {description, find, replace, options, files} of rules) {
		const {
			fileName: optionFileName,
			filePath: optionFilePath,
			fileContents: optionFileContents,
			maintainCase,
			caseTransforms
		} = {
			...DEFAULT_REPLACE_OPTIONS,
			...options
		};
		const findValue = toRegExp(find);
		const findPath = toRegExp(find, true);
		const isTargetFile = !files || files.some((file) => fileName === file || outputPath.includes(toPlatformPath(file)));

		const needsReplaceFileName = optionFileName && matches(findValue, fileName);
		const needsReplaceFilePath = optionFilePath && matches(findPath, outputPath);
		let needsReplaceFileContents = optionFileContents && !isDir && isTargetFile;
		if (needsReplaceFileContents) {
			originalContents ??= await fs.readFile(inputPath, "utf8");
			needsReplaceFileContents = matches(findValue, originalContents);
		}

		if (needsReplaceFileName || needsReplaceFilePath || needsReplaceFileContents) {
			output.description.push(description);
		}
		if (needsReplaceFileName) {
			output.fileName = replaceAll(fileName, findValue, replace, tokens, maintainCase, caseTransforms);
		}
		if (needsReplaceFilePath) {
			output.filePath = replaceAll(outputPath, findPath, toPlatformPath(replace), tokens, maintainCase, caseTransforms);
		}
		if (needsReplaceFileContents) {
			output.fileContents = replaceAll(output.fileContents ?? originalContents, findValue, replace, tokens, maintainCase, caseTransforms);
		}
	}
	return output;
}

//Replaces every match with the token value (or the literal replace string), optionally matching case
function replaceAll(input, find, replace, tokens, maintainCase, caseTransforms) {
	const replacement = replace in tokens ? tokens[replace] : replace;
	return input.replaceAll(find, (match) => (maintainCase ? matchCase(match, replacement, caseTransforms) : replacement));
}

//Applies the casing of the original text (UPPER, lower or Capitalized) to the replacement
function matchCase(original, replacement, caseTransforms) {
	const {ifUpper = null, ifLower = null} = caseTransforms ?? {};
	if (original === original.toUpperCase()) {
		return (ifUpper === CASE_CONDITIONS.HYPHENATE ? hyphenate(replacement) : replacement).toUpperCase();
	}
	if (original === original.toLowerCase()) {
		return (ifLower === CASE_CONDITIONS.HYPHENATE ? hyphenate(replacement) : replacement).toLowerCase();
	}
	//First letter uppercase
	if (original.charAt(0) === original.charAt(0).toUpperCase()) {
		return replacement.charAt(0).toUpperCase() + replacement.slice(1);
	}
	return replacement;
}

//Transforms spaces to hyphens and camelCase to hyphenated
//"test me 123" -> "test-me-123"
//"testMe 123" -> "test-Me-123"
function hyphenate(input) {
	return input.replace(/\s+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2");
}

//String finds are matched literally; paths are normalized to the platform separator
function toRegExp({type, value}, isPath = false) {
	switch (type) {
		case "regex":
			return value;
		case "string":
			return new RegExp(escapeRegExp(isPath ? toPlatformPath(value) : value), "g");
		default:
			throw new Error(`Invalid replace rule type: '${type}'`);
	}
}

//Resets lastIndex so global regexes don't carry state between calls
function matches(regex, input) {
	regex.lastIndex = 0;
	return regex.test(input);
}

//Escapes regex special characters so the input is matched literally
function escapeRegExp(input) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//Converts forward and back slashes to the current platform's path separator
function toPlatformPath(input) {
	return input.replace(/[\/\\]/g, path.sep);
}

//Resolves true if the path exists and is a directory
function isDirectory(filePath) {
	return fs.stat(filePath).then(
		(stats) => stats.isDirectory(),
		() => false
	);
}
