#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const coreRoot = path.join(root, "packages/tabula/src");
const appRoot = path.join(root, "tabula-app/src");
const coreWorkbenchRoot = path.join(coreRoot, "workbench");
const retiredAppDirectories = ["components", "hooks", "stores"];

const errors = [];

const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const forbiddenCoreImports = [
  {
    name: "React",
    test: (source) => source === "react" || source.startsWith("react/") || source === "react-dom" || source.startsWith("react-dom/"),
  },
  {
    name: "CodeMirror",
    test: (source) => source.startsWith("@codemirror/"),
  },
  {
    name: "Socket.IO client",
    test: (source) => source === "socket.io-client" || source.startsWith("socket.io-client/"),
  },
  {
    name: "Vite",
    test: (source) => source === "vite" || source.startsWith("vite/") || source.startsWith("@vitejs/"),
  },
];

const toRepoPath = (filePath) => path.relative(root, filePath).replaceAll(path.sep, "/");

const isCoreWorkbenchFile = (filePath) => {
  const normalizedWorkbenchRoot = `${path.resolve(coreWorkbenchRoot)}${path.sep}`;
  return path.resolve(filePath).startsWith(normalizedWorkbenchRoot);
};

const collectSourceFiles = (directory) => {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of readdirSync(currentDirectory)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) {
        continue;
      }

      const entryPath = path.join(currentDirectory, entry);
      const stats = statSync(entryPath);
      if (stats.isDirectory()) {
        visit(entryPath);
      } else if (sourceExtensions.has(path.extname(entryPath))) {
        files.push(entryPath);
      }
    }
  };

  visit(directory);
  return files.sort();
};

for (const directoryName of retiredAppDirectories) {
  const directory = path.join(appRoot, directoryName);
  const files = collectSourceFiles(directory);
  if (files.length > 0) {
    errors.push(
      `${toRepoPath(directory)}: keep app modules with their feature, or use ui/shared for feature-neutral primitives`,
    );
  }
}

const parseSourceFile = (filePath) => {
  const text = readFileSync(filePath, "utf8");
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
};

const formatLocation = (sourceFile, node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${toRepoPath(sourceFile.fileName)}:${position.line + 1}:${position.character + 1}`;
};

const getModuleSpecifierText = (node) => {
  if (
    ts.isImportDeclaration(node) ||
    ts.isExportDeclaration(node)
  ) {
    return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }

  return null;
};

const reportCoreImportBoundaries = (sourceFile) => {
  const visit = (node) => {
    const moduleSpecifier = getModuleSpecifierText(node);
    if (moduleSpecifier) {
      const forbiddenImport = forbiddenCoreImports.find(({ test }) => test(moduleSpecifier));
      if (forbiddenImport) {
        errors.push(
          `${formatLocation(sourceFile, node)}: packages/tabula must not import ${forbiddenImport.name} (${moduleSpecifier})`,
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const collectFileLocalBindings = (sourceFile) => {
  const localBindings = new Set();

  const addName = (name) => {
    if (ts.isIdentifier(name)) {
      localBindings.add(name.text);
    } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) {
          addName(element.name);
        }
      }
    }
  };

  const visit = (node) => {
    if (ts.isImportClause(node)) {
      if (node.name) {
        localBindings.add(node.name.text);
      }
      if (node.namedBindings && ts.isNamespaceImport(node.namedBindings)) {
        localBindings.add(node.namedBindings.name.text);
      }
    } else if (ts.isImportSpecifier(node)) {
      localBindings.add(node.name.text);
    } else if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      if (node.name) {
        addName(node.name);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return localBindings;
};

const isDeclarationName = (node) => {
  const parent = node.parent;
  return Boolean(
    parent &&
      "name" in parent &&
      parent.name === node &&
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isInterfaceDeclaration(parent) ||
        ts.isTypeAliasDeclaration(parent) ||
        ts.isEnumDeclaration(parent) ||
        ts.isImportSpecifier(parent) ||
        ts.isImportClause(parent) ||
        ts.isNamespaceImport(parent)),
  );
};

const isPropertyAccessName = (node) =>
  ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;

const isObjectPropertyName = (node) =>
  node.parent &&
  "name" in node.parent &&
  node.parent.name === node &&
  (ts.isPropertyAssignment(node.parent) ||
    ts.isPropertySignature(node.parent) ||
    ts.isMethodDeclaration(node.parent) ||
    ts.isMethodSignature(node.parent));

const reportCoreBrowserGlobals = (sourceFile) => {
  const localBindings = collectFileLocalBindings(sourceFile);
  const forbiddenGlobals = ["window", "document", "localStorage", "sessionStorage", "indexedDB", "fetch", "btoa", "atob"];

  const visit = (node) => {
    if (
      ts.isIdentifier(node) &&
      forbiddenGlobals.includes(node.text) &&
      !localBindings.has(node.text) &&
      !isDeclarationName(node) &&
      !isPropertyAccessName(node) &&
      !isObjectPropertyName(node)
    ) {
      errors.push(
        `${formatLocation(sourceFile, node)}: packages/tabula must not reference browser global '${node.text}'`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const resolvesInsideCore = (sourceFile, moduleSpecifier) => {
  if (!moduleSpecifier.startsWith(".")) {
    return false;
  }

  const resolved = path.resolve(path.dirname(sourceFile.fileName), moduleSpecifier);
  const normalizedCoreRoot = `${path.resolve(coreRoot)}${path.sep}`;
  return resolved === path.resolve(coreRoot) || resolved.startsWith(normalizedCoreRoot);
};

const reportAppCoreImports = (sourceFile) => {
  const visit = (node) => {
    const moduleSpecifier = getModuleSpecifierText(node);
    if (!moduleSpecifier) {
      ts.forEachChild(node, visit);
      return;
    }

    const isPublishedWorkbenchImport = moduleSpecifier === "@tabula-md/tabula/workbench";
    const isPrivateWorkbenchImport = moduleSpecifier === "@tabula-md/tabula-private/workbench";

    if (moduleSpecifier.startsWith("@tabula-md/tabula/") && !isPublishedWorkbenchImport) {
      errors.push(
        `${formatLocation(sourceFile, node)}: tabula-app must import @tabula-md/tabula through its public root API or published workbench subpath`,
      );
    }

    if (moduleSpecifier.startsWith("@tabula-md/tabula-private/") && !isPrivateWorkbenchImport) {
      errors.push(
        `${formatLocation(sourceFile, node)}: tabula-app must use the declared private workbench entrypoint`,
      );
    }

    if (
      moduleSpecifier.includes("packages/tabula") ||
      resolvesInsideCore(sourceFile, moduleSpecifier)
    ) {
      errors.push(
        `${formatLocation(sourceFile, node)}: tabula-app must not deep import packages/tabula internals (${moduleSpecifier})`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

for (const filePath of collectSourceFiles(coreRoot)) {
  const sourceFile = parseSourceFile(filePath);
  if (!isCoreWorkbenchFile(filePath)) {
    reportCoreImportBoundaries(sourceFile);
    reportCoreBrowserGlobals(sourceFile);
  }
}

for (const filePath of collectSourceFiles(appRoot)) {
  reportAppCoreImports(parseSourceFile(filePath));
}

if (errors.length > 0) {
  console.error("Boundary check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Boundary check passed.");
