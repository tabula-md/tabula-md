import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TABULA_BUILD_INFO_PATH } from "./build-info.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const buildInfo = JSON.parse(readFileSync(new URL(`../dist/${TABULA_BUILD_INFO_PATH}`, import.meta.url), "utf8"));
const appPackage = JSON.parse(readFileSync(new URL("../tabula-app/package.json", import.meta.url), "utf8"));
const corePackage = JSON.parse(readFileSync(new URL("../packages/tabula/package.json", import.meta.url), "utf8"));
const expectedCommit = (
  process.env.TABULA_EXPECTED_BUILD_COMMIT ||
  process.env.GITHUB_SHA ||
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" })
).trim().toLowerCase();

assert.deepEqual(buildInfo, {
  schemaVersion: 1,
  service: "tabula-md",
  commit: expectedCommit,
  appVersion: appPackage.version,
  coreVersion: corePackage.version,
});

console.log(`Tabula.md build provenance passed for ${expectedCommit}`);
