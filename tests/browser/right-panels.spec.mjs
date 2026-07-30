import * as panels from "../../scripts/browser-smoke/suites/panels.mjs";
import { registerCapabilityScenarios } from "./support/registerCapabilityScenarios.mjs";

registerCapabilityScenarios(panels, { timeout: 90_000 });
