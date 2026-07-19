import { TABULA_BUILD_INFO_PATH } from "./build-info.mjs";

const commitPattern = /^[0-9a-f]{40}$/i;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const validateProductionBuildInfo = (buildInfo, expectedCommit) => {
  if (!commitPattern.test(expectedCommit)) {
    throw new Error(`Expected production commit must be a full Git SHA, received ${JSON.stringify(expectedCommit)}`);
  }

  if (!buildInfo || typeof buildInfo !== "object") {
    throw new Error("Tabula.md production build info must be a JSON object");
  }
  if (buildInfo.schemaVersion !== 1 || buildInfo.service !== "tabula-md") {
    throw new Error("Tabula.md production build info has an unsupported identity or schema");
  }
  if (buildInfo.commit !== expectedCommit.toLowerCase()) {
    throw new Error(`Tabula.md production is ${buildInfo.commit ?? "unknown"}, waiting for ${expectedCommit}`);
  }
  if (typeof buildInfo.appVersion !== "string" || typeof buildInfo.coreVersion !== "string") {
    throw new Error("Tabula.md production build info is missing app or core version metadata");
  }

  return buildInfo;
};

export const waitForProductionDeployment = async ({
  origin,
  expectedCommit,
  attempts = 60,
  intervalMs = 5_000,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep,
}) => {
  const normalizedOrigin = origin.replace(/\/$/, "");
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = `${normalizedOrigin}/${TABULA_BUILD_INFO_PATH}?commit=${encodeURIComponent(expectedCommit)}&attempt=${attempt}`;
      const response = await fetchImpl(url, {
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Tabula.md production build info returned HTTP ${response.status}`);
      }

      return validateProductionBuildInfo(await response.json(), expectedCommit);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleepImpl(intervalMs);
      }
    }
  }

  throw new Error(
    `Tabula.md production did not converge to ${expectedCommit} after ${attempts} attempts: ${lastError?.message ?? "unknown error"}`,
  );
};
