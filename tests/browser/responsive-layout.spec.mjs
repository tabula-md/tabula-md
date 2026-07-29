import * as editorPreview from "../../scripts/browser-smoke/suites/editor-preview.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(editorPreview, {
  scenarioNames: [
    "hides editor gutters on mobile",
    "keeps the mobile formatting toolbar usable",
    "keeps mobile preview content and controls usable",
  ],
  timeout: 90_000,
});
