#!/usr/bin/env node
import { repoRootFromCwd, readHookPayload } from "./lib/hook-io.mjs";
import { buildSessionWorkflowContext } from "./lib/workflow-status.mjs";

const payload = await readHookPayload();
const root = repoRootFromCwd(payload?.cwd);
const additionalContext = buildSessionWorkflowContext(root);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext
  }
}));
