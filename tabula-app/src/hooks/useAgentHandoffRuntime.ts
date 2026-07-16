import { useMemo, useState } from "react";
import {
  buildAgentContextPrompt,
  buildLiveAgentRequest,
  getAgentClientSetup,
  type AgentHandoffClient,
  type AgentHandoffScope,
} from "../shareAgentHandoff";
import { productAnalytics } from "../observability/productAnalytics";
import type { WorkspaceFile } from "../workspaceStorage";

const CLIENT_STORAGE_KEY = "tabula.agent-handoff.client";

const agentClients = new Set<AgentHandoffClient>([
  "claude",
  "claude-code",
  "codex",
  "chatgpt",
  "other",
]);

const readStoredClient = (): AgentHandoffClient => {
  if (typeof window === "undefined") return "claude";
  try {
    const stored = window.localStorage.getItem(CLIENT_STORAGE_KEY);
    return stored && agentClients.has(stored as AgentHandoffClient)
      ? stored as AgentHandoffClient
      : "claude";
  } catch {
    return "claude";
  }
};

type UseAgentHandoffRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeText: string;
  files: WorkspaceFile[];
  roomId?: string;
  roomUrl?: string;
};

export function useAgentHandoffRuntime({
  activeFile,
  activeText,
  files,
  roomId,
  roomUrl,
}: UseAgentHandoffRuntimeOptions) {
  const [client, setClientState] = useState<AgentHandoffClient>(readStoredClient);
  const [scope, setScope] = useState<AgentHandoffScope>(activeFile ? "file" : "project");
  const [task, setTask] = useState("");
  const [copied, setCopied] = useState<"setup" | "request" | "context" | null>(null);
  const promptFiles = useMemo(
    () => activeFile
      ? files.map((file) => file.id === activeFile.id
        ? { ...file, text: activeText }
        : file)
      : files,
    [activeFile, activeText, files],
  );
  const promptActiveFile = activeFile
    ? { ...activeFile, text: activeText }
    : promptFiles[0];
  const setup = getAgentClientSetup(client);
  const canCopy = Boolean(task.trim());

  const showCopied = (value: "setup" | "request" | "context") => {
    setCopied(value);
    window.setTimeout(() => setCopied((current) => current === value ? null : current), 1200);
  };

  const open = () => {
    productAnalytics.report("agent_handoff_opened", { roomId });
  };

  const reset = () => {
    setTask("");
    setScope(activeFile ? "file" : "project");
    setCopied(null);
  };

  const setClient = (nextClient: AgentHandoffClient) => {
    setClientState(nextClient);
    try {
      window.localStorage.setItem(CLIENT_STORAGE_KEY, nextClient);
    } catch {
      // Client preference is optional when browser storage is unavailable.
    }
    productAnalytics.report("agent_client_selected", {
      agentClient: nextClient,
      roomId,
    });
  };

  const copySetup = async () => {
    await navigator.clipboard.writeText(setup.value);
    productAnalytics.report("agent_setup_copied", { agentClient: client, roomId });
    showCopied("setup");
  };

  const copyRoomRequest = async () => {
    if (!canCopy || !roomUrl) return;
    await navigator.clipboard.writeText(buildLiveAgentRequest({
      activeFile: promptActiveFile,
      instruction: task,
      liveRoomUrl: roomUrl,
      scope,
    }));
    productAnalytics.report("agent_request_copied", {
      agentClient: client,
      handoffMode: "live",
      roomId,
    });
    showCopied("request");
  };

  const copyContext = async () => {
    if (!canCopy) return;
    await navigator.clipboard.writeText(buildAgentContextPrompt({
      activeFile: promptActiveFile,
      files: promptFiles,
      instruction: task,
      scope,
    }));
    productAnalytics.report("agent_context_copied", {
      agentClient: client,
      handoffMode: "context",
      roomId,
    });
    showCopied("context");
  };

  return {
    canCopyContext: canCopy && promptFiles.length > 0,
    canCopyRoomRequest: canCopy && Boolean(roomUrl),
    client,
    copied,
    copyContext,
    copyRoomRequest,
    copySetup,
    open,
    reset,
    scope,
    setClient,
    setScope,
    setTask,
    setup,
    task,
  };
}

export type AgentHandoffRuntime = ReturnType<typeof useAgentHandoffRuntime>;
