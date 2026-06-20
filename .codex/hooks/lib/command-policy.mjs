const sourceWriteRoots = [
  ".codex/hooks/",
  ".codex/hooks.json",
  ".github/",
  "apps/",
  "docs/",
  "packages/",
  "private-docs/",
  "scripts/",
  "AGENTS.md",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts"
];

const allowedGitPassthrough = new Set([
  "add",
  "diff",
  "grep",
  "log",
  "ls-files",
  "rev-parse",
  "show",
  "stash",
  "status"
]);

export function evaluateBashCommand(command) {
  const normalized = normalizeCommand(command);
  const findings = [
    ...findBlockedGraphiteLifecycleCommands(normalized),
    ...findDestructiveGitCommands(normalized),
    ...findShellSourceWrites(normalized),
    ...findAdvisoryGitCommands(normalized)
  ];

  const block = findings.find((finding) => finding.severity === "block");
  if (block) {
    return {
      decision: "block",
      message: block.message,
      findings
    };
  }

  const warn = findings.find((finding) => finding.severity === "warn");
  if (warn) {
    return {
      decision: "warn",
      message: warn.message,
      findings
    };
  }

  return { decision: "allow", findings };
}

export function normalizeCommand(command) {
  return String(command ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, "").trim())
    .filter(Boolean)
    .join("\n");
}

function findBlockedGraphiteLifecycleCommands(command) {
  const findings = [];

  if (/\bgit\s+(?:checkout|switch)\s+(?:-[^\n;|&\s]*[bcB][^\n;|&\s]*|--create|--orphan)\b/.test(command)) {
    findings.push(block("Create Graphite branches with `gt create`, not raw `git checkout -b` or `git switch -c`."));
  }

  for (const args of extractGitBranchArgs(command)) {
    if (!isReadOnlyGitBranchArgs(args)) {
      findings.push(block("Use Graphite branch commands for PR-bound branch lifecycle. Avoid raw `git branch` creation/deletion."));
      break;
    }
  }

  if (/\bgit\s+commit\b/.test(command)) {
    findings.push(block("Use `gt create` for new changesets or `gt modify` for existing Graphite branches instead of raw `git commit`."));
  }

  if (/\bgit\s+push\b/.test(command)) {
    findings.push(block("Publish or update PR-bound work with `gt submit` or `gt submit --stack`, not raw `git push`."));
  }

  if (/\bgit\s+pull\b/.test(command)) {
    findings.push(block("Sync trunk and restack Graphite branches with `gt sync`, not raw `git pull`."));
  }

  if (hasGtSubcommand(command, "pull")) {
    findings.push(block("`gt pull` is a Git passthrough. Sync trunk and Graphite branches with `gt sync`."));
  }

  if (hasGtSubcommand(command, "push")) {
    findings.push(block("`gt push` is a Git passthrough. Publish or update PR-bound work with `gt submit` or `gt submit --stack`."));
  }

  if (hasGitSubcommand(command, "merge")) {
    findings.push(block("Use Graphite restack/sync flows for PR-bound branches instead of raw `git merge`."));
  }

  if (/\bgh\s+pr\s+(?:create|merge|close|ready|edit)\b/.test(command)) {
    findings.push(block("Manage PR creation and updates through `gt submit`/Graphite, not `gh pr` lifecycle commands."));
  }

  if (isMutatingGitHubLifecycleApi(command)) {
    findings.push(block("Do not mutate PRs or remote refs with direct `gh api` calls. Use Graphite lifecycle commands, `npm run pr:handoff`, or an explicit workflow doctor fix flag."));
  }

  return findings;
}

function isMutatingGitHubLifecycleApi(command) {
  if (!/\bgh\s+api\b/.test(command)) {
    return false;
  }

  const mutates = /(?:--method|-X)\s+(?:POST|PATCH|PUT|DELETE)\b/i.test(command);
  if (!mutates) {
    return false;
  }

  return /\brepos\/[^\s"'`]+\/[^\s"'`]+\/pulls(?:\/|\b)|\brepos\/[^\s"'`]+\/[^\s"'`]+\/git\/refs\/heads(?:\/|\b)/.test(command);
}

function hasGtSubcommand(command, subcommand) {
  const pattern = new RegExp(`(?:^|[\\n;&|])\\s*gt\\s+${escapeRegExp(subcommand)}(?:\\s|$)`);
  return pattern.test(command);
}

function hasGitSubcommand(command, subcommand) {
  const pattern = new RegExp(`(?:^|[\\n;&|])\\s*git\\s+${escapeRegExp(subcommand)}(?:\\s|$)`);
  return pattern.test(command);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findDestructiveGitCommands(command) {
  const findings = [];

  if (/\bgit\s+reset\s+--hard\b/.test(command)) {
    findings.push(block("`git reset --hard` can destroy user work. Do not run it unless the human operator explicitly asked for that operation."));
  }

  if (/\bgit\s+checkout\s+--(?:\s|$)/.test(command) || /\bgit\s+restore\b/.test(command)) {
    findings.push(block("Raw checkout/restore can discard user changes. Do not run it unless the human operator explicitly asked for that operation."));
  }

  if (/\bgit\s+clean\s+-[^\n;|&\s]*[fd][^\n;|&\s]*/.test(command)) {
    findings.push(block("`git clean` can delete untracked work. Do not run it unless the human operator explicitly asked for cleanup."));
  }

  return findings;
}

function findAdvisoryGitCommands(command) {
  const findings = [];
  const gitCommands = [...command.matchAll(/\bgit\s+([a-z-]+)\b/g)].map((match) => match[1]);

  for (const gitCommand of gitCommands) {
    if (allowedGitPassthrough.has(gitCommand)) {
      continue;
    }

    if (gitCommand === "checkout" || gitCommand === "switch") {
      findings.push(warn("Prefer `gt checkout` for Graphite-tracked branch navigation. Raw checkout is only for explicit recovery/tracking cases."));
      continue;
    }

    if (gitCommand === "rebase") {
      findings.push(warn("Raw `git rebase` is only for explicit recovery/tracking/conflict cases. Prefer `gt sync` or `gt restack` for normal Graphite work."));
    }
  }

  return findings;
}

function findShellSourceWrites(command) {
  const findings = [];

  for (const target of extractRedirectTargets(command)) {
    if (isProjectSourcePath(target)) {
      findings.push(block(`Use apply_patch for manual source edits instead of shell redirection to \`${target}\`.`));
    }
  }

  for (const target of extractScriptedWriteTargets(command)) {
    if (isProjectSourcePath(target)) {
      findings.push(block(`Use apply_patch for manual source edits instead of scripting file writes to \`${target}\`.`));
      break;
    }
  }

  return findings;
}

function extractGitBranchArgs(command) {
  return [...command.matchAll(/(?:^|[\n;&|])\s*git\s+branch(?:\s+([^\n;&|]+))?/g)].map((match) => (match[1] ?? "").trim());
}

function isReadOnlyGitBranchArgs(args) {
  if (!args) {
    return true;
  }

  const tokens = args.split(/\s+/).filter(Boolean);
  const hasListMode = tokens.includes("--list") || tokens.includes("-l");

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (/^-[arv]+$/.test(token)) {
      continue;
    }

    if (["--all", "--remotes", "--verbose", "--show-current", "--list", "-l", "--color", "--no-color"].includes(token)) {
      continue;
    }

    if (/^--(?:sort|format|contains|merged|no-merged|points-at)=/.test(token)) {
      continue;
    }

    if (["--sort", "--format", "--contains", "--merged", "--no-merged", "--points-at"].includes(token)) {
      if (tokens[index + 1] && !tokens[index + 1].startsWith("-")) {
        index += 1;
      }
      continue;
    }

    if (hasListMode && !token.startsWith("-")) {
      continue;
    }

    return false;
  }

  return true;
}

function extractRedirectTargets(command) {
  const targets = new Set();
  const patterns = [
    /(?:^|[\s;|&])(?:cat|printf|echo|node|python3?|ruby|perl)[\s\S]*?(?:>{1,2})\s*(["']?)([^\s"';&|]+)\1/g,
    /(?:^|[\s;|&])tee\s+(?:-[a-zA-Z]+\s+)*(["']?)([^\s"';&|]+)\1/g
  ];

  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern)) {
      const target = sanitizePath(match[2]);
      if (target) {
        targets.add(target);
      }
    }
  }

  return [...targets];
}

function sanitizePath(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^["']|["']$/g, "");
}

function isProjectSourcePath(target) {
  const normalized = sanitizePath(target);
  return sourceWriteRoots.some((root) => {
    if (root.endsWith("/")) {
      return normalized === root.slice(0, -1) || normalized.startsWith(root);
    }

    return normalized === root;
  });
}

function extractScriptedWriteTargets(command) {
  if (!/\b(?:python3?|node|ruby|perl)\b/.test(command)) {
    return [];
  }

  const targets = new Set();
  const patterns = [
    /\bwriteFile(?:Sync)?\s*\(\s*(["'`])([^"'`]+)\1/g,
    /\bopen\s*\(\s*(["'])([^"']+)\1\s*,\s*(["'])[^"']*w[^"']*\3/g,
    /\b(?:Path|pathlib\.Path)\s*\(\s*(["'])([^"']+)\1\s*\)\.write_text\b/g
  ];

  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern)) {
      const target = sanitizePath(match[2]);
      if (target) {
        targets.add(target);
      }
    }
  }

  return [...targets];
}

function block(message) {
  return { severity: "block", message };
}

function warn(message) {
  return { severity: "warn", message };
}
