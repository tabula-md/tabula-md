import * as editorPreview from "../../scripts/browser-smoke/suites/editor-preview.mjs";
import * as editorVisual from "../../scripts/browser-smoke/suites/editor-visual.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(editorPreview, {
  scenarioNames: [
    "keeps editor rails and line controls coherent across modes",
    "preserves the visible source while changing modes",
    "restores each local tab's viewport",
    "dismisses toolbar tooltips after activation",
    "applies formatting commands without losing editor state",
    "renders Markdown source tokens at their natural width",
    "normalizes source editing and pasted line endings",
  ],
  timeout: 90_000,
});

registerCapabilityScenarios(editorVisual, {
  scenarioNames: [
    "inserts inline toolbar syntax into editable source",
    "keeps toolbar insertions editable in Visual mode",
  ],
});
