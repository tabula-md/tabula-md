#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This script runs both from the repository root in CI and from
// `packages/tabula` during that package's prepack lifecycle. Resolve the
// repository from this file so the package contract is independent of cwd.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(root, "packages/tabula");
const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));

assert.equal(
  manifest.exports["./workbench/internal"],
  undefined,
  "The private workbench surface must not be published as a package export.",
);

const exportedFiles = Object.values(manifest.exports).flatMap((entry) =>
  typeof entry === "string" ? [entry] : Object.values(entry),
);
for (const relativeFile of exportedFiles) {
  const filePath = path.join(packageRoot, relativeFile);
  assert.ok(existsSync(filePath), `Package export is missing: ${relativeFile}`);
}

const packed = spawnSync(
  "npm",
  ["pack", "--workspace", "@tabula-md/tabula", "--dry-run", "--ignore-scripts", "--json"],
  { cwd: root, encoding: "utf8" },
);
assert.equal(packed.status, 0, packed.stderr || "npm pack --dry-run failed");

const packedResult = JSON.parse(packed.stdout);
// npm 11 returns the packed workspace as an array. npm 12 returns a map
// keyed by workspace name. Accept both, plus the direct package result used by
// some npm releases, so the release gate stays compatible with npm@latest.
const packResult = Array.isArray(packedResult)
  ? packedResult[0]
  : packedResult?.files
    ? packedResult
    : packedResult?.[manifest.name];
assert.ok(
  packResult && typeof packResult === "object" && Array.isArray(packResult.files),
  `npm pack --json did not return a package manifest for ${manifest.name}.`,
);
const packedFiles = new Set(packResult.files.map(({ path: file }) => file));
for (const requiredFile of [
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/collaboration.js",
  "dist/collaboration.d.ts",
  "dist/roomClient.js",
  "dist/roomClient.d.ts",
  "dist/share-link.js",
  "dist/jsonShareLinkModel.d.ts",
  "dist/text-patches.js",
  "dist/textPatches.d.ts",
  "dist/workspace-limits.js",
  "dist/workspaceLimits.d.ts",
  "dist/workbench.js",
  "dist/workbench.css",
  "src/workbench/index.d.ts",
]) {
  assert.ok(packedFiles.has(requiredFile), `Packed artifact is missing: ${requiredFile}`);
}

const nodeSafeContracts = [
  ["./dist/share-link.js", ["getJsonShareImportRoute", "JSON_SHARE_API_PREFIX"]],
  ["./dist/text-patches.js", ["getTextPatchesForChange"]],
  ["./dist/workspace-limits.js", ["WORKSPACE_ROOM_MAX_CONTENT_BYTES", "WORKSPACE_ROOM_MAX_DOCUMENTS"]],
];
for (const [specifier, names] of nodeSafeContracts) {
  const module = await import(new URL(`../packages/tabula/${specifier}`, import.meta.url));
  for (const name of names) {
    assert.ok(name in module, `Node-safe package contract ${specifier} is missing ${name}`);
  }
}
assert.ok(
  !packedFiles.has("dist/workbench/internal.js"),
  "Packed artifact must not contain the private workbench entrypoint.",
);

console.log(`Tabula package contract passed (${packResult.entryCount} files).`);
