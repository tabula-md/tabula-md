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
  "WORKFLOW.ko.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docs/README.md",
  "knowledge/index.md",
  "knowledge/log.md",
  "knowledge/architecture/collaboration-security.md",
  "knowledge/workflow/codex-hooks.md",
  ".codex/hooks.json",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/labels.json",
  ".github/workflows/ci.yml",
  ".linear/ISSUE_TEMPLATE.md",
  ".release/CHANGELOG_ENTRY_TEMPLATE.md",
  ".release/RELEASE_NOTES_TEMPLATE.md",
  "scripts/workflow-doctor.mjs",
  "scripts/knowledge-check.mjs",
  "scripts/pr-handoff.mjs",
  "scripts/pr-body.mjs",
  "scripts/pr-title.mjs",
  "scripts/lib/pr-body-template.mjs",
  "scripts/lib/pr-github.mjs",
  "scripts/lib/pr-metadata.mjs",
  "scripts/lib/pr-options.mjs",
  "scripts/workflow-maintenance.mjs",
  "scripts/workflow-status.mjs",
  "scripts/lib/workflow-status.mjs",
  "scripts/workflow-sync.mjs"
];

export const workflowRequiredScripts = [
  "pr:body",
  "pr:metadata",
  "pr:handoff",
  "pr:ready",
  "pr:title",
  "knowledge:check",
  "workflow:doctor",
  "workflow:maintenance",
  "workflow:status",
  "workflow:sync",
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
const agentBranchPattern = /^(?:(?:codex|claude|cursor)|agent\/[a-z0-9-]+)\//;

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
    const content = getMarkdownSection(text, section);
    checks.push(
      content !== null
        ? ok(`PR body has section: ${section}`)
        : fail(`PR body missing section: ${section}`)
    );

    if (content !== null) {
      checks.push(
        hasMeaningfulSectionContent(content, section)
          ? ok(`PR body fills section: ${section}`)
          : fail(`PR body section is still placeholder-only: ${section}`)
      );
    }
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

export function getMarkdownSection(body, section) {
  const text = String(body ?? "");
  const header = new RegExp(`^## ${escapeRegExp(section)}\\s*$`, "m").exec(text);
  if (!header) {
    return null;
  }

  const contentStart = header.index + header[0].length;
  const rest = text.slice(contentStart);
  const nextHeader = rest.search(/\n## [^\n]+/);
  return nextHeader >= 0 ? rest.slice(0, nextHeader) : rest;
}

export function hasMeaningfulSectionContent(content, section = "") {
  const lines = String(content ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isPlaceholderLine(line, section));

  return lines.length > 0;
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

export function parseGitCountObjects(output) {
  const parsed = {};

  for (const line of String(output ?? "").split(/\r?\n/)) {
    const [key, ...valueParts] = line.split(":");
    if (!key || valueParts.length === 0) {
      continue;
    }
    parsed[key.trim()] = valueParts.join(":").trim();
  }

  return {
    count: numberOrNull(parsed.count),
    size: parsed.size ?? "",
    inPack: numberOrNull(parsed["in-pack"]),
    packs: numberOrNull(parsed.packs),
    prunePackable: numberOrNull(parsed["prune-packable"]),
    garbage: numberOrNull(parsed.garbage),
    sizeGarbage: parsed["size-garbage"] ?? ""
  };
}

export function readGitMaintenanceState(root) {
  const gitDir = commandOutput("git", ["rev-parse", "--git-dir"], root);
  const resolvedGitDir = gitDir ? path.resolve(root, gitDir) : path.join(root, ".git");
  const gcLogPath = path.join(resolvedGitDir, "gc.log");
  const countResult = commandResult("git", ["count-objects", "-vH"], root);
  const counts = countResult.ok ? parseGitCountObjects(countResult.stdout) : null;
  const gcLog = fs.existsSync(gcLogPath) ? fs.readFileSync(gcLogPath, "utf8").trim() : "";

  return {
    countResult,
    counts,
    gcLog,
    gcLogPath,
    hasGcLog: fs.existsSync(gcLogPath)
  };
}

export function parseArgs(argv, { allowMaintenanceFlags = false, allowWorkflowFixFlags = true } = {}) {
  const options = {
    deleteStaleGraphiteBase: false,
    fixGraphiteConfig: false,
    help: false,
    json: false,
    postMerge: false,
    register: false,
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

    if (arg === "--post-merge") {
      if (!allowMaintenanceFlags) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.postMerge = true;
      continue;
    }

    if (arg === "--register") {
      if (!allowMaintenanceFlags) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.register = true;
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

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPlaceholderLine(line, section) {
  const value = line
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();

  if (!value || value === "-") {
    return true;
  }

  if (/^(Automated|Manual|Not run):\s*$/i.test(value)) {
    return true;
  }

  if (section === "Validation" && /^(Automated|Manual|Not run):\s*(?:none|n\/a)\.?$/i.test(value)) {
    return true;
  }

  if (/^Screenshots\/video:\s*$/i.test(value)) {
    return true;
  }

  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
