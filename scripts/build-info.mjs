import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const appPackage = JSON.parse(readFileSync(new URL("../tabula-app/package.json", import.meta.url), "utf8"));
const corePackage = JSON.parse(readFileSync(new URL("../packages/tabula/package.json", import.meta.url), "utf8"));

export const TABULA_BUILD_INFO_PATH = ".well-known/tabula-build.json";

const readGitHead = () =>
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();

export const resolveBuildCommit = (environment = process.env) => {
  const commit =
    environment.TABULA_BUILD_COMMIT ||
    environment.CF_PAGES_COMMIT_SHA ||
    environment.GITHUB_SHA ||
    readGitHead();

  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error(`Tabula.md build commit must be a full Git SHA, received ${JSON.stringify(commit)}`);
  }

  return commit.toLowerCase();
};

export const createBuildInfo = (environment = process.env) => ({
  schemaVersion: 1,
  service: "tabula-md",
  commit: resolveBuildCommit(environment),
  appVersion: appPackage.version,
  coreVersion: corePackage.version,
});

export const createBuildInfoPlugin = () => ({
  name: "tabula-build-info",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: TABULA_BUILD_INFO_PATH,
      source: `${JSON.stringify(createBuildInfo(), null, 2)}\n`,
    });
  },
});
