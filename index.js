//Copies files from input to output directory while ignoring specific rules
//This forms the foundation of the template

import {promises as fs} from "fs";
import path from "path";

export const DEFAULT_REPLACE_OPTIONS = {
	fileName: true,
	filePath: true,
	fileContents: false,
	maintainCase: false
};

async function main({input, output, rulesIgnore, rulesReplace, tokens}) {
	const inputDir = path.resolve(input);
	const outputDir = path.resolve(output);
	if (await isDirectory(outputDir)) {
		throw new Error(`Output directory already exists: '${outputDir}'`);
	}

	console.log(`COPY FROM:\n  '${inputDir}'\nTO:\n  '${outputDir}'`);
	await copyFiles(inputDir, outputDir, rulesIgnore, rulesReplace, tokens);
	console.log();
	console.log("COMPLETE!");
}
export default main;

async function copyFiles(inputDir, outputDir, rulesIgnore, rulesReplace, tokens) {
	const files = await fs.readdir(inputDir);
	const filesLen = files.length;
	for (let i = 0; i < filesLen; i++) {
		const file = files[i];

		//See if we should ignore the input
		const inputPath = path.join(inputDir, file);
		const isIgnoredReason = shouldIgnore(file, inputPath, rulesIgnore);
		if (isIgnoredReason) {
			console.log(`IGNORED: ${inputPath}`);
			console.log(`  REASON: '${isIgnoredReason}'`);
			continue;
		}

		//See if we should replace the output
		let outputPath = path.join(outputDir, file);
		const replacement = await doReplace(file, inputPath, outputPath, rulesReplace, tokens);
		if (replacement) {
			if (replacement.fileName) {
				console.log(`REPLACE FILE NAME: '${file}'`);
				console.log(`  REASON: '${replacement.description}'`);
				outputPath = path.join(outputDir, replacement.fileName);
			}
			if (replacement.filePath) {
				console.log(`REPLACE FILE PATH: '${outputPath}'`);
				console.log(`  REASON: '${replacement.description}'`);
				outputPath = path.resolve(replacement.filePath);
			}
		}

		//Create the output directory if it doesn't exist
		if (!(await isDirectory(outputDir))) {
			console.log();
			console.log(`MKDIR: '${outputDir}'`);
			await fs.mkdir(outputDir, {recursive: true});
		}
		//If the input is a directory, recursively copy the files
		if (await isDirectory(inputPath)) {
			await copyFiles(inputPath, outputPath, rulesIgnore, rulesReplace, tokens);
		} else {
			console.log(`COPY: '${inputPath}'`);
			console.log(`  TO: '${outputPath}'`);
			if (replacement && replacement.fileContents) {
				console.log(`  REPLACE FILE CONTENTS: '${outputPath}'`);
				replacement.description.map((description) => console.log(`    REASON: '${description}'`));
				await fs.writeFile(outputPath, replacement.fileContents);
			} else {
				await fs.copyFile(inputPath, outputPath);
			}
		}
	}
}

function isDirectory(filePath) {
	return fs
		.stat(filePath)
		.then((stats) => stats.isDirectory())
		.catch(() => false);
}

//Returns the reason the file should be ignored or false if it should not be ignored
function shouldIgnore(fileName, filePath, rules) {
	const rulesLen = rules.length;
	for (let i = 0; i < rulesLen; i++) {
		const rule = rules[i];
		switch (rule.type) {
			case "regex":
				if (rule.value.test(filePath)) {
					return rule.description;
				}
				break;
			case "string":
				//Handle if our rule is a path or not
				if (/[\/\\]/.test(rule.value)) {
					if (filePath.includes(rule.value.replace(/[\/\\]/g, path.sep))) {
						return rule.description;
					}
				} else {
					if (fileName.includes(rule.value)) {
						return rule.description;
					}
				}
				break;
			default:
				throw new Error(`Invalid ignore rule type: '${rule.type}'`);
		}
	}
	return false;
}

//Returns an object with the reason the file should be replaced or false if it should not be replaced
async function doReplace(fileName, inputPath, outputPath, rules, tokens) {
	const output = {
		description: [],
		fileName: null,
		filePath: null,
		fileContents: null
	};

	const rulesLen = rules.length;
	for (let i = 0; i < rulesLen; i++) {
		const rule = rules[i];
		const {description, find, replace, options = {}, files = null} = rule;
		const findValue = find.value;
		const {
			fileName: optionFileName = DEFAULT_REPLACE_OPTIONS.fileName,
			filePath: optionFilePath = DEFAULT_REPLACE_OPTIONS.filePath,
			fileContents: optionFileContents = DEFAULT_REPLACE_OPTIONS.fileContents,
			maintainCase: optionFileCase = DEFAULT_REPLACE_OPTIONS.maintainCase
		} = options;

		//Setup booleans for what we need to replace
		let needsReplaceFileName = optionFileName;
		let needsReplaceFilePath = optionFilePath;
		let needsReplaceFileContents = optionFileContents && (await isDirectory(inputPath)) === false;
		if (files && needsReplaceFileContents) {
			needsReplaceFileContents &= files.some((file) => fileName === file || outputPath.includes(file.replace(/[\/\\]/g, path.sep)));
		}

		//Read file contents if needed
		const fileContents = needsReplaceFileContents ? await fs.readFile(inputPath, "utf8") : "";
		//See if we match the rule and update the booleans
		switch (find.type) {
			case "regex":
				needsReplaceFileName &= findValue.test(fileName);
				needsReplaceFilePath &= findValue.test(outputPath);
				needsReplaceFileContents &= findValue.test(fileContents);
				break;
			case "string":
				needsReplaceFileName &= fileName.includes(findValue);
				needsReplaceFilePath &= outputPath.includes(findValue.replace(/[\/\\]/g, path.sep));
				needsReplaceFileContents &= fileContents.includes(findValue);
				break;
			default:
				throw new Error(`Invalid replace rule type: '${rule.type}'`);
		}
		//If we need to replace, push the description
		if (needsReplaceFileName || needsReplaceFilePath || needsReplaceFileContents) {
			output.description.push(description);
		}

		//Replace the values
		if (needsReplaceFileName) {
			output.fileName = replaceAll(fileName, findValue, replace, tokens, optionFileCase);
		}
		if (needsReplaceFilePath) {
			output.filePath = replaceAll(
				outputPath,
				findValue instanceof RegExp ? findValue : findValue.replace(/[\/\\]/g, path.sep).replace(/[\\]/g, "\\\\"),
				replace.replace(/[\/\\]/g, path.sep),
				tokens,
				optionFileCase
			);
		}
		if (needsReplaceFileContents) {
			output.fileContents = replaceAll(output.fileContents ?? fileContents, findValue, replace, tokens, optionFileCase);
		}
	}
	if (output.fileName || output.filePath || output.fileContents) {
		return output;
	}
	return false;
}

function replaceAll(input, find, replace, tokens, maintainCase = DEFAULT_REPLACE_OPTIONS.maintainCase) {
	//Reset the regex
	if (find instanceof RegExp) {
		find.lastIndex = 0;
	}
	let output = "";
	let lastPosition = 0;
	for (const match of input.matchAll(find)) {
		const matchStr = match[0];
		const matchIndex = match.index;
		const replacement = replace in tokens ? tokens[replace] : replace;
		const replacementCased = maintainCase ? matchCase(matchStr, replacement) : replacement;
		output += input.substring(lastPosition, matchIndex) + replacementCased;
		lastPosition = matchIndex + matchStr.length;
	}
	output += input.substring(lastPosition, input.length);
	return output;
}

function matchCase(original, replacement) {
	//All uppercase
	if (original === original.toUpperCase()) {
		return replacement.toUpperCase();
	}
	//All lowercase
	if (original === original.toLowerCase()) {
		return replacement.toLowerCase();
	}
	//First letter uppercase
	if (original === original.charAt(0).toUpperCase() + original.slice(1)) {
		return replacement.charAt(0).toUpperCase() + replacement.slice(1);
	}
	return replacement;
}
