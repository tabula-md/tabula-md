import * as editorPreview from "../../scripts/browser-smoke/suites/editor-preview.mjs";
import { registerLegacySmokeScenarios } from "./support/legacySmokeScenario.mjs";

registerLegacySmokeScenarios(editorPreview, { timeout: 90_000 });
