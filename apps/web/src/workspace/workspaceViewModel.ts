import type { ConnectionStatus } from "../collaboration";
import { parseFrontmatter } from "../markdown";
import { isUsableLiveRoomFile, type WorkspaceFile } from "../workspaceStorage";

export const getWorkspaceStatusLabel = (status: ConnectionStatus) =>
  ({
    idle: "Local draft",
    connecting: "Connecting",
    connected: "Live session",
    offline: "Room offline",
  })[status];

export const getActiveWorkspaceStatus = ({
  isLive,
  connectionStatus,
}: {
  isLive: boolean;
  connectionStatus: ConnectionStatus;
}) => (isLive ? connectionStatus : "idle");

export const getWorkspaceFileStatus = ({
  file,
  activeFileId,
  activeConnectionStatus,
}: {
  file: WorkspaceFile;
  activeFileId?: string;
  activeConnectionStatus: ConnectionStatus;
}) => {
  if (file.id === activeFileId) {
    return activeConnectionStatus;
  }

  if (!isUsableLiveRoomFile(file)) {
    return "idle";
  }

  return file.connectionStatus ?? "offline";
};

export const getWorkspaceFileSearchText = (file: WorkspaceFile) => {
  const metadata = parseFrontmatter(file.text);
  const title = metadata.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value ?? "";
  return `${file.title} ${title}`;
};
