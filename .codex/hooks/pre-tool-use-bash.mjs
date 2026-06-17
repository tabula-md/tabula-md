#!/usr/bin/env node
import { evaluateBashCommand } from "./lib/command-policy.mjs";
import { findBashCommand, readHookPayload } from "./lib/hook-io.mjs";

const payload = await readHookPayload();
const command = findBashCommand(payload);

if (!command) {
  process.exit(0);
}

const result = evaluateBashCommand(command);

if (result.decision === "block") {
  console.error(`Tabula Codex hook blocked this command.\n\n${result.message}`);
  process.exit(1);
}

if (result.decision === "warn") {
  console.error(`Tabula Codex hook warning: ${result.message}`);
}

process.exit(0);
