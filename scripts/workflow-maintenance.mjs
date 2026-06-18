#!/usr/bin/env node
import fs from "node:fs";
import {
  commandOutput,
  commandResult,
  parseArgs,
  readGitMaintenanceState,
  repoRoot
} from "./lib/workflow-automation.mjs";

const looseObjectWarningThreshold = 7000;

let options;

try {
  options = parseArgs(process.argv.slice(2), {
    allowWorkflowFixFlags: false,
    allowMaintenanceFlags: true
  });
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

const root = repoRoot(process.cwd());
const branch = commandOutput("git", ["branch", "--show-current"], root);
const trunk = readGraphiteTrunk(root);
const worktreeStatus = commandOutput("git", ["status", "--short", "--untracked-files=all"], root);
const clean = worktreeStatus.trim().length === 0;

if (options.register) {
  runMaintenanceRegister(root);
}

if (!options.postMerge) {
  printMaintenanceState(root, "diagnostic");
  process.exit(0);
}

console.log("Tabula workflow maintenance");
console.log(`- Branch: ${branch || "unknown"}`);
console.log(`- Trunk: ${trunk}`);
console.log(`- Worktree: ${clean ? "clean" : "dirty"}`);

if (!clean) {
  console.log("- Skipped: worktree is not clean.");
  process.exit(0);
}

if (branch !== trunk) {
  console.log("- Skipped: post-merge maintenance only runs on trunk.");
  process.exit(0);
}

runMaintenanceRegister(root);
runMaintenanceTask(root, "loose-objects");
runMaintenanceTask(root, "incremental-repack");

let state = readGitMaintenanceState(root);
if (needsRepair(state)) {
  console.log("- Local Git object repair needed after maintenance tasks.");
  if (hasLooseObjectGcWarning(state.gcLog)) {
    runRequired("git", ["prune", "--expire=now"], root);
    fs.rmSync(state.gcLogPath, { force: true });
    console.log("- Removed stale .git/gc.log after prune repair.");
  }

  runRequired("git", ["gc"], root);

  state = readGitMaintenanceState(root);
  if (state.hasGcLog && !hasLooseObjectGcWarning(state.gcLog)) {
    fs.rmSync(state.gcLogPath, { force: true });
    console.log("- Removed resolved .git/gc.log.");
  }
}

printMaintenanceState(root, "post-merge");

function readGraphiteTrunk(rootDir) {
  const configText = commandOutput("git", ["config", "--get", "branch.main.merge"], rootDir);
  if (configText.includes("main")) {
    return "main";
  }

  try {
    const repoConfig = JSON.parse(fs.readFileSync(`${rootDir}/.git/.graphite_repo_config`, "utf8"));
    return repoConfig.trunk || "main";
  } catch {
    return "main";
  }
}

function runMaintenanceRegister(rootDir) {
  if (isMaintenanceRegistered(rootDir)) {
    console.log("- Git maintenance already registered.");
    return;
  }

  const startResult = commandResult("git", ["maintenance", "start"], rootDir);
  if (startResult.ok) {
    console.log("- Git background maintenance started.");
    return;
  }

  const registerResult = commandResult("git", ["maintenance", "register"], rootDir);
  if (registerResult.ok) {
    console.log("- Git maintenance registered without scheduler.");
    return;
  }

  console.log(`- Git maintenance registration skipped: ${startResult.stderr || registerResult.stderr || "unavailable"}`);
}

function isMaintenanceRegistered(rootDir) {
  return commandOutput("git", ["config", "--global", "--get-all", "maintenance.repo"], rootDir)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .includes(rootDir);
}

function runMaintenanceTask(rootDir, task) {
  const result = commandResult("git", ["maintenance", "run", `--task=${task}`], rootDir);
  if (result.ok) {
    console.log(`- Git maintenance task complete: ${task}.`);
    return;
  }
  console.log(`- Git maintenance task skipped: ${task}: ${result.stderr || result.stdout || "unavailable"}`);
}

function runRequired(command, args, rootDir) {
  const result = commandResult(command, args, rootDir);
  const label = `${command} ${args.join(" ")}`;
  if (!result.ok) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout || "no details"}`);
  }
  console.log(`- ${label} complete.`);
}

function needsRepair(state) {
  return hasLooseObjectGcWarning(state.gcLog)
    || (state.counts?.count !== null && state.counts?.count >= looseObjectWarningThreshold);
}

function hasLooseObjectGcWarning(gcLog) {
  return /too many unreachable loose objects|run 'git prune'/i.test(String(gcLog ?? ""));
}

function printMaintenanceState(rootDir, mode) {
  const state = readGitMaintenanceState(rootDir);
  console.log(`Tabula workflow maintenance (${mode})`);

  if (!state.countResult.ok) {
    console.log(`- Git object count unavailable: ${state.countResult.stderr || "unknown error"}`);
  } else if (state.counts?.count !== null) {
    console.log(`- Loose objects: ${state.counts.count} (${state.counts.size || "unknown size"})`);
  }

  if (state.hasGcLog) {
    console.log(`- gc.log: ${summarizeGcLog(state.gcLog)}`);
  } else {
    console.log("- gc.log: clear");
  }
}

function summarizeGcLog(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => /warning|error/i.test(line)) ?? lines[0] ?? "empty";
}

function printHelp() {
  console.log(`Usage: npm run workflow:maintenance -- [--post-merge] [--register]

Maintains local Git object storage for Graphite-heavy development.

Options:
  --post-merge  Run repair only when the worktree is clean and the current branch is trunk.
  --register    Register this repository for Git background maintenance.
  --help        Show this help text.`);
}
