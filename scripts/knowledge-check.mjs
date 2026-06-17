#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const bundleDir = path.join(rootDir, "knowledge");
const reservedNames = new Set(["index.md", "log.md"]);

const checks = [];

if (!fs.existsSync(bundleDir)) {
  fail("Missing knowledge bundle: knowledge/");
  finish();
}

const markdownFiles = listMarkdownFiles(bundleDir);
const bundleRelativeFiles = new Set(markdownFiles.map((file) => toBundlePath(file)));

if (!bundleRelativeFiles.has("index.md")) {
  fail("Missing knowledge/index.md");
}

for (const file of markdownFiles) {
  const relativePath = toBundlePath(file);
  const text = fs.readFileSync(file, "utf8");

  if (reservedNames.has(path.basename(file))) {
    checkReservedFile(relativePath, text);
  } else {
    checkConceptFile(relativePath, text);
  }

  checkInternalLinks(relativePath, text, bundleRelativeFiles);
}

finish();

function listMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  }).sort();
}

function checkReservedFile(relativePath, text) {
  if (/^---\r?\n/.test(text)) {
    fail(`${relativePath} should not use concept frontmatter`);
    return;
  }
  ok(`${relativePath} is a reserved navigation/history file`);
}

function checkConceptFile(relativePath, text) {
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    fail(`${relativePath} is missing YAML frontmatter`);
    return;
  }

  const type = readFrontmatterScalar(frontmatter, "type");
  if (!type) {
    fail(`${relativePath} frontmatter is missing required type`);
  } else {
    ok(`${relativePath} declares type: ${type}`);
  }

  const description = readFrontmatterScalar(frontmatter, "description");
  if (!description) {
    warn(`${relativePath} has no description`);
  }
}

function checkInternalLinks(relativePath, text, files) {
  const links = [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  const sourceDir = path.posix.dirname(relativePath);

  for (const href of links) {
    if (isExternalLink(href) || href.startsWith("#")) {
      continue;
    }

    const normalizedHref = href.split("#")[0].split("?")[0];
    if (!normalizedHref) {
      continue;
    }

    const target = normalizedHref.startsWith("/")
      ? normalizedHref.slice(1)
      : path.posix.normalize(path.posix.join(sourceDir, normalizedHref));

    if (target.endsWith("/")) {
      const indexTarget = `${target}index.md`;
      if (files.has(indexTarget)) {
        continue;
      }
    }

    if (!files.has(target)) {
      fail(`${relativePath} has broken knowledge link: ${href}`);
    }
  }
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[1] : null;
}

function readFrontmatterScalar(frontmatter, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m");
  const match = frontmatter.match(pattern);
  if (!match) {
    return "";
  }
  return match[1].replace(/^["']|["']$/g, "").trim();
}

function isExternalLink(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|mailto:)/i.test(href);
}

function toBundlePath(file) {
  return path.relative(bundleDir, file).split(path.sep).join("/");
}

function ok(message) {
  checks.push({ level: "ok", message });
}

function warn(message) {
  checks.push({ level: "warn", message });
}

function fail(message) {
  checks.push({ level: "fail", message });
}

function finish() {
  console.log("Knowledge bundle quality check");
  console.log("Note: this repo check is intentionally stricter than permissive OKF consumer conformance.");
  for (const check of checks) {
    console.log(`[${check.level}] ${check.message}`);
  }

  process.exit(checks.some((check) => check.level === "fail") ? 1 : 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
