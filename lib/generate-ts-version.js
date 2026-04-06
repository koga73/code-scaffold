import fs from "fs-extra";
import path from "node:path";
import babel from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

const traverse = _traverse.default;
const generate = _generate.default;

// ---------------------------------------------------------------------------
// Top-level orchestration (scaffold-specific)
// ---------------------------------------------------------------------------

export async function generateTsVersion(outputDir, sourceName) {
  console.log(`🔄 Generating TypeScript version for: ${sourceName}`);

  // 1. Files are already copied by code-scaffold — just convert them
  const jsFiles = await getAllJsFiles(outputDir);

  await Promise.all(
    jsFiles
      .filter((jsFile) => !jsFile.includes("node_modules"))
      .map(async (jsFile) => {
        try {
          await convertJsFileToTs(jsFile);
          console.log(`✅ Converted: ${path.relative(outputDir, jsFile)}`);
        } catch (error) {
          console.warn(`⚠️  Warning: Could not convert ${jsFile}: ${error.message}`);
        }
      })
  );

  await updateTypeScriptConfig(outputDir);
  await updatePackageJsonForTs(outputDir);
  await updateViteConfigForTs(outputDir);
  await updateHtmlForTs(outputDir);
  await replaceProjectName(outputDir, sourceName);

  console.log(`✅ TypeScript version generated successfully in: ${outputDir}`);
}

// Scaffold-specific: rebuilds package.json with TS deps and postinstall hook
export async function updatePackageJsonForTs(outputDir) {
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);

  const cleanPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    private: packageJson.private,
    type: "module",
    dependencies: {
      "@acadia-ui/accordion": "2.0.0",
      "@acadia-ui/action-set": "2.0.0",
      "@acadia-ui/badge": "2.0.0",
      "@acadia-ui/banner": "2.0.0",
      "@acadia-ui/breadcrumbs": "2.0.0",
      "@acadia-ui/button": "2.0.0",
      "@acadia-ui/card": "2.0.0",
      "@acadia-ui/charts": "2.0.0",
      "@acadia-ui/checkbox": "2.0.0",
      "@acadia-ui/chip": "2.0.0",
      "@acadia-ui/datatable": "2.0.1",
      "@acadia-ui/datepicker": "2.0.0",
      "@acadia-ui/drag-drop": "2.0.0",
      "@acadia-ui/dropdown": "2.0.0",
      "@acadia-ui/empty-state": "2.0.0",
      "@acadia-ui/fieldset": "2.0.0",
      "@acadia-ui/file-upload": "2.0.0",
      "@acadia-ui/grid": "2.0.0",
      "@acadia-ui/heading": "2.0.0",
      "@acadia-ui/key-value": "2.0.0",
      "@acadia-ui/loading": "2.0.0",
      "@acadia-ui/menu": "2.0.0",
      "@acadia-ui/modal": "2.0.0",
      "@acadia-ui/navigation": "2.0.0",
      "@acadia-ui/popover": "2.0.0",
      "@acadia-ui/radio": "2.0.0",
      "@acadia-ui/rich-text-editor": "2.0.0",
      "@acadia-ui/segmented-buttons": "2.0.0",
      "@acadia-ui/selection-card": "2.0.0",
      "@acadia-ui/sidemenu": "2.0.0",
      "@acadia-ui/sidesheet": "2.0.0",
      "@acadia-ui/status": "2.0.0",
      "@acadia-ui/tabs": "2.0.0",
      "@acadia-ui/text-link": "2.0.0",
      "@acadia-ui/textbox": "2.0.0",
      "@acadia-ui/theme": "2.0.0",
      "@acadia-ui/toast": "2.0.0",
      "@acadia-ui/toggle": "2.0.0",
      "@acadia-ui/toolbar": "2.0.0",
      "@acadia-ui/tooltip": "2.0.0",
      "@acadia-ui/treeview": "2.0.0",
      "@acadia-ui/wizard": "2.0.0",
      "@growthos/react-super-scroller": "0.3.0",
      "@growthos/ui-analytics": "7.0.2",
      "@growthos/ui-app-sdk": "8.0.1",
      react: "18.2.0",
      "react-dom": "18.2.0",
      "react-router-dom": "6.14.1",
      "reset-css": "5.0.1"
    },
    devDependencies: {
      "@cypress/code-coverage": "^3.12.34",
      "@growthos/eslint-config-shared": "^2.3.0",
      "@types/node": "^20.0.0",
      "@types/react": "18.2.0",
      "@types/react-dom": "18.2.0",
      "@typescript-eslint/eslint-plugin": "^8.38.0",
      "@typescript-eslint/parser": "^8.38.0",
      "@vitejs/plugin-react": "^4.7.0",
      "cross-env": "^7.0.3",
      cypress: "^13.7.3",
      husky: "^9.0.11",
      nyc: "^15.1.0",
      rimraf: "^6.0.1",
      sass: "^1.57.1",
      typescript: "^5.0.0",
      vite: "^7.1.6",
      "vite-plugin-istanbul": "^7.2.0"
    },
    scripts: {
      start: "vite --force",
      build: "cross-env GENERATE_SOURCEMAP=false vite build",
      test: "cypress run --browser chrome --headless --component",
      "test:dev": "cypress open",
      coverage: "rimraf ./.nyc_output && cypress run --browser chrome --headless --component",
      lint: "eslint .",
      "lint:ci": "eslint ./src",
      "type-check": "tsc --noEmit",
      postinstall: "node scripts/patch-react-hooks-eslint.cjs",
      prepare: "husky"
    },
    browserslist: packageJson.browserslist || {
      production: [">0.2%", "not dead", "not op_mini all"],
      development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
    },
    engine: {
      node: ">=20.0.0"
    }
  };

  await fs.writeFile(packageJsonPath, JSON.stringify(cleanPackageJson, null, 2));
}

// Scaffold-specific: replaces Sample project name tokens in the output
export async function replaceProjectName(outputDir, newName) {
  const filesToUpdate = ["package.json", "README.md", "index.html"];

  await Promise.all(
    filesToUpdate.map(async (file) => {
      const filePath = path.join(outputDir, file);
      if (await fs.pathExists(filePath)) {
        let content = await fs.readFile(filePath, "utf8");
        content = content.replaceAll("PM.OS.Sample.UI", `PM.OS.${newName}.UI`);
        content = content.replaceAll("os-apps-ui-sample", `os-apps-ui-${newName.toLowerCase()}`);
        await fs.writeFile(filePath, content);
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Low-level conversion utilities (exported for reuse by future features)
// ---------------------------------------------------------------------------

export async function getAllJsFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir);

  const promises = items.map(async (item) => {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory() && !["node_modules", ".git", "build", "dist"].includes(item)) {
      return getAllJsFiles(fullPath);
    }
    if (stat.isFile() && /\.(js|jsx)$/.test(item)) {
      return [fullPath];
    }
    return [];
  });

  const results = await Promise.all(promises);
  files.push(...results.flat());

  return files;
}

export async function convertJsFileToTs(jsFilePath) {
  const source = await fs.readFile(jsFilePath, "utf8");

  const ast = babel.parse(source, {
    sourceType: "module",
    plugins: ["jsx", "decorators-legacy"]
  });

  const typeAnnotations = inferTypes(ast);
  addTypeAnnotations(ast, typeAnnotations);
  preserveJsxParentheses(ast);

  const { code } = generate(ast, {
    retainLines: true,
    jsescOption: { minimal: true }
  });

  const tsCode = addTypeImports(code, jsFilePath);

  const tsFilePath = jsFilePath.replace(/\.jsx?$/, jsFilePath.endsWith(".jsx") ? ".tsx" : ".ts");
  await fs.writeFile(tsFilePath, tsCode);
  await fs.remove(jsFilePath);
}

export async function updateTypeScriptConfig(outputDir) {
  const tsConfig = {
    compilerOptions: {
      jsx: "react-jsx",
      target: "esnext",
      module: "esnext",
      esModuleInterop: true,
      allowJs: true,
      skipLibCheck: true,
      useDefineForClassFields: true,
      lib: ["DOM", "DOM.Iterable"],

      /* Bundler mode */
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,

      /* Linting */
      strict: true,

      /* Path mapping */
      paths: {
        "@/*": ["./src/*"]
      },
      typeRoots: ["./node_modules/@types"]
    },
    include: ["src"],
    exclude: ["build"]
  };

  await fs.writeFile(path.join(outputDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
}

export async function updateViteConfigForTs(outputDir) {
  const jsConfigPath = path.join(outputDir, "vite.config.js");
  const tsConfigPath = path.join(outputDir, "vite.config.ts");

  const configPath = (await fs.pathExists(jsConfigPath)) ? jsConfigPath : tsConfigPath;

  if (!(await fs.pathExists(configPath))) return;

  let content = await fs.readFile(configPath, "utf8");
  content = content.replace(/extension:\s*\[([^\]]*)\]/, 'extension: [".js", ".jsx", ".ts", ".tsx"]');

  await fs.writeFile(tsConfigPath, content);

  if (configPath === jsConfigPath) {
    await fs.remove(jsConfigPath);
  }
}

export async function updateHtmlForTs(outputDir) {
  const htmlPath = path.join(outputDir, "index.html");

  if (await fs.pathExists(htmlPath)) {
    let content = await fs.readFile(htmlPath, "utf8");
    content = content.replaceAll('src="/src/index.jsx"', 'src="/src/index.tsx"');
    await fs.writeFile(htmlPath, content);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported — specific to Babel AST manipulation)
// ---------------------------------------------------------------------------

function inferTypes(ast) {
  const types = {
    components: {},
    hooks: {},
    functions: {},
    variables: {}
  };

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (t.isIdentifier(node.id)) {
        if (node.id.name === "routes" && t.isArrayExpression(node.init)) {
          types.variables[node.id.name] = "RouteObject[]";
        } else if (node.id.name === "ROUTES" && t.isObjectExpression(node.init)) {
          types.variables[node.id.name] = "RouteConfig";
        } else if (
          node.id.name.startsWith("state") &&
          path.findParent((p) => p.isCallExpression() && p.node.callee.name === "useState")
        ) {
          types.variables[node.id.name] = "any";
        }
      }
    },

    FunctionDeclaration(path) {
      const { node } = path;
      if (t.isIdentifier(node.id)) {
        if (node.id.name.startsWith("Page") || node.id.name.endsWith("Component")) {
          types.functions[node.id.name] = { returnType: "React.ReactElement", params: [] };
        } else if (node.id.name === "onRenderHandler") {
          types.functions[node.id.name] = {
            returnType: "void",
            params: [{ name: "app", type: "React.ReactNode" }]
          };
        } else if (node.id.name === "stringToNumberOrNull") {
          types.functions[node.id.name] = {
            returnType: "number | null",
            params: [{ name: "value", type: "string | null" }]
          };
        } else if (node.id.name === "initCommInterface") {
          types.functions[node.id.name] = {
            returnType: "Promise<void>",
            params: [{ name: "appCode", type: "string" }]
          };
        }
      }
    },

    ArrowFunctionExpression(path) {
      const { parent } = path;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
        const { name } = parent.id;
        if (name.startsWith("Page") || name.endsWith("Component")) {
          types.functions[name] = { returnType: "React.ReactElement", params: [] };
        }
      }
    },

    FunctionParameter(path) {
      const { node } = path;
      if (t.isIdentifier(node)) {
        if (
          node.name === "app" &&
          path.findParent(
            (p) => p.isFunctionDeclaration() && p.node.id?.name === "onRenderHandler"
          )
        ) {
          types.functions.onRenderHandler = {
            returnType: "void",
            params: [{ name: "app", type: "React.ReactNode" }]
          };
        }
      }
    }
  });

  return types;
}

function addTypeAnnotations(ast, typeAnnotations) {
  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (t.isIdentifier(node.id) && node.id.name === "appEl") {
        return;
      }
      if (t.isIdentifier(node.id) && typeAnnotations.variables[node.id.name]) {
        const typeName = typeAnnotations.variables[node.id.name];
        node.id.typeAnnotation = t.tsTypeAnnotation(createTypeFromString(typeName));
      }
    },

    FunctionDeclaration(path) {
      const { node } = path;
      if (t.isIdentifier(node.id) && typeAnnotations.functions[node.id.name]) {
        const funcType = typeAnnotations.functions[node.id.name];
        node.returnType = t.tsTypeAnnotation(createTypeFromString(funcType.returnType));

        if (funcType.params && funcType.params.length > 0) {
          node.params.forEach((param, index) => {
            if (t.isIdentifier(param) && funcType.params[index]) {
              const paramType = funcType.params[index].type;
              param.typeAnnotation = t.tsTypeAnnotation(createTypeFromString(paramType));
            }
          });
        }
      }
    },

    ArrowFunctionExpression(path) {
      const { parent } = path;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
        const { name } = parent.id;
        if (typeAnnotations.functions[name]) {
          const funcType = typeAnnotations.functions[name];
          path.node.returnType = t.tsTypeAnnotation(createTypeFromString(funcType.returnType));
        }
      }
    }
  });
}

function createTypeFromString(typeStr) {
  switch (typeStr) {
    case "React.ReactElement":
      return t.tsTypeReference(
        t.tsQualifiedName(t.identifier("React"), t.identifier("ReactElement"))
      );
    case "React.ReactNode":
      return t.tsTypeReference(
        t.tsQualifiedName(t.identifier("React"), t.identifier("ReactNode"))
      );
    case "RouteObject[]":
      return t.tsArrayType(t.tsTypeReference(t.identifier("RouteObject")));
    case "RouteConfig":
      return t.tsTypeReference(t.identifier("RouteConfig"));
    case "HTMLElement | null":
      return t.tsUnionType([
        t.tsTypeReference(t.identifier("HTMLElement")),
        t.tsNullKeyword()
      ]);
    case "void":
      return t.tsVoidKeyword();
    case "Promise<void>":
      return t.tsTypeReference(
        t.identifier("Promise"),
        t.tsTypeParameterInstantiation([t.tsVoidKeyword()])
      );
    case "number | null":
      return t.tsUnionType([t.tsNumberKeyword(), t.tsNullKeyword()]);
    case "string | null":
      return t.tsUnionType([t.tsStringKeyword(), t.tsNullKeyword()]);
    default:
      return t.tsAnyKeyword();
  }
}

function addTypeImports(code, filePath) {
  return getTypeDefinitions(filePath) + "\n" + code;
}

function getTypeDefinitions(filePath) {
  if (filePath.includes("router") || filePath.includes("routes")) {
    return `import { RouteObject } from "react-router-dom";

type RouteConfigItem = { url: string; name: string };

export type RouteConfig = Record<string, RouteConfigItem>;
`;
  }

  if (
    filePath.includes("index") ||
    filePath.includes("PageHome") ||
    filePath.includes("Page")
  ) {
    return `import React from "react";\n`;
  }

  return "";
}

function preserveJsxParentheses(ast) {
  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (t.isJSXElement(node.init) || t.isJSXFragment(node.init)) {
        node.init = t.parenthesizedExpression(node.init);
      }
    }
  });
}
