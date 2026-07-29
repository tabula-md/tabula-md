import * as performance from "../../scripts/browser-smoke/suites/performance.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(performance, {
  tag: "@performance",
  timeout: 120_000,
});
