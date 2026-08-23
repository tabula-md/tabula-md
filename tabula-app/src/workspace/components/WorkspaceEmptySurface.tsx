import type {
  DragEventHandler,
  RefObject,
} from "react";
import { EmptyFileState } from "./EmptyFileState";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { ShortcutPlatform } from "../keyboardShortcuts";

export type WorkspaceEmptySurfaceProps = {
  dropActive: boolean;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  workspaceRef: RefObject<HTMLElement | null>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  workspaceMode: "connected" | "copy";
};

export function WorkspaceEmptySurface({
  dropActive,
  language,
  shortcutPlatform,
  workspaceRef,
  onDragLeave,
  onDragOver,
  onDrop,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  workspaceMode,
}: WorkspaceEmptySurfaceProps) {
  return (
    <section
      className={`workspace empty-workspace ${dropActive ? "drop-active" : ""}`}
      ref={workspaceRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <EmptyFileState
        language={language}
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onOpenWorkspace={onOpenWorkspace}
        workspaceMode={workspaceMode}
        shortcutPlatform={shortcutPlatform}
      />
    </section>
  );
}
