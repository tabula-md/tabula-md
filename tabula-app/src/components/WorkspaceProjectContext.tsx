import type { ComponentProps } from "react";
import { RightPanel } from "./RightPanel";
import { getWorkspaceFileSearchText } from "../workspace";

type RightPanelProps = ComponentProps<typeof RightPanel>;

export type WorkspaceProjectContextProps = Omit<
  RightPanelProps,
  "activeFileId" | "commentsEnabled" | "getFileSearchText" | "isLiveWorkspace"
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
    <>
      {rightPanelProps.isOpen && (
        <button
          className="right-panel-backdrop"
          type="button"
          aria-label="Dismiss Project Context"
          onClick={rightPanelProps.onClose}
        />
      )}
      <RightPanel
        {...rightPanelProps}
        activeFileId={activeFileId ?? ""}
        commentsEnabled={isLive}
        isLiveWorkspace={isLive}
        getFileSearchText={getWorkspaceFileSearchText}
      />
    </>
  );
}
