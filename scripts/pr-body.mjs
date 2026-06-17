#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { formatAgentSection, parseAgentSection } from "./lib/agent-context.mjs";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

validateOptions(options);

const repo = options.repo ?? getRepoNameWithOwner();
const pullRequest = getPullRequest(repo, options.pr);
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

function validateOptions(bodyOptions) {
  const missing = [];

  for (const [label, values] of [
    ["--summary", bodyOptions.summary],
    ["--review-focus", bodyOptions.reviewFocus],
    ["--implementation-notes", bodyOptions.implementationNotes],
    ["--risk", bodyOptions.risk],
    ["--evidence", bodyOptions.evidence]
  ]) {
    if (!hasMeaningfulItems(values)) {
      missing.push(label);
    }
  }

  if (!hasMeaningfulItems([
    ...bodyOptions.validationAutomated,
    ...bodyOptions.validationManual,
    ...bodyOptions.validationNotRun
  ])) {
    missing.push("--validation-automated/--validation-manual/--validation-not-run");
  }

  if (missing.length > 0) {
    throw new Error(`PR body requires meaningful content for: ${missing.join(", ")}.`);
  }
}

function renderPrBody(bodyOptions, existingBody) {
  const agent = parseAgentSection(existingBody);
  const sections = [
    renderSection("Summary", bodyOptions.summary),
    renderSection("Review Focus", bodyOptions.reviewFocus),
    renderSection("Implementation Notes", bodyOptions.implementationNotes)
  ];

  if (agent.present) {
    sections.push(formatAgentSection({
      tool: agent.tool || "Unknown",
      session: agent.session || "Unknown"
    }));
  }

  sections.push(
    renderValidationSection(bodyOptions),
    renderSection("Risk", bodyOptions.risk),
    renderSection("Evidence", bodyOptions.evidence)
  );

  return `${sections.join("\n\n")}\n`;
}

function renderSection(title, items) {
  return [`## ${title}`, "", ...formatItems(items)].join("\n");
}

function renderValidationSection(bodyOptions) {
  return [
    "## Validation",
    "",
    renderValidationGroup("Automated", bodyOptions.validationAutomated),
    renderValidationGroup("Manual", bodyOptions.validationManual),
    renderValidationGroup("Not run", bodyOptions.validationNotRun)
  ].join("\n");
}

function renderValidationGroup(label, items) {
  const values = normalizeItems(items);
  if (values.length === 0) {
    return `- ${label}: None.`;
  }

  if (values.length === 1) {
    return `- ${label}: ${values[0]}`;
  }

  return [`- ${label}:`, ...values.map((item) => `  - ${item}`)].join("\n");
}

function formatItems(items) {
  return normalizeItems(items).map((item) => `- ${item}`);
}

function normalizeItems(items) {
  return items
    .flatMap((item) => String(item ?? "").split(/\n+/))
    .map((item) => item.trim())
    .filter((item) => item && item !== "-");
}

function hasMeaningfulItems(items) {
  return normalizeItems(items).length > 0;
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

  args.push("--repo", repo, "--json", "number,url,body");
  return ghJson(args);
}

function currentBranch() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Could not resolve current branch for PR body update.");
  }

  return result.stdout.trim();
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
