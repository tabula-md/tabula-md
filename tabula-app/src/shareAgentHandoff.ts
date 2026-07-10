import type { WorkspaceFile } from "./workspaceStorage";

export type AgentHandoffScope = "file" | "project";

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
  const trimmedInstruction = instruction.trim();
  const visibleFiles =
    scope === "project" ? files : activeFile ? [activeFile] : [];
  const fileSections = visibleFiles
    .map(
      (file) =>
        `## ${file.title}\n\n\`\`\`markdown\n${file.text.trimEnd()}\n\`\`\``,
    )
    .join("\n\n");

  return [
    liveRoomUrl
      ? "Join this Tabula.md room as an agent actor."
      : "Use the following Tabula.md file context.",
    trimmedInstruction
      ? `Task: ${trimmedInstruction}`
      : "Task: Help me continue from this context.",
    "",
    `Scope: ${scope === "project" ? "current workspace" : "current document"}`,
    activeFile ? `Active document: ${activeFile.title} (${activeFile.id})` : "",
    liveRoomUrl
      ? [
          "",
          "Participate as a normal room actor.",
          "Use Tabula.md workspace CRDT schema and binary room protocol v2.",
          "Publish your agent actor through Awareness and edit the shared Yjs workspace directly.",
          "The room URL is a bearer secret. Do not log it or send it to a hosted plaintext processor.",
          `Room URL: ${liveRoomUrl}`,
        ].join("\n")
      : "",
    "",
    fileSections || "No file content is available.",
  ].filter(Boolean).join("\n");
};
