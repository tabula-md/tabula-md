#!/usr/bin/env node
import path from "node:path";
import {
  checkPackageScripts,
  checkRequiredFiles,
  commandOutput,
  commandResult,
  fail,
  formatCheckReport,
  hasFailures,
  info,
  ok,
  parseArgs,
  readJson,
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
const checks = [
  ...checkRequiredFiles(root),
  ...checkPackageScripts(root),
  ...checkGraphite(root, options),
  ...checkGitHub(root),
  ...checkLabels(root, options)
];

if (options.json) {
  console.log(JSON.stringify({ checks }, null, 2));
} else {
  console.log(formatCheckReport("Tabula workflow doctor", checks));
}

process.exit(hasFailures(checks) ? 1 : 0);

function checkGraphite(rootDir, doctorOptions) {
  const checks = [];
  const version = commandResult("gt", ["--version"], rootDir);

  if (!version.ok) {
    return [fail("Graphite CLI is unavailable", "Install and authenticate `gt`.")];
  }

  checks.push(ok("Graphite CLI is available", version.stdout));

  const graphiteLog = commandResult("gt", ["log", "short", "--all"], rootDir);
  checks.push(
    graphiteLog.ok
      ? ok("Graphite stack is readable")
      : fail("Graphite stack is not readable", graphiteLog.stderr || "Run `gt repo init` or reauthenticate.")
  );

  const repoConfig = readJson(path.join(rootDir, ".git", ".graphite_repo_config"));
  if (repoConfig?.trunk === "main") {
    checks.push(ok("Graphite trunk is main"));
  } else {
    checks.push(fail("Graphite trunk should be main", repoConfig?.trunk ? `current: ${repoConfig.trunk}` : "missing repo config"));
  }

  const branch = commandOutput("git", ["branch", "--show-current"], rootDir);
  const branchAppearsDatePrefixed = /^\d{2}-\d{2}-/.test(branch);
  if (branchAppearsDatePrefixed) {
    checks.push(warn("Current branch appears date-prefixed", branch));
  }

  if (doctorOptions.fix) {
    const dateResult = commandResult("gt", ["user", "branch-date", "--disable"], rootDir);
    checks.push(dateResult.ok ? ok("Graphite branch date prefix disabled") : warn("Could not disable Graphite branch date prefix", dateResult.stderr));

    const prefixResult = commandResult("gt", ["user", "branch-prefix", "--reset"], rootDir);
    checks.push(prefixResult.ok ? ok("Graphite branch prefix reset") : warn("Could not reset Graphite branch prefix", prefixResult.stderr));
  } else if (branchAppearsDatePrefixed) {
    checks.push(info("Graphite branch naming fix is available", "Run `npm run workflow:doctor -- --fix` to disable date prefixes and reset branch prefix."));
  }

  return checks;
}

function checkGitHub(rootDir) {
  const repo = commandResult("gh", [
    "repo",
    "view",
    "--json",
    "nameWithOwner,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge"
  ], rootDir);

  if (!repo.ok) {
    return [warn("GitHub repository settings unavailable", repo.stderr || "Check `gh auth status`.")];
  }

  const settings = parseJson(repo.stdout);
  if (!settings) {
    return [warn("GitHub repository settings could not be parsed")];
  }

  return [
    ok("GitHub repository is readable", settings.nameWithOwner),
    settings.mergeCommitAllowed === false
      ? ok("GitHub merge commits are disabled")
      : warn("GitHub merge commits should be disabled"),
    settings.squashMergeAllowed
      ? ok("GitHub squash merge is enabled")
      : fail("GitHub squash merge should be enabled"),
    settings.deleteBranchOnMerge
      ? ok("GitHub deletes merged branches")
      : warn("GitHub should delete merged branches after merge"),
    settings.rebaseMergeAllowed
      ? ok("GitHub rebase merge is available")
      : info("GitHub rebase merge is disabled")
  ];
}

function checkLabels(rootDir, doctorOptions) {
  const localLabels = readJson(path.join(rootDir, ".github", "labels.json"));
  if (!Array.isArray(localLabels)) {
    return [fail(".github/labels.json is not readable")];
  }

  const repo = commandOutput("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], rootDir);
  if (!repo) {
    return [warn("GitHub labels could not be compared", "Check `gh auth status`.")];
  }

  const remote = commandResult("gh", ["api", `repos/${repo}/labels?per_page=100`], rootDir);
  if (!remote.ok) {
    return [warn("GitHub labels could not be compared", remote.stderr)];
  }

  const remoteLabels = parseJson(remote.stdout);
  if (!Array.isArray(remoteLabels)) {
    return [warn("GitHub labels could not be parsed")];
  }

  const remoteByName = new Map(remoteLabels.map((label) => [label.name, label]));
  const remoteByLowercase = new Map(remoteLabels.map((label) => [label.name.toLowerCase(), label]));
  const drift = localLabels
    .map((local) => {
      const remote = remoteByName.get(local.name) ?? remoteByLowercase.get(local.name.toLowerCase());
      if (!remote) {
        return { type: "missing", local };
      }

      const colorMatches = normalizeColor(remote.color) === normalizeColor(local.color);
      const descriptionMatches = String(remote.description ?? "") === String(local.description ?? "");
      const nameMatches = remote.name === local.name;

      return nameMatches && colorMatches && descriptionMatches
        ? null
        : { type: "mismatch", local, remote };
    })
    .filter(Boolean);

  if (drift.length === 0) {
    return [ok("GitHub labels match .github/labels.json")];
  }

  if (!doctorOptions.fix) {
    const summary = drift.map((item) => {
      if (item.type === "missing") {
        return `${item.local.name} missing`;
      }
      return `${item.remote.name} -> ${item.local.name}`;
    }).join(", ");

    return [
      warn(
        "GitHub labels drift from .github/labels.json",
        `${summary}. Run \`npm run workflow:doctor -- --fix\` to sync them.`
      )
    ];
  }

  const synced = [];
  const failed = [];

  for (const item of drift) {
    const label = item.local;
    const args = item.type === "missing"
      ? [
          "api",
          "--method",
          "POST",
          `repos/${repo}/labels`,
          "-f",
          `name=${label.name}`,
          "-f",
          `color=${label.color}`,
          "-f",
          `description=${label.description}`
        ]
      : [
          "api",
          "--method",
          "PATCH",
          `repos/${repo}/labels/${encodeURIComponent(item.remote.name)}`,
          "-f",
          `new_name=${label.name}`,
          "-f",
          `color=${label.color}`,
          "-f",
          `description=${label.description}`
        ];

    const result = commandResult("gh", args, rootDir);

    if (result.ok) {
      synced.push(label.name);
    } else {
      failed.push(`${label.name}: ${result.stderr || result.stdout}`);
    }
  }

  if (failed.length > 0) {
    return [warn("Some GitHub labels could not be synced", failed.join("; "))];
  }

  return [ok("GitHub labels synced from .github/labels.json", synced.join(", "))];
}

function normalizeColor(color) {
  return String(color ?? "").replace(/^#/, "").toLowerCase();
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function printHelp() {
  console.log(`Usage: npm run workflow:doctor -- [--fix] [--json]

Checks repo-local workflow automation, Graphite availability, GitHub settings,
required templates, required package scripts, and PR label catalog drift.

Options:
  --fix   Apply safe local Graphite branch naming settings and create missing GitHub labels.
  --json  Print machine-readable check results.`);
}
