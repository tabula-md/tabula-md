import type { RefObject } from "react";
import {
  buildDocumentSurface,
  type ActiveDocumentRuntime,
} from "@tabula-md/tabula";
import type {
  MarkdownEditorHandle,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type { CenterPopover, TopPopover } from "../uiTypes";
import type {
  FileViewMode,
  ReadingWidth,
} from "../workspaceStorage";
import { useDocumentWorkbenchRuntime } from "./useDocumentWorkbenchRuntime";

type ValueUpdater<T> = T | ((currentValue: T) => T);

type SetUiValue<T> = (nextValue: ValueUpdater<T>) => void;

type UseDocumentSurfaceRuntimeOptions = {
  activeDocument: ActiveDocumentRuntime;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  selectedCharacterCount: number;
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  shareOpen: boolean;
  splitDividerDragging: boolean;
  onSetActiveFileLineNumbers: (isEnabled: boolean) => void;
  onSetActiveFileLineWrapping: (isEnabled: boolean) => void;
  onSetActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetActiveFileViewMode: (viewMode: FileViewMode) => void;
  onSetSyncScrolling: (isEnabled: boolean) => void;
  setCenterPopover: SetUiValue<CenterPopover>;
  setTopPopover: SetUiValue<TopPopover>;
};

export function useDocumentSurfaceRuntime({
  activeDocument,
  activeLineNumbers,
  activeLineWrapping,
  activeSyncScrolling,
  activeViewMode,
  editorRef,
  selectedCharacterCount,
  selectionActionPosition,
  shareOpen,
  splitDividerDragging,
  onSetActiveFileLineNumbers,
  onSetActiveFileLineWrapping,
  onSetActiveFileReadingWidth,
  onSetActiveFileViewMode,
  onSetSyncScrolling,
  setCenterPopover,
  setTopPopover,
}: UseDocumentSurfaceRuntimeOptions) {
  const documentSurface = buildDocumentSurface({
    document: activeDocument,
    hasSelectionActionPosition: Boolean(selectionActionPosition),
    searchOpen: false,
    selectedCharacterCount,
    shareOpen,
    splitDividerDragging,
  });
  const documentWorkbenchRuntime = useDocumentWorkbenchRuntime({
    activeLineNumbers,
    activeLineWrapping,
    activeSyncScrolling,
    activeViewMode,
    editorRef,
    onSetActiveFileLineNumbers,
    onSetActiveFileLineWrapping,
    onSetActiveFileReadingWidth,
    onSetActiveFileViewMode,
    onSetSyncScrolling,
    setCenterPopover,
    setTopPopover,
  });

  return {
    documentSurface,
    documentWorkbenchRuntime,
  };
}
