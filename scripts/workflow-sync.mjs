#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { repoRoot } from "./lib/workflow-automation.mjs";

const root = repoRoot(process.cwd());
const steps = [
  ["gt", ["sync", "--delete-all"]],
  ["gt", ["checkout", "--trunk"]],
  ["git", ["remote", "prune", "origin"]],
  [process.execPath, ["scripts/workflow-maintenance.mjs", "--post-merge"]],
  [process.execPath, ["scripts/workflow-doctor.mjs"]],
  [process.execPath, ["scripts/workflow-status.mjs"]]
];

for (const [command, args] of steps) {
  const label = command === process.execPath ? `node ${args.join(" ")}` : `${command} ${args.join(" ")}`;
  console.log(`\n> ${label}`);

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`workflow:sync failed to start: ${label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`workflow:sync stopped after failed step: ${label}`);
    process.exit(result.status ?? 1);
  }
}
