import { parseFrontmatter } from "./markdown";
import { parseRoomShareUrl } from "./roomShareLinkModel";

export type WorkspaceConnectionStatus = "idle" | "connecting" | "connected" | "offline";

export type WorkspaceViewFile = {
  id: string;
  title: string;
  text: string;
  connectionStatus?: WorkspaceConnectionStatus;
  roomId?: string;
  shareUrl?: string;
};

export const getWorkspaceStatusLabel = (status: WorkspaceConnectionStatus) =>
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
  connectionStatus: WorkspaceConnectionStatus;
}) => (isLive ? connectionStatus : "idle");

export const isUsableWorkspaceRoomFile = (file?: Pick<WorkspaceViewFile, "roomId" | "shareUrl">) => {
  if (!file?.roomId || !file.shareUrl) {
    return false;
  }

  const parsedRoom = parseRoomShareUrl(file.shareUrl);
  return Boolean(parsedRoom && parsedRoom.roomId === file.roomId);
};

export const getWorkspaceFileStatus = ({
  file,
  activeFileId,
  activeConnectionStatus,
}: {
  file: WorkspaceViewFile;
  activeFileId?: string;
  activeConnectionStatus: WorkspaceConnectionStatus;
}) => {
  if (file.id === activeFileId) {
    return activeConnectionStatus;
  }

  if (!isUsableWorkspaceRoomFile(file)) {
    return "idle";
  }

  return file.connectionStatus ?? "offline";
};

export const getWorkspaceFileSearchText = (file: WorkspaceViewFile) => {
  const metadata = parseFrontmatter(file.text);
  const title = metadata.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value ?? "";
  return `${file.title} ${title}`;
};
