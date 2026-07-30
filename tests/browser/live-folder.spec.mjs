import * as liveFolder from "../../scripts/browser-smoke/suites/live-folder.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(liveFolder, { timeout: 45_000 });
