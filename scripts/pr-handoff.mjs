#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

validateOptions(options);

const commonArgs = [
  ...optionalPair("--pr", options.pr),
  ...optionalPair("--repo", options.repo),
  ...(options.dryRun ? ["--dry-run"] : [])
];
const metadataArgs = [
  ...commonArgs,
  "--label",
  options.label,
  ...optionalPair("--agent", options.agent),
  ...optionalPair("--session", options.session),
  ...options.assignees.flatMap((assignee) => ["--assignee", assignee]),
  ...options.reviewers.flatMap((reviewer) => ["--reviewer", reviewer]),
  ...(options.noReviewers ? ["--no-reviewers"] : []),
  ...(options.noAgentContext ? ["--no-agent-context"] : [])
];

runNodeScript("scripts/pr-title.mjs", [
  ...commonArgs,
  "--title",
  options.title
]);

runNodeScript("scripts/pr-body.mjs", [
  ...commonArgs,
  ...options.summary.flatMap((value) => ["--summary", value]),
  ...options.reviewFocus.flatMap((value) => ["--review-focus", value]),
  ...options.implementationNotes.flatMap((value) => ["--implementation-notes", value]),
  ...options.validationAutomated.flatMap((value) => ["--validation-automated", value]),
  ...options.validationManual.flatMap((value) => ["--validation-manual", value]),
  ...options.validationNotRun.flatMap((value) => ["--validation-not-run", value]),
  ...options.risk.flatMap((value) => ["--risk", value]),
  ...options.evidence.flatMap((value) => ["--evidence", value])
]);

runNodeScript("scripts/apply-pr-metadata.mjs", metadataArgs);

console.log("PR handoff complete.");

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
}

function runNodeScript(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${script} failed.`);
  }
}

function optionalPair(flag, value) {
  return value ? [flag, value] : [];
}

function parseList(value) {
  return String(value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item, index, items) => item && items.indexOf(item) === index);
}

function requiredValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
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
