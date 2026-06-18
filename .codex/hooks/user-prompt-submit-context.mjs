#!/usr/bin/env node
import { readHookPayload, readState, statePathForPayload, writeState } from "./lib/hook-io.mjs";
import { evaluatePromptInput, recordPostMergeSyncRequired, recordPromptSubmitted, shouldMarkPostMergeSyncRequired } from "./lib/workflow-policy.mjs";

const payload = await readHookPayload();
const evaluation = evaluatePromptInput(payload?.prompt);

if (evaluation.decision === "block") {
  console.log(JSON.stringify({
    decision: "block",
    reason: evaluation.reason
  }));
  process.exit(0);
}

const statePath = statePathForPayload(payload);
let state = recordPromptSubmitted(readState(statePath));

if (shouldMarkPostMergeSyncRequired(payload?.prompt)) {
  state = recordPostMergeSyncRequired(state);
}

writeState(statePath, state);

if (!evaluation.additionalContext) {
  process.exit(0);
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: evaluation.additionalContext
  }
}));
