#!/usr/bin/env node
import { renderPrBody, validatePrBodyOptions } from "./lib/pr-body-template.mjs";
import { getPullRequest, getRepoNameWithOwner, updatePullRequestBody, updatePullRequestTitle } from "./lib/pr-github.mjs";
import { applyPrMetadata, bodyWithAgentContext, buildPrMetadata, formatAgentOutput } from "./lib/pr-metadata.mjs";
import { parseList, requiredValue } from "./lib/pr-options.mjs";
import { checkConventionalTitle, hasFailures } from "./lib/workflow-automation.mjs";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

validateOptions(options);

const repo = options.repo ?? getRepoNameWithOwner();
const pullRequest = getPullRequest(repo, options.pr, ["number", "author", "url", "title", "body"]);
const metadata = buildPrMetadata({ ...options, labels: [options.label] }, pullRequest, repo);
const body = bodyWithAgentContext(renderPrBody(options, pullRequest.body), metadata);

if (!options.dryRun) {
  updatePullRequestTitle(repo, pullRequest.number, options.title);
  updatePullRequestBody(repo, pullRequest.number, body);
  applyPrMetadata(repo, pullRequest, metadata, { updateAgentBody: false });
}

console.log(`PR handoff target: ${repo}#${pullRequest.number}`);
console.log(`URL: ${pullRequest.url}`);
console.log(`Previous title: ${pullRequest.title}`);
console.log(`New title: ${options.title}`);
console.log(`Labels: ${metadata.resolvedLabels.join(", ") || "none"}`);
console.log(`Assignees: ${metadata.assignees.join(", ") || "none"}`);
console.log(`Reviewers: ${metadata.reviewers.join(", ") || "none"}`);
console.log(`Agent: ${formatAgentOutput(options.noAgentContext, metadata.shouldUpdateAgentContext, metadata.agentContext)}`);

if (metadata.skippedReviewers.length > 0) {
  console.log(`Skipped self-reviewer: ${metadata.skippedReviewers.join(", ")}. GitHub does not allow requesting review from the PR author.`);
}

if (pullRequest.title !== options.title) {
  console.log("Scope checkpoint: title changed. Confirm this PR still represents one reviewable layer; otherwise create an upstack PR with `gt create` instead of growing this PR.");
}

if (options.dryRun) {
  console.log("Dry run: no GitHub metadata was changed.");
  console.log(body);
} else {
  console.log("PR handoff complete.");
}

function parseArgs(argv) {
  const parsed = {
    agent: null,
    assignees: [],
    dryRun: false,
    evidence: [],
    help: false,
    implementationNotes: [],
    label: null,
    noAgentContext: false,
    noReviewers: false,
    pr: null,
    repo: null,
    reviewFocus: [],
    reviewers: [],
    risk: [],
    session: null,
    summary: [],
    title: null,
    validationAutomated: [],
    validationManual: [],
    validationNotRun: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--no-agent-context") {
      parsed.noAgentContext = true;
      continue;
    }
    if (arg === "--no-reviewers") {
      parsed.noReviewers = true;
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
    if (arg === "--title") {
      parsed.title = requiredValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === "--label") {
      parsed.label = requiredValue(arg, next);
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
    if (arg === "--summary") {
      parsed.summary.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--review-focus") {
      parsed.reviewFocus.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--implementation-notes") {
      parsed.implementationNotes.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--validation-automated") {
      parsed.validationAutomated.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--validation-manual") {
      parsed.validationManual.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--validation-not-run") {
      parsed.validationNotRun.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--risk") {
      parsed.risk.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--evidence") {
      parsed.evidence.push(requiredValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--assignee" || arg === "--assignees") {
      parsed.assignees.push(...parseList(requiredValue(arg, next)));
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

function validateOptions(parsed) {
  const missing = [];
  for (const [flag, value] of [
    ["--title", parsed.title],
    ["--label", parsed.label]
  ]) {
    if (!value) {
      missing.push(flag);
    }
  }

  for (const [flag, values] of [
    ["--summary", parsed.summary],
    ["--review-focus", parsed.reviewFocus],
    ["--implementation-notes", parsed.implementationNotes],
    ["--risk", parsed.risk],
    ["--evidence", parsed.evidence]
  ]) {
    if (values.length === 0) {
      missing.push(flag);
    }
  }

  if ([...parsed.validationAutomated, ...parsed.validationManual, ...parsed.validationNotRun].length === 0) {
    missing.push("--validation-automated/--validation-manual/--validation-not-run");
  }

  if (missing.length > 0) {
    throw new Error(`PR handoff requires: ${missing.join(", ")}.`);
  }

  const titleCheck = checkConventionalTitle(parsed.title);
  if (hasFailures([titleCheck])) {
    throw new Error(`${titleCheck.message}: ${titleCheck.detail}`);
  }

  validatePrBodyOptions(parsed);
}

function printHelp() {
  console.log(`Usage: npm run pr:handoff -- [options]

Runs the complete post-Graphite-submit handoff for the current PR:
title review, reviewable body, metadata, assignee, label, and agent provenance.

Required:
  --title <type(scope): summary>
  --label <Label>
  --summary <text>
  --review-focus <text>
  --implementation-notes <text>
  --validation-automated <text> | --validation-manual <text> | --validation-not-run <text>
  --risk <text>
  --evidence <text>

Common options:
  --agent <name>
  --session <id>
  --reviewer <login[,..]>
  --assignee <login[,..]>
  --pr <number>
  --repo <owner/name>
  --dry-run
`);
}
