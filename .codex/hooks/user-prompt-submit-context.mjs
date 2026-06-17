#!/usr/bin/env node
import { readHookPayload, readState, statePathForPayload, writeState } from "./lib/hook-io.mjs";
import { buildWorkflowReminder, recordPostMergeSyncRequired, shouldMarkPostMergeSyncRequired } from "./lib/workflow-policy.mjs";

const payload = await readHookPayload();
const reminder = buildWorkflowReminder(payload?.prompt);

if (shouldMarkPostMergeSyncRequired(payload?.prompt)) {
  const statePath = statePathForPayload(payload);
  const state = readState(statePath);
  writeState(statePath, recordPostMergeSyncRequired(state));
}

if (!reminder) {
  process.exit(0);
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: reminder
  }
}));
