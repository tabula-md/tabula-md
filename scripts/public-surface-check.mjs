#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const errors = [];

const allowedSecretFixturePaths = new Set();

const forbiddenTrackedPaths = new Map([
  ["AGENTS.md", "local agent instructions do not belong in the public repository"],
  ["CLAUDE.md", "local agent instructions do not belong in the public repository"],
  ["WORKFLOW.md", "maintainer workflow belongs outside the public repository"],
  ["WORKFLOW.ko.md", "maintainer workflow belongs outside the public repository"],
  ["TODO.md", "maintainer planning notes belong outside the public repository"],
  ["TODO.ko.md", "maintainer planning notes belong outside the public repository"],
  ["CURRENT_TODO.md", "maintainer planning notes belong outside the public repository"],
  ["CHANGELOG.md", "release notes should be published through GitHub Releases"],
  ["scripts/apply-pr-metadata.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/knowledge-check.mjs", "internal knowledge automation belongs outside the public repository"],
  ["scripts/lib/agent-context.mjs", "internal agent automation belongs outside the public repository"],
  ["scripts/lib/pr-body-template.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/lib/pr-github.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/lib/pr-metadata.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/lib/pr-options.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/lib/workflow-automation.mjs", "internal workflow automation belongs outside the public repository"],
  ["scripts/lib/workflow-status.mjs", "internal workflow automation belongs outside the public repository"],
  ["scripts/pr-body.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/pr-handoff.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/pr-ready.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/pr-title.mjs", "internal PR automation belongs outside the public repository"],
  ["scripts/production-qa-checklist.mjs", "hosted production launch automation belongs outside the public repository"],
  ["scripts/test-codex-hooks.mjs", "local agent hook tests belong outside the public repository"],
  ["scripts/workflow-doctor.mjs", "internal workflow automation belongs outside the public repository"],
  ["scripts/workflow-maintenance.mjs", "internal workflow automation belongs outside the public repository"],
  ["scripts/workflow-status.mjs", "internal workflow automation belongs outside the public repository"],
  ["scripts/workflow-sync.mjs", "internal workflow automation belongs outside the public repository"],
]);

const forbiddenTrackedPrefixes = new Map([
  [".codex/", "local agent hooks do not belong in the public repository"],
  [".linear/", "private tracker templates do not belong in the public repository"],
  [".release/", "private release templates do not belong in the public repository"],
  ["docs/", "maintainer docs belong outside the public repository"],
  ["knowledge/", "maintainer knowledge bundles belong outside the public repository"],
  ["firebase-project/", "provider-specific project scaffolding belongs outside the public repository"],
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
const publicDocProviderPattern =
  /\b(?:Cloudflare|Render|Fly\.io|Vercel|Netlify|Durable Objects|DigitalOcean|App Engine|Google Cloud|GCP|GCS|R2)\b/g;
const publicHostedEndpointPattern = /https:\/\/(?:rooms|json|publish)\.tabula\.md\b/g;
const publicDocPaths = (path) =>
  path === "README.md" ||
  path === "PRIVACY.md" ||
  path === "CONTRIBUTING.md" ||
  path === "SECURITY.md" ||
  path === "TODO.md" ||
  path === "TODO.ko.md" ||
  /^packages\/[^/]+\/README\.md$/.test(path) ||
  /^tabula-app\/README\.md$/.test(path) ||
  path.startsWith("docs/") ||
  path.startsWith("knowledge/");

for (const path of trackedFiles) {
  if (!existsSync(path)) {
    continue;
  }

  const forbiddenPathReason = forbiddenTrackedPaths.get(path);
  if (forbiddenPathReason) {
    errors.push(`${path}: ${forbiddenPathReason}`);
  }

  for (const [prefix, reason] of forbiddenTrackedPrefixes) {
    if (path.startsWith(prefix)) {
      errors.push(`${path}: ${reason}`);
    }
  }

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

    publicHostedEndpointPattern.lastIndex = 0;
    const endpointMatches = [...text.matchAll(publicHostedEndpointPattern)].map((match) => match[0]);
    if (endpointMatches.length > 0) {
      errors.push(`${path}: public docs mention official hosted service endpoint (${[...new Set(endpointMatches)].join(", ")})`);
    }
  }
}

if (errors.length > 0) {
  console.error("Public surface check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Public surface check passed (${trackedFiles.length} tracked files).`);
