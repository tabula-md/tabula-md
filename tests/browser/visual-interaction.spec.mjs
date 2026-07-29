import * as editorVisual from "../../scripts/browser-smoke/suites/editor-visual.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(editorVisual, {
  scenarioNames: [
    "renders atomic blocks and preserves keyboard navigation",
    "keeps wrapped image source editable on narrow screens",
    "reveals separator source as plain Markdown",
    "maps pointer clicks to safe source cursors",
    "keeps the cursor visible through long documents",
    "navigates long documents without mounting every widget",
    "virtualizes large Visual documents",
  ],
});
