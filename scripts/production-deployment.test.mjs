import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionBuildInfo, waitForProductionDeployment } from "./production-deployment.mjs";

const expectedCommit = "0123456789abcdef0123456789abcdef01234567";
const matchingBuild = {
  schemaVersion: 1,
  service: "tabula-md",
  commit: expectedCommit,
  appVersion: "0.1.0",
  coreVersion: "0.8.0",
};

test("accepts an exact production build", () => {
  assert.equal(validateProductionBuildInfo(matchingBuild, expectedCommit), matchingBuild);
});

test("waits for Cloudflare Pages to converge to the expected commit", async () => {
  const builds = [{ ...matchingBuild, commit: "f".repeat(40) }, matchingBuild];
  const result = await waitForProductionDeployment({
    origin: "https://tabula.md",
    expectedCommit,
    attempts: 2,
    intervalMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => Response.json(builds.shift()),
  });

  assert.deepEqual(result, matchingBuild);
});

test("fails when production never reaches the expected commit", async () => {
  await assert.rejects(
    waitForProductionDeployment({
      origin: "https://tabula.md",
      expectedCommit,
      attempts: 2,
      intervalMs: 0,
      sleepImpl: async () => {},
      fetchImpl: async () => Response.json({ ...matchingBuild, commit: "f".repeat(40) }),
    }),
    /did not converge/,
  );
});
