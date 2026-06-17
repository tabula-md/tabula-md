#!/usr/bin/env node
import { readHookPayload, readState, statePathForPayload } from "./lib/hook-io.mjs";
import { getMissingValidations } from "./lib/validation-policy.mjs";

const payload = await readHookPayload();
const state = readState(statePathForPayload(payload));
const missing = getMissingValidations(state);

if (missing.length === 0) {
  process.exit(0);
}

const lines = [
  "Tabula Codex hook: validation may be missing for this session.",
  ...missing.map((item) => `- ${item.command}: ${item.reason}`)
];

console.error(lines.join("\n"));
process.exit(0);
