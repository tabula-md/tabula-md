#!/usr/bin/env node
import { renderPrBody, validatePrBodyOptions } from "./lib/pr-body-template.mjs";
import { getPullRequest, getRepoNameWithOwner, updatePullRequestBody } from "./lib/pr-github.mjs";
import { requiredValue } from "./lib/pr-options.mjs";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

validatePrBodyOptions(options);

const repo = options.repo ?? getRepoNameWithOwner();
const pullRequest = getPullRequest(repo, options.pr, ["number", "url", "body"]);
const body = renderPrBody(options, pullRequest.body);

if (!options.dryRun) {
  updatePullRequestBody(repo, pullRequest.number, body);
}

console.log(`PR body target: ${repo}#${pullRequest.number}`);
console.log(`URL: ${pullRequest.url}`);
console.log(options.dryRun ? body : "PR body updated.");

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    evidence: [],
    help: false,
    implementationNotes: [],
    pr: null,
    repo: null,
    reviewFocus: [],
    risk: [],
    summary: [],
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

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run pr:body -- [options]

Writes a reviewable PR body after Graphite creates or updates a PR. The agent
must provide concise, task-specific content rather than leaving template
placeholders.

Options:
  --pr <number>                       PR number. Defaults to the PR for the current branch.
  --repo <owner/name>                 GitHub repository. Defaults to the current repo.
  --summary <text>                    Outcome summary. Repeat for multiple bullets.
  --review-focus <text>               What reviewers should inspect. Repeatable.
  --implementation-notes <text>       Important decisions or tradeoffs. Repeatable.
  --validation-automated <text>       Automated validation run. Repeatable.
  --validation-manual <text>          Manual validation run. Repeatable.
  --validation-not-run <text>         Validation intentionally skipped, with reason. Repeatable.
  --risk <text>                       Remaining risk. Repeatable.
  --evidence <text>                   Screenshots/video or explicit Not visual note. Repeatable.
  --dry-run                           Print the generated body without changing GitHub.
`);
}
