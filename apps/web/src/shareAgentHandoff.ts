import type { WorkspaceFile } from "./workspaceStorage";

export type AgentHandoffScope = "file" | "project";

export const buildLocalAgentPrompt = ({
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
    "Use the following Tabula.md file context.",
    trimmedInstruction
      ? `Task: ${trimmedInstruction}`
      : "Task: Help me continue from this context.",
    "",
    `Scope: ${scope === "project" ? "project" : "current file"}`,
    "",
    fileSections || "No file content is available.",
  ].join("\n");
};
