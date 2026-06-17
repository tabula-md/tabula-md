#!/usr/bin/env node
import { readHookPayload, readState, statePathForPayload } from "./lib/hook-io.mjs";
import { getMissingValidations } from "./lib/validation-policy.mjs";
import { formatStopReason, getCurrentTurnMissingWorkflowSteps, getMissingWorkflowSteps } from "./lib/workflow-policy.mjs";

const payload = await readHookPayload();
const state = readState(statePathForPayload(payload));
const missingValidations = getMissingValidations(state);
const missingWorkflowSteps = getMissingWorkflowSteps(state);

if (missingValidations.length === 0 && missingWorkflowSteps.length === 0) {
  process.exit(0);
}

const currentTurnMissingWorkflowSteps = getCurrentTurnMissingWorkflowSteps(state, missingWorkflowSteps);
const blockWorkflowSteps = currentTurnMissingWorkflowSteps.length > 0;
const reason = formatStopReason({
  missingValidations,
  missingWorkflowSteps: blockWorkflowSteps ? currentTurnMissingWorkflowSteps : missingWorkflowSteps,
  blockingWorkflow: blockWorkflowSteps
});

if (missingWorkflowSteps.length === 0 || !blockWorkflowSteps) {
  console.log(JSON.stringify({
    systemMessage: reason
  }));
  process.exit(0);
}

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
