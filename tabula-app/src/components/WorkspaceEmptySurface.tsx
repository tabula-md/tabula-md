import type {
  DragEventHandler,
  RefObject,
} from "react";
import { EmptyFileState } from "./EmptyFileState";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type { ShortcutPlatform } from "../keyboardShortcuts";

export type WorkspaceEmptySurfaceProps = {
  dropActive: boolean;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  workspaceRef: RefObject<HTMLElement | null>;
  onBrowseFiles: () => void;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  onOpenHelp: () => void;
};

export function WorkspaceEmptySurface({
  dropActive,
  language,
  shortcutPlatform,
  workspaceRef,
  onBrowseFiles,
  onDragLeave,
  onDragOver,
  onDrop,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onOpenHelp,
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
        onBrowseFiles={onBrowseFiles}
        onOpenHelp={onOpenHelp}
        shortcutPlatform={shortcutPlatform}
      />
    </section>
  );
}
