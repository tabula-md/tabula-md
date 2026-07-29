import * as performance from "../../scripts/browser-smoke/suites/performance.mjs";
import { registerLegacySmokeScenarios } from "./support/legacySmokeScenario.mjs";

registerLegacySmokeScenarios(performance, {
  tag: "@performance",
  timeout: 120_000,
});
