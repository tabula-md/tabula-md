import { execFileSync } from "node:child_process";
import { checkPrTemplateBody, hasFailures } from "../../../scripts/lib/workflow-automation.mjs";

export function collectWorkflowStatus(cwd = process.cwd()) {
  const branch = run("git", ["branch", "--show-current"], cwd).stdout || "unknown";
  const currentCommitTitle = run("git", ["log", "-1", "--pretty=%s"], cwd).stdout || "";
  const gitStatus = run("git", ["status", "--short", "--untracked-files=all"], cwd).stdout;
  const graphiteLog = run("gt", ["log", "short", "--all"], cwd).stdout;
  const pr = branch && branch !== "main" ? readCurrentPullRequest(cwd) : null;

  return {
    branch,
    currentCommitTitle,
    clean: gitStatus.trim().length === 0,
    dirtyFiles: gitStatus.split(/\r?\n/).filter(Boolean),
    graphiteLog,
    pr
  };
}

export function formatWorkflowStatus(status) {
  const lines = [
    "Tabula workflow status",
    `- Branch: ${status.branch}`,
    `- Worktree: ${status.clean ? "clean" : `${status.dirtyFiles.length} changed file(s)`}`
  ];

  if (status.pr) {
    const labels = Array.isArray(status.pr.labels) ? status.pr.labels : [];
    const assignees = Array.isArray(status.pr.assignees) ? status.pr.assignees : [];
    lines.push(`- PR: #${status.pr.number} ${status.pr.title}`);
    lines.push(`- PR state: ${status.pr.state}${status.pr.isDraft ? " draft" : " ready"}`);
    lines.push(`- Labels: ${labels.length > 0 ? labels.map((label) => label.name).join(", ") : "none"}`);
    lines.push(`- Assignees: ${assignees.length > 0 ? assignees.map((assignee) => assignee.login).join(", ") : "none"}`);
    lines.push(`- Checks: ${formatChecks(status.pr.statusCheckRollup)}`);
  } else {
    lines.push("- PR: none for current branch");
  }

  const nextActions = recommendNextActions(status);
  lines.push("Next action:");
  for (const action of nextActions) {
    lines.push(`- ${action}`);
  }

  if (status.graphiteLog.trim()) {
    lines.push("Graphite:");
    lines.push(status.graphiteLog.trim());
  }

  return lines.join("\n");
}

export function buildSessionWorkflowContext(cwd = process.cwd()) {
  const status = collectWorkflowStatus(cwd);
  const nextActions = recommendNextActions(status).slice(0, 2).join(" ");
  return `Tabula workflow context: branch ${status.branch}; worktree ${status.clean ? "clean" : "dirty"}. ${nextActions} Use \`npm run workflow:status\` for full state.`;
}

export function recommendNextActions(status) {
  if (status.pr?.state === "MERGED") {
    return ["Run `npm run workflow:sync`, then move the closing Linear issue to Done when appropriate."];
  }

  if (status.pr?.state === "OPEN") {
    const actions = [];
    const labels = Array.isArray(status.pr.labels) ? status.pr.labels : [];
    const assignees = Array.isArray(status.pr.assignees) ? status.pr.assignees : [];
    if (status.currentCommitTitle && status.pr.title !== status.currentCommitTitle) {
      actions.push(`Run \`npm run pr:title -- --title "${status.currentCommitTitle}"\` or update the current commit title so PR title and commit subject agree.`);
    }
    const bodyChecks = checkPrTemplateBody(status.pr.body, { branch: status.branch });
    const bodyContentFailures = bodyChecks.filter((check) => (
      check.level === "fail"
      && /^PR body (?:missing section|section is still placeholder-only)/.test(check.message)
    ));
    if (bodyContentFailures.length > 0) {
      actions.push("Run `npm run pr:body -- ...` with reviewable Summary, Review Focus, Validation, Risk, and Evidence content.");
    }
    if (labels.length === 0 || assignees.length === 0) {
      actions.push("Run `npm run pr:metadata -- --label <Label>` with a label from `.github/labels.json`.");
    }
    if (status.pr.isDraft) {
      actions.push("Publish the PR when ready with `gt submit --publish --update-only`.");
    }
    if (actions.length === 0 && !hasFailures(bodyChecks)) {
      actions.push("Review checks and merge in Graphite when the PR is acceptable.");
    }
    if (actions.length === 0) {
      actions.push("Run `npm run pr:ready` and address any remaining readiness failures.");
    }
    return actions;
  }

  if (status.branch !== "main") {
    return ["If this branch is PR-bound, run validation, `gt submit`, `npm run pr:title -- --title \"type(scope): summary\"`, `npm run pr:body -- ...`, then `npm run pr:metadata -- --label <Label>`."];
  }

  if (!status.clean) {
    return ["Finish edits, run focused validation, then create a Graphite branch with `gt create codex/short-kebab-slug -m \"type(scope): summary\"`."];
  }

  return ["Ready for new work. Classify the request first; create or reuse a Linear MTS issue for accepted maintainer work, then edit from `main` and use Graphite for PR-bound changes."];
}

function readCurrentPullRequest(cwd) {
  const result = run("gh", [
    "pr",
    "view",
    "--json",
    "number,title,state,isDraft,mergedAt,url,headRefName,body,labels,assignees,reviewRequests,statusCheckRollup"
  ], cwd);

  if (!result.ok) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function formatChecks(checks = []) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return "none";
  }

  return checks.map((check) => `${check.name}:${check.conclusion ?? check.status ?? "unknown"}`).join(", ");
}

function run(command, args, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim()
    };
  } catch {
    return { ok: false, stdout: "" };
  }
}
