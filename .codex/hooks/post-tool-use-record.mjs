#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { findBashCommand, findPatchText, findToolName, readHookPayload, readState, repoRootFromCwd, statePathForPayload, writeState } from "./lib/hook-io.mjs";
import { parseGitStatusFiles, parsePatchFiles, recordChangedFiles, recordValidationCommand } from "./lib/validation-policy.mjs";

const maxStatusFilesToRecord = 80;

const payload = await readHookPayload();
const statePath = statePathForPayload(payload);
let state = readState(statePath);
const now = new Date().toISOString();

const command = findBashCommand(payload);
if (command) {
  state = recordValidationCommand(state, command, now);
  const changedFiles = readBoundedGitStatusFiles(repoRootFromCwd(payload?.cwd));
  if (changedFiles.length > 0) {
    state = recordChangedFiles(state, changedFiles, now);
  }
}

const toolName = findToolName(payload);
const patchText = findPatchText(payload);
if (patchText || /^(apply_patch|Edit|Write)$/.test(toolName)) {
  const files = parsePatchFiles(patchText);
  if (files.length > 0) {
    state = recordChangedFiles(state, files, now);
  }
}

writeState(statePath, state);

function readBoundedGitStatusFiles(root) {
  try {
    const output = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const files = parseGitStatusFiles(output);
    return files.length <= maxStatusFilesToRecord ? files : [];
  } catch {
    return [];
  }
}
