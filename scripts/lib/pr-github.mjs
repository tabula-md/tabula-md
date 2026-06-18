import { spawnSync } from "node:child_process";

export function getRepoNameWithOwner() {
  const repo = ghJson(["repo", "view", "--json", "nameWithOwner"]);
  if (!repo.nameWithOwner) {
    throw new Error("Could not resolve GitHub repository. Pass --repo owner/name.");
  }
  return repo.nameWithOwner;
}

export function getPullRequest(repo, prNumber, fields) {
  const args = ["pr", "view"];

  if (prNumber) {
    args.push(String(prNumber));
  } else {
    args.push(currentBranch("PR lookup"));
  }

  args.push("--repo", repo, "--json", fields.join(","));
  return ghJson(args);
}

export function currentBranch(context = "current branch") {
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Could not resolve current branch for ${context}.`);
  }

  return result.stdout.trim();
}

export function updatePullRequestTitle(repo, prNumber, title) {
  patchPullRequest(repo, prNumber, { title });
}

export function updatePullRequestBody(repo, prNumber, body) {
  patchPullRequest(repo, prNumber, { body });
}

export function addIssueLabels(repo, prNumber, labels) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/issues/${prNumber}/labels`,
    ...labels.flatMap((label) => ["-f", `labels[]=${label}`])
  ]);
}

export function addIssueAssignees(repo, prNumber, assignees) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/issues/${prNumber}/assignees`,
    ...assignees.flatMap((assignee) => ["-f", `assignees[]=${assignee}`])
  ]);
}

export function requestPullRequestReviewers(repo, prNumber, reviewers) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/pulls/${prNumber}/requested_reviewers`,
    ...reviewers.flatMap((reviewer) => ["-f", `reviewers[]=${reviewer}`])
  ]);
}

export function patchPullRequest(repo, prNumber, fields) {
  gh([
    "api",
    "--method",
    "PATCH",
    `repos/${repo}/pulls/${prNumber}`,
    ...Object.entries(fields).flatMap(([key, value]) => ["-f", `${key}=${value}`])
  ]);
}

export function ghJson(args) {
  return JSON.parse(gh(args));
}

export function gh(args, options = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    const command = `gh ${args.join(" ")}`;
    const details = result.stderr?.trim() || result.stdout?.trim() || "No details.";
    throw new Error(`${command} failed: ${details}`);
  }

  return options.trim === false ? result.stdout : result.stdout.trim();
}
