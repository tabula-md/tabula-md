#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const stylesDir = path.join(rootDir, "apps/web/src/styles");
const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/g;
const errors = [];

for (const filePath of listCssFiles(stylesDir)) {
  const relativePath = path.relative(rootDir, filePath);
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matches = line.match(rawHexPattern);
    if (!matches) {
      return;
    }

    if (isTokenDefinition(relativePath, line)) {
      return;
    }

    errors.push(`${relativePath}:${index + 1} uses raw color ${matches.join(", ")} outside base tokens`);
  });
}

if (errors.length > 0) {
  console.error("Surface color check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Surface color check passed. Raw hex colors are confined to base theme tokens.");

function listCssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listCssFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
    })
    .sort();
}

function isTokenDefinition(relativePath, line) {
  return relativePath === "apps/web/src/styles/base.css" && line.trimStart().startsWith("--");
}
