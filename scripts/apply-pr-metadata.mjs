#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveAgentContext, upsertAgentSection } from "./lib/agent-context.mjs";

const defaultOwnerLogin = "taehalim";
const labelCatalog = JSON.parse(fs.readFileSync(new URL("../.github/labels.json", import.meta.url), "utf8"));
const labelDefinitionsByName = new Map(labelCatalog.map((label) => [label.name, label]));
const labelNamesByLowercase = new Map(labelCatalog.map((label) => [label.name.toLowerCase(), label.name]));

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.listLabels) {
  printLabelCatalog();
  process.exit(0);
}

if (options.labels.length === 0) {
  console.error("Select one PR label explicitly with `--label <name>`.");
  printLabelCatalog();
  process.exit(1);
}

const repo = options.repo ?? getRepoNameWithOwner();
const pullRequest = getPullRequest(repo, options.pr);
const labels = options.labels.map(resolveCatalogLabelName);
const assignees = options.assignees.length > 0 ? options.assignees : parseList(process.env.TABULA_PR_ASSIGNEES || defaultOwnerLogin);
const reviewerCandidates = options.noReviewers
  ? []
  : options.reviewers.length > 0
    ? options.reviewers
    : parseList(process.env.TABULA_PR_REVIEWERS || defaultOwnerLogin);
const reviewers = reviewerCandidates.filter((login) => login !== pullRequest.author?.login);
const skippedReviewers = reviewerCandidates.filter((login) => login === pullRequest.author?.login);
const agentContext = resolveAgentContext({
  agent: options.agent,
  session: options.session
});
const shouldUpdateAgentContext = !options.noAgentContext && hasCompleteAgentContext(agentContext);

const resolvedLabels = labels.map((label) => ensureGitHubLabel(repo, label, options.dryRun));

if (!options.dryRun) {
  if (resolvedLabels.length > 0) {
    addIssueLabels(repo, pullRequest.number, resolvedLabels);
  }

  if (assignees.length > 0) {
    addIssueAssignees(repo, pullRequest.number, assignees);
  }

  if (reviewers.length > 0) {
    requestPullRequestReviewers(repo, pullRequest.number, reviewers);
  }

  if (shouldUpdateAgentContext) {
    updatePullRequestBody(repo, pullRequest.number, upsertAgentSection(pullRequest.body, agentContext));
  }
}

console.log(`PR metadata target: ${repo}#${pullRequest.number}`);
console.log(`URL: ${pullRequest.url}`);
console.log(`Labels: ${resolvedLabels.join(", ") || "none"}`);
console.log(`Assignees: ${assignees.join(", ") || "none"}`);
console.log(`Reviewers: ${reviewers.join(", ") || "none"}`);
console.log(`Agent: ${formatAgentOutput(options.noAgentContext, shouldUpdateAgentContext, agentContext)}`);

if (skippedReviewers.length > 0) {
  console.log(`Skipped self-reviewer: ${skippedReviewers.join(", ")}. GitHub does not allow requesting review from the PR author.`);
}

if (options.dryRun) {
  console.log("Dry run: no GitHub metadata was changed.");
}

function parseArgs(argv) {
  const parsed = {
    assignees: [],
    dryRun: false,
    help: false,
    agent: null,
    labels: [],
    listLabels: false,
    noAgentContext: false,
    noReviewers: false,
    pr: null,
    repo: null,
    reviewers: [],
    session: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--list-labels") {
      parsed.listLabels = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--no-reviewers") {
      parsed.noReviewers = true;
      continue;
    }

    if (arg === "--no-agent-context") {
      parsed.noAgentContext = true;
      continue;
    }

    if (arg === "--repo") {
      parsed.repo = requiredValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--pr") {
      parsed.pr = requiredValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--agent") {
      parsed.agent = requiredValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--session") {
      parsed.session = requiredValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--assignee" || arg === "--assignees") {
      parsed.assignees.push(...parseList(requiredValue(arg, next)));
      index += 1;
      continue;
    }

    if (arg === "--label" || arg === "--labels") {
      parsed.labels.push(...parseList(requiredValue(arg, next)));
      index += 1;
      continue;
    }

    if (arg === "--reviewer" || arg === "--reviewers") {
      parsed.reviewers.push(...parseList(requiredValue(arg, next)));
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function getRepoNameWithOwner() {
  const repo = ghJson(["repo", "view", "--json", "nameWithOwner"]);
  if (!repo.nameWithOwner) {
    throw new Error("Could not resolve GitHub repository. Pass --repo owner/name.");
  }
  return repo.nameWithOwner;
}

function getPullRequest(repo, prNumber) {
  const args = ["pr", "view"];

  if (prNumber) {
    args.push(String(prNumber));
  } else {
    args.push(currentBranch());
  }

  args.push("--repo", repo, "--json", "number,author,isDraft,headRefName,url,title,body");
  return ghJson(args);
}

function currentBranch() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Could not resolve current branch for PR metadata.");
  }

  return result.stdout.trim();
}

function ensureGitHubLabel(repo, labelName, dryRun) {
  const labels = ghJson(["api", `repos/${repo}/labels?per_page=100`]);
  const exact = labels.find((label) => label.name === labelName);
  if (exact) {
    return exact.name;
  }

  const caseInsensitive = labels.find((label) => label.name.toLowerCase() === labelName.toLowerCase());
  if (caseInsensitive) {
    return caseInsensitive.name;
  }

  const definition = labelDefinitionsByName.get(labelName);

  if (!dryRun) {
    gh([
      "api",
      "--method",
      "POST",
      `repos/${repo}/labels`,
      "-f",
      `name=${labelName}`,
      "-f",
      `color=${definition.color}`,
      "-f",
      `description=${definition.description}`
    ]);
  }

  return labelName;
}

function addIssueLabels(repo, prNumber, labels) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/issues/${prNumber}/labels`,
    ...labels.flatMap((label) => ["-f", `labels[]=${label}`])
  ]);
}

function addIssueAssignees(repo, prNumber, assignees) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/issues/${prNumber}/assignees`,
    ...assignees.flatMap((assignee) => ["-f", `assignees[]=${assignee}`])
  ]);
}

function requestPullRequestReviewers(repo, prNumber, reviewers) {
  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/pulls/${prNumber}/requested_reviewers`,
    ...reviewers.flatMap((reviewer) => ["-f", `reviewers[]=${reviewer}`])
  ]);
}

function updatePullRequestBody(repo, prNumber, body) {
  gh([
    "api",
    "--method",
    "PATCH",
    `repos/${repo}/pulls/${prNumber}`,
    "-f",
    `body=${body}`
  ]);
}

function parseList(value) {
  return String(value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item, index, items) => item && items.indexOf(item) === index);
}

function resolveCatalogLabelName(labelName) {
  const resolved = labelNamesByLowercase.get(String(labelName).toLowerCase());
  if (!resolved) {
    throw new Error(`Unknown PR label: ${labelName}. Run \`npm run pr:metadata -- --list-labels\`.`);
  }
  return resolved;
}

function hasCompleteAgentContext(context) {
  return Boolean(context.tool && context.tool !== "Unknown" && context.session && context.session !== "Unknown");
}

function formatAgentOutput(noAgentContext, shouldUpdateAgentContext, context) {
  if (noAgentContext) {
    return "not updated";
  }

  if (shouldUpdateAgentContext) {
    return `${context.tool} / ${context.session}`;
  }

  return `skipped; incomplete context (${context.tool} / ${context.session}). Pass --agent and --session, or set agent context env vars.`;
}

function requiredValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

function gh(args, options = {}) {
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

function printLabelCatalog() {
  console.log("Available Tabula.md PR labels:");
  for (const label of labelCatalog) {
    console.log(`- ${label.name}: ${label.description}`);
  }
}

function printHelp() {
  console.log(`Usage: npm run pr:metadata -- [options]

Applies Tabula.md PR metadata after Graphite creates or updates a PR.

Options:
  --pr <number>              PR number. Defaults to the PR for the current branch.
  --repo <owner/name>        GitHub repository. Defaults to the current repo.
  --assignee <login[,..]>    GitHub assignee. Defaults to TABULA_PR_ASSIGNEES or taehalim.
  --agent <name>             Agent/tool name for the PR Agent section.
  --label <label[,..]>       GitHub label selected by the agent from .github/labels.json. Required.
  --list-labels              Print selectable Tabula.md labels and exit.
  --session <id>             Agent session id for the PR Agent section. Required with --agent for agent-authored PRs.
  --reviewer <login[,..]>    GitHub reviewer. Defaults to TABULA_PR_REVIEWERS or taehalim.
  --no-agent-context         Do not update the PR Agent section.
  --no-reviewers            Do not request reviewers.
  --dry-run                 Print the intended metadata without changing GitHub.
`);
}
