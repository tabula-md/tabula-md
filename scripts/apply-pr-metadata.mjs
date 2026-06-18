#!/usr/bin/env node
import { getPullRequest, getRepoNameWithOwner } from "./lib/pr-github.mjs";
import { parseList, requiredValue } from "./lib/pr-options.mjs";
import { applyPrMetadata, buildPrMetadata, formatAgentOutput, printLabelCatalog } from "./lib/pr-metadata.mjs";

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
const pullRequest = getPullRequest(repo, options.pr, ["number", "author", "isDraft", "headRefName", "url", "title", "body"]);
const metadata = buildPrMetadata(options, pullRequest, repo);

if (!options.dryRun) {
  applyPrMetadata(repo, pullRequest, metadata);
}

console.log(`PR metadata target: ${repo}#${pullRequest.number}`);
console.log(`URL: ${pullRequest.url}`);
console.log(`Labels: ${metadata.resolvedLabels.join(", ") || "none"}`);
console.log(`Assignees: ${metadata.assignees.join(", ") || "none"}`);
console.log(`Reviewers: ${metadata.reviewers.join(", ") || "none"}`);
console.log(`Agent: ${formatAgentOutput(options.noAgentContext, metadata.shouldUpdateAgentContext, metadata.agentContext)}`);

if (metadata.skippedReviewers.length > 0) {
  console.log(`Skipped self-reviewer: ${metadata.skippedReviewers.join(", ")}. GitHub does not allow requesting review from the PR author.`);
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
