#!/usr/bin/env node
import { collectWorkflowStatus } from "../.codex/hooks/lib/workflow-status.mjs";
import {
  checkBranchName,
  checkConventionalTitle,
  checkPrTemplateBody,
  checkStatusChecks,
  commandResult,
  fail,
  formatCheckReport,
  hasFailures,
  ok,
  parseArgs,
  repoRoot,
  warn
} from "./lib/workflow-automation.mjs";

let options;

try {
  options = parseArgs(process.argv.slice(2));
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
const status = collectWorkflowStatus(root);
const checks = [
  ...checkWorktree(status),
  ...checkCurrentPullRequest(status),
  ...checkFastLocalCommands(root)
];

if (options.json) {
  console.log(JSON.stringify({ checks }, null, 2));
} else {
  console.log(formatCheckReport("Tabula PR readiness", checks));
}

process.exit(hasFailures(checks) ? 1 : 0);

function checkWorktree(status) {
  if (status.clean) {
    return [ok("Worktree is clean")];
  }

  return [
    fail("Worktree has uncommitted changes", status.dirtyFiles.join(", "))
  ];
}

function checkCurrentPullRequest(status) {
  const checks = [];
  checks.push(...checkBranchName(status.branch));

  if (!status.pr) {
    checks.push(fail("Current branch has no GitHub PR", "Run `gt submit` for PR-bound work."));
    return checks;
  }

  checks.push(ok("Current branch has a PR", `#${status.pr.number}`));
  checks.push(checkConventionalTitle(status.pr.title));

  if (status.pr.state === "OPEN") {
    checks.push(ok("PR is open"));
  } else {
    checks.push(fail("PR should be open", status.pr.state));
  }

  checks.push(status.pr.isDraft ? fail("PR is still draft") : ok("PR is ready for review"));

  const labels = Array.isArray(status.pr.labels) ? status.pr.labels : [];
  checks.push(labels.length > 0 ? ok("PR has label metadata", labels.map((label) => label.name).join(", ")) : fail("PR is missing label metadata"));

  const assignees = Array.isArray(status.pr.assignees) ? status.pr.assignees : [];
  checks.push(assignees.length > 0 ? ok("PR has assignee metadata", assignees.map((assignee) => assignee.login).join(", ")) : fail("PR is missing assignee metadata"));

  checks.push(...checkPrTemplateBody(status.pr.body));
  checks.push(...checkStatusChecks(status.pr.statusCheckRollup));

  return checks;
}

function checkFastLocalCommands(root) {
  const diffCheck = commandResult("git", ["diff", "--check"], root);
  return [
    diffCheck.ok ? ok("git diff --check passes") : fail("git diff --check failed", diffCheck.stdout || diffCheck.stderr),
    warn("Full validation is not run by pr:ready", "Use required commands from hook output or CI checks.")
  ];
}

function printHelp() {
  console.log(`Usage: npm run pr:ready -- [--json]

Checks the current PR for local cleanliness, metadata, template shape,
Conventional Commit title, branch naming policy, fast whitespace checks, and
GitHub check status. It does not submit, merge, or run expensive validation.`);
}
