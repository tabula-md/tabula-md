#!/usr/bin/env node
import { readHookPayload, readState, repoRootFromCwd, statePathForPayload, writeState } from "./lib/hook-io.mjs";
import { filterMissingValidationsForChangedFiles, getCurrentTurnMissingValidations, getMissingValidations } from "./lib/validation-policy.mjs";
import { collectWorkflowStatus, hasCurrentPullRequestHandoffComplete, readCurrentBranchChangedFiles } from "../../scripts/lib/workflow-status.mjs";
import { clearPrHandoffRequirements, formatStopReason, getCurrentTurnMissingWorkflowSteps, getMissingWorkflowSteps } from "./lib/workflow-policy.mjs";

const payload = await readHookPayload();
const statePath = statePathForPayload(payload);
let state = readState(statePath);
const root = repoRootFromCwd(payload?.cwd);
const status = collectWorkflowStatus(root);
let missingValidations = getCurrentTurnMissingValidations(state, getMissingValidations(state));
let missingWorkflowSteps = getMissingWorkflowSteps(state);

if (status.clean && status.pr && missingValidations.length > 0) {
  missingValidations = filterMissingValidationsForChangedFiles(
    missingValidations,
    readCurrentBranchChangedFiles(root)
  );
}

if (missingWorkflowSteps.some((step) => isPrHandoffStep(step.key))) {
  if (hasCurrentPullRequestHandoffComplete(status)) {
    state = clearPrHandoffRequirements(state);
    writeState(statePath, state);
    missingWorkflowSteps = getMissingWorkflowSteps(state);
  }
}

if (missingValidations.length === 0 && missingWorkflowSteps.length === 0) {
  process.exit(0);
}

const currentTurnMissingWorkflowSteps = getCurrentTurnMissingWorkflowSteps(state, missingWorkflowSteps);
const blockWorkflowSteps = currentTurnMissingWorkflowSteps.length > 0;
const reason = formatStopReason({
  missingValidations: blockWorkflowSteps ? [] : missingValidations,
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

function isPrHandoffStep(key) {
  return key === "pr-handoff" || key === "pr-title" || key === "pr-body" || key === "pr-metadata";
}
