import type { WorkspaceFile } from "./workspaceStorage";

export type AgentHandoffScope = "file" | "project";
export type AgentHandoffClient =
  | "claude"
  | "claude-code"
  | "codex"
  | "chatgpt"
  | "other";
export type AgentHandoffTrust = "hosted" | "local" | "custom";

export const TABULA_HOSTED_MCP_URL = "https://mcp.tabula.md/mcp";

const localMcpCommand = "npx -y @tabula-md/mcp@latest --enable-write";

export const getAgentClientSetup = (client: AgentHandoffClient) => {
  switch (client) {
    case "claude":
    case "chatgpt":
      return {
        trust: "hosted" as const,
        value: TABULA_HOSTED_MCP_URL,
      };
    case "claude-code":
      return {
        trust: "local" as const,
        value: `claude mcp add tabula -- ${localMcpCommand}`,
      };
    case "codex":
      return {
        trust: "local" as const,
        value: `codex mcp add tabula -- ${localMcpCommand}`,
      };
    case "other":
      return {
        trust: "custom" as const,
        value: JSON.stringify({
          mcpServers: {
            tabula: {
              command: "npx",
              args: ["-y", "@tabula-md/mcp@latest", "--enable-write"],
            },
          },
        }, null, 2),
      };
  }
};

const activeFileLine = (activeFile?: WorkspaceFile) =>
  activeFile ? `Target document: ${activeFile.title} (${activeFile.id})` : "";

export const buildLiveAgentRequest = ({
  activeFile,
  instruction,
  liveRoomUrl,
  scope,
}: {
  activeFile?: WorkspaceFile;
  instruction: string;
  liveRoomUrl: string;
  scope: AgentHandoffScope;
}) => [
  "Use the connected Tabula tools.",
  "Call tabula_read_me first. If write access is read-only and this task requires edits, stop and tell me.",
  "Call tabula_connect_room with the room URL below and wait until workspace state is ready.",
  "Read the current workspace before editing, then use tabula_apply_workspace_changes for hash-guarded changes.",
  "Do not expose or repeat the room URL in your response.",
  "If Tabula tools are unavailable, stop and tell me to connect Tabula MCP.",
  "",
  `Task: ${instruction.trim()}`,
  `Scope: ${scope === "project" ? "current workspace" : "current document"}`,
  scope === "file" ? activeFileLine(activeFile) : "",
  "",
  `Room URL: ${liveRoomUrl}`,
].filter(Boolean).join("\n");

export const buildAgentContextPrompt = ({
  activeFile,
  files,
  instruction,
  scope,
}: {
  activeFile?: WorkspaceFile;
  files: WorkspaceFile[];
  instruction: string;
  scope: AgentHandoffScope;
}) => {
  const visibleFiles = scope === "project" ? files : activeFile ? [activeFile] : [];
  const fileSections = visibleFiles
    .map((file) => `## ${file.title}\n\n\`\`\`markdown\n${file.text.trimEnd()}\n\`\`\``)
    .join("\n\n");

  return [
    "Use the following Tabula.md Markdown context.",
    `Task: ${instruction.trim()}`,
    `Scope: ${scope === "project" ? "current workspace" : "current document"}`,
    scope === "file" ? activeFileLine(activeFile) : "",
    "This is a point-in-time copy. Your changes will not sync back to Tabula.md.",
    "",
    fileSections || "No file content is available.",
  ].filter(Boolean).join("\n");
};

/** @deprecated Use buildLiveAgentRequest or buildAgentContextPrompt. */
export const buildLocalAgentPrompt = ({
  activeFile,
  files,
  instruction,
  liveRoomUrl,
  scope,
}: {
  activeFile?: WorkspaceFile;
  files: WorkspaceFile[];
  instruction: string;
  liveRoomUrl?: string;
  scope: AgentHandoffScope;
}) => {
  if (liveRoomUrl) {
    return buildLiveAgentRequest({
      activeFile,
      instruction: instruction.trim() || "Help me continue from this context.",
      liveRoomUrl,
      scope,
    });
  }
  return buildAgentContextPrompt({
    activeFile,
    files,
    instruction: instruction.trim() || "Help me continue from this context.",
    scope,
  });
};
