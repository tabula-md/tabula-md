#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const errors = [];

const allowedSecretFixturePaths = new Set([
  "scripts/test-codex-hooks.mjs",
]);

const generatedPathPrefixes = [
  "dist/",
  "playwright-report/",
  "test-results/",
  ".tabula-room/",
  "private-docs/",
];

const forbiddenEnvFile = (path) =>
  path === ".env" ||
  path.endsWith("/.env") ||
  path.endsWith(".env.local") ||
  path.endsWith(".env.production") ||
  path.endsWith(".env.development");

const secretPatterns = [
  { name: "OpenAI API key", pattern: /\bsk-(?:proj_)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g },
  { name: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g },
];

const roomKeyPattern = /#key=(?!<roomKey>|:roomKey|\.{3})[A-Za-z0-9_-]{16,}/g;
const publicDocProviderPattern = /\b(?:Cloudflare|Render|Fly\.io|Vercel|Netlify|Durable Objects)\b/g;
const publicDocPaths = (path) =>
  path === "README.md" ||
  path === "TODO.md" ||
  path === "TODO.ko.md" ||
  path.startsWith("docs/") ||
  path.startsWith("knowledge/");

for (const path of trackedFiles) {
  if (generatedPathPrefixes.some((prefix) => path.startsWith(prefix))) {
    errors.push(`${path}: generated, runtime, or private-ops path is tracked`);
  }

  if (forbiddenEnvFile(path)) {
    errors.push(`${path}: environment file is tracked; use .env.example only`);
  }

  const buffer = readFileSync(path);
  if (buffer.includes(0)) {
    continue;
  }

  const text = buffer.toString("utf8");
  const allowSecretFixture = allowedSecretFixturePaths.has(path);

  if (!allowSecretFixture) {
    for (const { name, pattern } of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        errors.push(`${path}: possible ${name}`);
      }
    }
  }

  if (!path.endsWith(".test.ts") && !path.includes("/fixtures/")) {
    roomKeyPattern.lastIndex = 0;
    if (roomKeyPattern.test(text)) {
      errors.push(`${path}: concrete room key appears in a tracked URL fragment`);
    }
  }

  if (publicDocPaths(path)) {
    publicDocProviderPattern.lastIndex = 0;
    const providerMatches = [...text.matchAll(publicDocProviderPattern)].map((match) => match[0]);
    if (providerMatches.length > 0) {
      errors.push(`${path}: public docs mention hosted provider detail (${[...new Set(providerMatches)].join(", ")})`);
    }
  }
}

if (errors.length > 0) {
  console.error("OSS readiness check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`OSS readiness check passed (${trackedFiles.length} tracked files).`);
