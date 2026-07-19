import { waitForProductionDeployment } from "./production-deployment.mjs";

const expectedCommit = process.env.TABULA_EXPECTED_BUILD_COMMIT || process.env.GITHUB_SHA;
if (!expectedCommit) {
  throw new Error("Set TABULA_EXPECTED_BUILD_COMMIT or GITHUB_SHA before verifying production");
}

const origin = process.env.TABULA_PRODUCTION_ORIGIN || "https://tabula.md";
const buildInfo = await waitForProductionDeployment({
  origin,
  expectedCommit,
  attempts: Number(process.env.TABULA_PRODUCTION_VERIFY_ATTEMPTS || 60),
  intervalMs: Number(process.env.TABULA_PRODUCTION_VERIFY_INTERVAL_MS || 5_000),
});

console.log(
  `Tabula.md production verified at ${buildInfo.commit} (app ${buildInfo.appVersion}, core ${buildInfo.coreVersion})`,
);
