import * as workspace from "../../scripts/browser-smoke/suites/workspace-menu.mjs";
import { registerCapabilitySuite } from "./support/registerCapabilityScenarios.mjs";

registerCapabilitySuite(workspace, {
  name: "restores workspace storage and workspace chrome state",
  timeout: 180_000,
});
