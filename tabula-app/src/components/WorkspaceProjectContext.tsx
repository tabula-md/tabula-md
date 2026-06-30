import type { ComponentProps } from "react";
import { RightPanel } from "./RightPanel";
import { getWorkspaceFileSearchText } from "../workspace";

type RightPanelProps = ComponentProps<typeof RightPanel>;

export type WorkspaceProjectContextProps = Omit<
  RightPanelProps,
  "activeFileId" | "commentsEnabled" | "getFileSearchText"
> & {
  activeFileId?: string;
  isLive: boolean;
};

export function WorkspaceProjectContext({
  activeFileId,
  isLive,
  ...rightPanelProps
}: WorkspaceProjectContextProps) {
  return (
    <RightPanel
      {...rightPanelProps}
      activeFileId={activeFileId ?? ""}
      commentsEnabled={isLive}
      getFileSearchText={getWorkspaceFileSearchText}
    />
  );
}
