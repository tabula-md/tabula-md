import fs from "node:fs";
import path from "node:path";

const textDecoder = new TextDecoder();

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return textDecoder.decode(Buffer.concat(chunks)).trim();
}

export async function readHookPayload() {
  const stdin = await readStdin();
  if (!stdin) {
    return {};
  }

  try {
    return JSON.parse(stdin);
  } catch {
    return { rawInput: stdin };
  }
}

export function repoRootFromCwd(cwd = process.cwd()) {
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

export function getSessionId(payload) {
  const candidates = [
    payload?.session_id,
    payload?.sessionId,
    payload?.thread_id,
    payload?.threadId,
    payload?.conversation_id,
    payload?.conversationId
  ];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : "default";
}

export function statePathForPayload(payload, root = repoRootFromCwd(payload?.cwd)) {
  const safeSessionId = getSessionId(payload).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 96) || "default";
  return path.join(root, ".codex", "hook-state", `${safeSessionId}.json`);
}

export function readState(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function writeState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

export function findToolName(payload) {
  const direct = [
    payload?.tool_name,
    payload?.toolName,
    payload?.tool,
    payload?.name
  ].find((value) => typeof value === "string" && value.trim());

  return direct ? direct.trim() : "";
}

export function findBashCommand(payload) {
  const directCandidates = [
    payload?.command,
    payload?.cmd,
    payload?.tool_input?.command,
    payload?.tool_input?.cmd,
    payload?.toolInput?.command,
    payload?.toolInput?.cmd,
    payload?.input?.command,
    payload?.input?.cmd,
    payload?.arguments?.command,
    payload?.arguments?.cmd,
    payload?.parameters?.command,
    payload?.parameters?.cmd
  ];

  const direct = directCandidates.find((value) => typeof value === "string" && value.trim());
  if (direct) {
    return direct.trim();
  }

  return "";
}

export function findPatchText(payload) {
  const directCandidates = [
    payload?.patch,
    payload?.tool_input?.patch,
    payload?.toolInput?.patch,
    payload?.input?.patch,
    payload?.arguments?.patch,
    payload?.parameters?.patch,
    payload?.rawInput
  ];

  const direct = directCandidates.find((value) => typeof value === "string" && value.includes("*** "));
  if (direct) {
    return direct;
  }

  return findStringContaining(payload, "*** ");
}

function findStringContaining(value, needle, depth = 0) {
  if (!value || depth > 8) {
    return "";
  }

  if (typeof value === "string") {
    return value.includes(needle) ? value : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringContaining(item, needle, depth + 1);
      if (found) {
        return found;
      }
    }
    return "";
  }

  if (typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = findStringContaining(entry, needle, depth + 1);
      if (found) {
        return found;
      }
    }
  }

  return "";
}
