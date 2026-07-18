import { parseFrontmatter } from "./markdown/parse";

export type WorkspaceConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type WorkspaceViewFile = {
  id: string;
  title: string;
  text: string;
};

export const getWorkspaceStatusLabel = (status: WorkspaceConnectionStatus) =>
  ({
    idle: "Local draft",
    connecting: "Connecting",
    connected: "Live session",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    failed: "Connection failed",
  })[status];

export const getActiveWorkspaceStatus = ({
  isLive,
  connectionStatus,
}: {
  isLive: boolean;
  connectionStatus: WorkspaceConnectionStatus;
}) => (isLive ? connectionStatus : "idle");

export const getWorkspaceFileSearchText = (file: WorkspaceViewFile) => {
  const metadata = parseFrontmatter(file.text);
  const title = metadata.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value ?? "";
  return `${file.title} ${title}`;
};
