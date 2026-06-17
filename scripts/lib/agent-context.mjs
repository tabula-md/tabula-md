import fs from "node:fs";
import path from "node:path";

const agentNameEnvKeys = [
  "TABULA_AGENT_NAME",
  "AGENT_NAME",
  "CODEX_AGENT_NAME",
  "CLAUDE_AGENT_NAME",
  "CLAUDECODE_AGENT_NAME"
];

const sessionIdEnvKeys = [
  "TABULA_AGENT_SESSION_ID",
  "AGENT_SESSION_ID",
  "CODEX_SESSION_ID",
  "CODEX_THREAD_ID",
  "CLAUDE_SESSION_ID",
  "CLAUDECODE_SESSION_ID",
  "SESSION_ID"
];

export function resolveAgentContext({ agent, session, cwd = process.cwd() } = {}) {
  return {
    tool: firstNonEmpty([agent, ...agentNameEnvKeys.map((key) => process.env[key]), inferAgentName()]) ?? "Unknown",
    session: firstNonEmpty([session, ...sessionIdEnvKeys.map((key) => process.env[key]), latestHookStateSessionId(cwd)]) ?? "Unknown"
  };
}

export function formatAgentSection(context) {
  return `## Agent

- Tool: ${context.tool}
- Session: ${context.session}`;
}

export function upsertAgentSection(body, context) {
  const text = String(body ?? "").trim();
  const section = formatAgentSection(context);
  const range = findAgentSectionRange(text);

  if (range) {
    return `${`${text.slice(0, range.start).trimEnd()}\n${section}\n${text.slice(range.end).trimStart()}`.trim()}\n`;
  }

  const validationIndex = text.search(/^## Validation$/m);
  if (validationIndex >= 0) {
    return `${text.slice(0, validationIndex).trim()}\n\n${section}\n\n${text.slice(validationIndex).trim()}\n`;
  }

  return text ? `${text}\n\n${section}\n` : `${section}\n`;
}

export function parseAgentSection(body) {
  const text = String(body ?? "");
  const range = findAgentSectionRange(text);
  const section = range ? text.slice(range.contentStart, range.end).trim() : "";

  return {
    present: Boolean(section),
    tool: section.match(/^- Tool:\s*(.+)$/m)?.[1]?.trim() ?? "",
    session: section.match(/^- Session:\s*(.+)$/m)?.[1]?.trim() ?? ""
  };
}

function findAgentSectionRange(text) {
  const header = /^## Agent\s*$/m.exec(text);
  if (!header) {
    return null;
  }

  const start = header.index;
  const contentStart = start + header[0].length;
  const rest = text.slice(contentStart);
  const nextHeader = rest.search(/\n## [^\n]+/);
  const end = nextHeader >= 0 ? contentStart + nextHeader : text.length;

  return { start, contentStart, end };
}

function inferAgentName() {
  if (process.env.CODEX_HOME || process.env.CODEX_CLI || process.env.CODEX_SANDBOX) {
    return "Codex";
  }

  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE || process.env.CLAUDE_CONFIG_DIR) {
    return "Claude Code";
  }

  return "";
}

function latestHookStateSessionId(cwd) {
  const stateDir = path.join(repoRoot(cwd), ".codex", "hook-state");

  try {
    const latest = fs.readdirSync(stateDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const filePath = path.join(stateDir, file);
        return { file, mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];

    return latest ? latest.file.replace(/\.json$/, "") : "";
  } catch {
    return "";
  }
}

function repoRoot(cwd) {
  let current = path.resolve(cwd);

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(cwd);
    }
    current = parent;
  }
}

function firstNonEmpty(values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean);
}
