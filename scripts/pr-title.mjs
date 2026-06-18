#!/usr/bin/env node
import { getPullRequest, getRepoNameWithOwner, updatePullRequestTitle } from "./lib/pr-github.mjs";
import { requiredValue } from "./lib/pr-options.mjs";
import { checkConventionalTitle, hasFailures } from "./lib/workflow-automation.mjs";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!options.title) {
  throw new Error("PR title review requires `--title <type(scope): summary>`.");
}

const titleCheck = checkConventionalTitle(options.title);
if (hasFailures([titleCheck])) {
  throw new Error(`${titleCheck.message}: ${titleCheck.detail}`);
}

const repo = options.repo ?? getRepoNameWithOwner();
const pullRequest = getPullRequest(repo, options.pr, ["number", "url", "title"]);

if (!options.dryRun) {
  updatePullRequestTitle(repo, pullRequest.number, options.title);
}

console.log(`PR title target: ${repo}#${pullRequest.number}`);
console.log(`URL: ${pullRequest.url}`);
console.log(`Previous title: ${pullRequest.title}`);
console.log(`New title: ${options.title}`);
if (pullRequest.title !== options.title) {
  console.log("Scope checkpoint: title changed. Confirm this PR still represents one reviewable layer; otherwise create an upstack PR with `gt create` instead of growing this PR.");
}
if (options.dryRun) {
  console.log("Dry run: PR title was not changed.");
}

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    help: false,
    pr: null,
    repo: null,
    title: null
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

    if (arg === "--title") {
      parsed.title = requiredValue(arg, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run pr:title -- --title "type(scope): summary" [options]

Reviews and updates the GitHub PR title after Graphite creates or updates a PR.
Run this whenever the implementation scope changes before final readiness.

Options:
  --title <text>          Required Conventional Commit PR title.
  --pr <number>           PR number. Defaults to the PR for the current branch.
  --repo <owner/name>     GitHub repository. Defaults to the current repo.
  --dry-run               Print the intended title without changing GitHub.
`);
}
