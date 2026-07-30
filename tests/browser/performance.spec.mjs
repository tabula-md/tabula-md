import * as performance from "../../scripts/browser-smoke/suites/performance.mjs";
import * as workspacePerformance from "../../scripts/browser-smoke/suites/workspace-performance.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(performance, {
  tag: "@performance",
  timeout: 120_000,
});

registerCapabilityScenarios(workspacePerformance, {
  tag: "@performance",
  timeout: 120_000,
});
