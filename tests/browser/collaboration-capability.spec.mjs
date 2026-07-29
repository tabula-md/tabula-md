import * as collaboration from "../../scripts/browser-smoke/suites/collaboration.mjs";
import { registerCapabilitySuite } from "./support/registerCapabilityScenarios.mjs";

registerCapabilitySuite(collaboration, {
  name: "synchronizes a live collaboration workspace",
  timeout: 180_000,
});
