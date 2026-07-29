import * as editorPreview from "../../scripts/browser-smoke/suites/editor-preview.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(editorPreview, {
  scenarioNames: [
    "keeps bookmarks aligned between editor and preview",
    "resolves fragment and workspace links in preview",
  ],
  timeout: 90_000,
});
