import {
  FileArchive,
  FileCode2,
  FileText,
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
  if (kind === "binary") return <FileArchive size={size} />;
  return <FileText size={size} />;
}
