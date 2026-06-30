import type {
  DragEventHandler,
  RefObject,
} from "react";
import { EmptyFileState } from "./EmptyFileState";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";

export type WorkspaceEmptySurfaceProps = {
  alternateShortcutModifier: string;
  dropActive: boolean;
  language: WorkspaceLanguage;
  primaryShortcutModifier: string;
  workspaceRef: RefObject<HTMLElement | null>;
  onBrowseFiles: () => void;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenHelp: () => void;
};

export function WorkspaceEmptySurface({
  alternateShortcutModifier,
  dropActive,
  language,
  primaryShortcutModifier,
  workspaceRef,
  onBrowseFiles,
  onDragLeave,
  onDragOver,
  onDrop,
  onNewFile,
  onOpenFile,
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
        onBrowseFiles={onBrowseFiles}
        onOpenHelp={onOpenHelp}
        primaryShortcutModifier={primaryShortcutModifier}
        alternateShortcutModifier={alternateShortcutModifier}
      />
    </section>
  );
}
