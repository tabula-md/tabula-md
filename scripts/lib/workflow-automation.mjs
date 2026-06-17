import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseAgentSection } from "./agent-context.mjs";

export const workflowRequiredFiles = [
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DEVELOPMENT.md",
  "LICENSE",
  "SECURITY.md",
  "WORKFLOW.md",
  "AGENTS.md",
  ".codex/hooks.json",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/labels.json",
  ".github/workflows/ci.yml",
  ".linear/ISSUE_TEMPLATE.md",
  ".release/CHANGELOG_ENTRY_TEMPLATE.md",
  ".release/RELEASE_NOTES_TEMPLATE.md"
];

export const workflowRequiredScripts = [
  "pr:metadata",
  "pr:ready",
  "workflow:doctor",
  "workflow:status",
  "test:hooks",
  "test",
  "build"
];

export const prBodySections = [
  "Summary",
  "Review Focus",
  "Implementation Notes",
  "Validation",
  "Risk",
  "Evidence"
];

const conventionalTitlePattern = /^(feat|fix|docs|refactor|test|build|ci|chore|perf|style|revert)(\([a-z0-9-]+\))?: .*[a-zA-Z0-9`)"]$/;
const datePrefixedBranchPattern = /^\d{2}-\d{2}-/;
const linearKeyBranchPattern = /(?:^|[/_-])mts-\d+(?:[/_-]|$)/i;
const underscoreBranchPattern = /_/;
const agentBranchPattern = /^(codex|claude)\//;

export function ok(message, detail = "") {
  return { level: "ok", message, detail };
}

export function warn(message, detail = "") {
  return { level: "warn", message, detail };
}

export function fail(message, detail = "") {
  return { level: "fail", message, detail };
}

export function info(message, detail = "") {
  return { level: "info", message, detail };
}

export function hasFailures(checks) {
  return checks.some((check) => check.level === "fail");
}

export function formatCheckReport(title, checks) {
  const lines = [title];
  for (const check of checks) {
    const suffix = check.detail ? ` - ${check.detail}` : "";
    lines.push(`[${check.level}] ${check.message}${suffix}`);
  }
  return lines.join("\n");
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function commandResult(command, args = [], cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

export function commandOutput(command, args = [], cwd = process.cwd()) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export function repoRoot(cwd = process.cwd()) {
  const root = commandOutput("git", ["rev-parse", "--show-toplevel"], cwd);
  return root || cwd;
}

export function checkRequiredFiles(root, files = workflowRequiredFiles) {
  return files.map((file) => {
    const exists = fs.existsSync(path.join(root, file));
    return exists ? ok(`Required file exists: ${file}`) : fail(`Missing required file: ${file}`);
  });
}

export function checkPackageScripts(root, scripts = workflowRequiredScripts) {
  const packageJson = readJson(path.join(root, "package.json"));
  if (!packageJson?.scripts) {
    return [fail("package.json scripts are unavailable")];
  }

  return scripts.map((script) => (
    packageJson.scripts[script]
      ? ok(`Package script exists: ${script}`)
      : fail(`Missing package script: ${script}`)
  ));
}

export function checkPrTemplateBody(body, { branch = "" } = {}) {
  const text = String(body ?? "");
  const checks = [];

  for (const section of prBodySections) {
    checks.push(
      text.includes(`## ${section}`)
        ? ok(`PR body has section: ${section}`)
        : fail(`PR body missing section: ${section}`)
    );
  }

  if (/^## Links\b/m.test(text)) {
    checks.push(warn("PR body still has a Links section", "Graphite/Linear metadata should be the default linkage surface."));
  }

  const agent = parseAgentSection(text);
  const shouldValidateAgent = agent.present || isAgentAuthoredBranch(branch);
  if (shouldValidateAgent) {
    if (!agent.present) {
      checks.push(fail("Agent-authored PR is missing agent provenance"));
    } else {
      checks.push(agent.tool && agent.tool !== "Unknown" ? ok("PR body records agent tool", agent.tool) : fail("PR body has unknown agent tool"));
      checks.push(agent.session && agent.session !== "Unknown" ? ok("PR body records agent session", agent.session) : fail("PR body has unknown agent session"));
    }
  }

  return checks;
}

export function checkPrLabels(labels = [], labelCatalog = []) {
  const labelNames = labels.map((label) => label.name).filter(Boolean);
  const catalogNames = new Set(labelCatalog.map((label) => label.name).filter(Boolean));

  if (labelNames.length === 0) {
    return [fail("PR is missing label metadata")];
  }

  if (catalogNames.size === 0) {
    return [warn("PR label catalog is unavailable", labelNames.join(", "))];
  }

  const typeLabels = labelNames.filter((name) => catalogNames.has(name));
  if (typeLabels.length === 0) {
    return [fail("PR is missing a type label from .github/labels.json", labelNames.join(", "))];
  }

  if (typeLabels.length > 1) {
    return [fail("PR should have exactly one type label from .github/labels.json", typeLabels.join(", "))];
  }

  return [ok("PR has one type label", typeLabels[0])];
}

export function readLabelCatalog(root) {
  const labels = readJson(path.join(root, ".github", "labels.json"));
  return Array.isArray(labels) ? labels : [];
}

export function checkConventionalTitle(title) {
  const value = String(title ?? "").trim();
  if (conventionalTitlePattern.test(value)) {
    return ok("PR title follows Conventional Commit style", value);
  }
  return fail("PR title should be `type(scope): summary`", value || "empty title");
}

export function checkBranchName(branch) {
  const value = String(branch ?? "").trim();
  const checks = [];

  if (!value) {
    return [fail("Current branch name is unavailable")];
  }

  if (datePrefixedBranchPattern.test(value)) {
    checks.push(warn("Branch appears date-prefixed", value));
  }

  if (linearKeyBranchPattern.test(value)) {
    checks.push(warn("Branch includes a Linear issue key", value));
  }

  if (underscoreBranchPattern.test(value)) {
    checks.push(warn("Branch uses underscores instead of slash/kebab-case", value));
  }

  if (value.length > 72) {
    checks.push(warn("Branch name is longer than 72 characters", value));
  }

  if (checks.length === 0) {
    checks.push(ok("Branch name follows the semantic short-lived branch policy", value));
  }

  return checks;
}

export function isAgentAuthoredBranch(branch) {
  return agentBranchPattern.test(String(branch ?? "").trim());
}

export function checkStatusChecks(checks = []) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return [warn("No PR checks found")];
  }

  return checks.map((check) => {
    const name = check.name ?? "unknown check";
    const state = check.conclusion ?? check.status ?? "unknown";
    const normalizedState = String(state).toUpperCase();

    if (["SUCCESS", "PASSED", "PASS", "COMPLETED"].includes(normalizedState)) {
      return ok(`Check passed: ${name}`);
    }

    if (["FAILURE", "FAILED", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(normalizedState)) {
      return fail(`Check failed: ${name}`, state);
    }

    return warn(`Check not complete: ${name}`, state);
  });
}

export function parseArgs(argv, { allowWorkflowFixFlags = true } = {}) {
  const options = {
    deleteStaleGraphiteBase: false,
    fixGraphiteConfig: false,
    help: false,
    json: false,
    syncLabels: false
  };

  for (const arg of argv) {
    if (arg === "--fix") {
      if (allowWorkflowFixFlags) {
        throw new Error("Use an explicit fix flag: --fix-graphite-config, --delete-stale-graphite-base, or --sync-labels.");
      }
      throw new Error(`Unknown option: ${arg}`);
    }

    if (arg === "--fix-graphite-config") {
      if (!allowWorkflowFixFlags) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.fixGraphiteConfig = true;
      continue;
    }

    if (arg === "--delete-stale-graphite-base") {
      if (!allowWorkflowFixFlags) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.deleteStaleGraphiteBase = true;
      continue;
    }

    if (arg === "--sync-labels") {
      if (!allowWorkflowFixFlags) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.syncLabels = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}
