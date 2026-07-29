import * as editorPreview from "../../scripts/browser-smoke/suites/editor-preview.mjs";
import * as editorVisual from "../../scripts/browser-smoke/suites/editor-visual.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(editorVisual, {
  scenarioNames: [
    "renders consistent code block styles",
    "reveals math source without layout jumps",
    "reveals inline Markdown source without style leaks",
    "renders supported Markdown and MDX components",
  ],
});

registerCapabilityScenarios(editorPreview, {
  scenarioNames: ["renders and sanitizes the supported Markdown preview"],
  timeout: 90_000,
});
