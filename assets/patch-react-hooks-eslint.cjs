// scripts/patch-react-hooks-eslint.js
// Patches eslint-plugin-react-hooks to export configs['flat/recommended'],
// which @growthos/eslint-config-shared requires via extends: ["react-hooks/recommended"]
// in flat config mode. Run automatically via postinstall.
const fs = require("fs");
const path = require("path");

const PATCH_MARKER = "// [flat/recommended patch applied]";
// Provide a rules-only flat/recommended so @growthos/eslint-config-shared can resolve
// extends: ["react-hooks/recommended"] in flat config mode. The parent config already
// registers the plugin itself, so we must not redefine it here.
const PATCH_CODE = `
${PATCH_MARKER}
if (module.exports.configs && !module.exports.configs["flat/recommended"]) {
  module.exports.configs["flat/recommended"] = {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  };
}
`;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(PATCH_MARKER)) return false; // already patched

  fs.writeFileSync(filePath, content + PATCH_CODE);
  return true;
}

function findReactHooksLocations() {
  const locations = [];

  // Root-level install
  const root = path.resolve(__dirname, "../node_modules/eslint-plugin-react-hooks");
  if (fs.existsSync(root)) locations.push(root);

  // Nested inside @growthos/eslint-config-shared
  const nested = path.resolve(
    __dirname,
    "../node_modules/@growthos/eslint-config-shared/node_modules/eslint-plugin-react-hooks"
  );
  if (fs.existsSync(nested)) locations.push(nested);

  return locations;
}

const locations = findReactHooksLocations();

if (locations.length === 0) {
  console.log("patch-react-hooks-eslint: eslint-plugin-react-hooks not found, skipping");
  process.exit(0);
}

let patched = 0;
for (const loc of locations) {
  const candidates = [
    path.join(loc, "index.js"),
    path.join(loc, "cjs", "eslint-plugin-react-hooks.development.js"),
    path.join(loc, "cjs", "eslint-plugin-react-hooks.production.min.js")
  ];

  for (const file of candidates) {
    if (patchFile(file)) {
      console.log(`patch-react-hooks-eslint: patched ${file}`);
      patched++;
    }
  }
}

if (patched === 0) {
  console.log("patch-react-hooks-eslint: no files needed patching");
}
