#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const stylesDir = path.join(rootDir, "tabula-app/src/styles");
const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/g;
const errors = [];
const baseCssPath = path.join(stylesDir, "base.css");

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

for (const error of getThemeContrastErrors(readFileSync(baseCssPath, "utf8"))) {
  errors.push(`tabula-app/src/styles/base.css ${error}`);
}

if (errors.length > 0) {
  console.error("Surface color check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Surface color check passed. Theme tokens are readable and raw hex colors are confined to base tokens.");

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
  return relativePath === "tabula-app/src/styles/base.css" && line.trimStart().startsWith("--");
}

function getThemeContrastErrors(cssText) {
  const themes = [
    { name: "light", body: cssText.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "" },
    { name: "dark", body: cssText.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "" },
  ];
  const textTokens = ["--text-primary", "--text-muted", "--text-soft"];
  const surfaceTokens = [
    "--surface-workbench",
    "--surface-overlay",
    "--surface-muted",
    "--surface-hover",
    "--surface-active",
  ];

  return themes.flatMap(({ name, body }) => {
    const tokens = parseHexTokens(body);
    return textTokens.flatMap((textToken) =>
      surfaceTokens.flatMap((surfaceToken) => {
        const foreground = tokens.get(textToken);
        const background = tokens.get(surfaceToken);
        if (!foreground || !background) {
          return [`is missing a hex value for ${name} ${!foreground ? textToken : surfaceToken}`];
        }

        const ratio = getContrastRatio(foreground, background);
        return ratio < 4.5
          ? [`has ${name} ${textToken} contrast ${ratio.toFixed(2)}:1 on ${surfaceToken}; expected at least 4.5:1`]
          : [];
      }),
    );
  });
}

function parseHexTokens(body) {
  return new Map(
    Array.from(body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g), ([, name, value]) => [
      name,
      value,
    ]),
  );
}

function getContrastRatio(foreground, background) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
