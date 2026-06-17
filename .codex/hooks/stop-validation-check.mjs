#!/usr/bin/env node
import { readHookPayload, readState, statePathForPayload } from "./lib/hook-io.mjs";
import { getMissingValidations } from "./lib/validation-policy.mjs";
import { formatStopReason, getMissingWorkflowSteps } from "./lib/workflow-policy.mjs";

const payload = await readHookPayload();
const state = readState(statePathForPayload(payload));
const missingValidations = getMissingValidations(state);
const missingWorkflowSteps = getMissingWorkflowSteps(state);

if (missingValidations.length === 0 && missingWorkflowSteps.length === 0) {
  process.exit(0);
}

const reason = formatStopReason({ missingValidations, missingWorkflowSteps });

if (payload?.stop_hook_active) {
  console.log(JSON.stringify({
    systemMessage: reason
  }));
  process.exit(0);
}

console.log(JSON.stringify({
  decision: "block",
  reason
}));
process.exit(0);
