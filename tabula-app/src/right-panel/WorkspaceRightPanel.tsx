import type { ComponentProps } from "react";
import { SidePanelFrame } from "../workspace/components/SidePanelFrame";
import type { WorkspaceShellSize } from "../workspace/workspaceShellLayout";
import { RightPanel } from "./RightPanel";

type RightPanelProps = ComponentProps<typeof RightPanel>;

export type WorkspaceRightPanelProps = Omit<
  RightPanelProps,
  "activeFileId" | "onClose" | "overlayMode" | "panelRef"
> & {
  activeFileId?: string;
  onClose: () => void;
  shellSize: WorkspaceShellSize;
};

export function WorkspaceRightPanel({
  activeFileId,
  onClose,
  shellSize,
  ...rightPanelProps
}: WorkspaceRightPanelProps) {
  return (
    <SidePanelFrame
      isOpen={rightPanelProps.isOpen}
      language={rightPanelProps.language}
      onClose={onClose}
      shellSize={shellSize}
      side="right"
    >
      {({ overlayMode, panelRef }) => (
        <RightPanel
          {...rightPanelProps}
          activeFileId={activeFileId ?? ""}
          overlayMode={overlayMode}
          panelRef={panelRef}
        />
      )}
    </SidePanelFrame>
  );
}
