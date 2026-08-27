import type { ComponentProps } from "react";
import { SidePanelFrame } from "../workspace/components/SidePanelFrame";
import type { WorkspaceShellSize } from "../workspace/workspaceShellLayout";
import { LeftPanel } from "./LeftPanel";

type LeftPanelProps = ComponentProps<typeof LeftPanel>;

export type WorkspaceLeftPanelProps = Omit<
  LeftPanelProps,
  "activeFileId" | "isLiveWorkspace" | "overlayMode" | "panelRef"
> & {
  activeFileId?: string;
  isLive: boolean;
  onClose: () => void;
  shellSize: WorkspaceShellSize;
};

export function WorkspaceLeftPanel({
  activeFileId,
  isLive,
  onClose,
  shellSize,
  ...leftPanelProps
}: WorkspaceLeftPanelProps) {
  return (
    <SidePanelFrame
      isOpen={leftPanelProps.isOpen}
      language={leftPanelProps.language}
      onClose={onClose}
      shellSize={shellSize}
      side="left"
    >
      {({ overlayMode, panelRef }) => (
        <LeftPanel
          {...leftPanelProps}
          activeFileId={activeFileId ?? ""}
          isLiveWorkspace={isLive}
          overlayMode={overlayMode}
          panelRef={panelRef}
        />
      )}
    </SidePanelFrame>
  );
}
