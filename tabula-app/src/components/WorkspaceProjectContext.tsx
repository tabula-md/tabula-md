import type { ComponentProps } from "react";
import { RightPanel } from "./RightPanel";
import { getWorkspaceFileSearchText } from "../workspace";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type RightPanelProps = ComponentProps<typeof RightPanel>;

export type WorkspaceProjectContextProps = Omit<
  RightPanelProps,
  "activeFileId" | "getFileSearchText" | "isLiveWorkspace"
> & {
  activeFileId?: string;
  isLive: boolean;
};

export function WorkspaceProjectContext({
  activeFileId,
  isLive,
  ...rightPanelProps
}: WorkspaceProjectContextProps) {
  const copy = getWorkspaceInterfaceCopy(rightPanelProps.language).projectContext;
  return (
    <>
      {rightPanelProps.isOpen && (
        <button
          className="right-panel-backdrop"
          type="button"
          aria-label={copy.dismiss}
          onClick={rightPanelProps.onClose}
        />
      )}
      <RightPanel
        {...rightPanelProps}
        activeFileId={activeFileId ?? ""}
        isLiveWorkspace={isLive}
        getFileSearchText={getWorkspaceFileSearchText}
      />
    </>
  );
}
