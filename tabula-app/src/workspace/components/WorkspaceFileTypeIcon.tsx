import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileText,
  FileVideo,
  Image,
} from "lucide-react";
import type { WorkspaceFileIconKind } from "../workspaceFilePresentation";

type WorkspaceFileTypeIconProps = {
  kind: WorkspaceFileIconKind;
  size?: number;
};

export function WorkspaceFileTypeIcon({
  kind,
  size = 16,
}: WorkspaceFileTypeIconProps) {
  if (kind === "code") return <FileCode2 size={size} />;
  if (kind === "image") return <Image size={size} />;
  if (kind === "audio") return <FileAudio size={size} />;
  if (kind === "video") return <FileVideo size={size} />;
  if (kind === "binary") return <FileArchive size={size} />;
  return <FileText size={size} />;
}
