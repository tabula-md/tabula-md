import type { RefObject } from "react";
import {
  buildDocumentSurface,
  type ActiveDocumentRuntime,
} from "@tabula-md/tabula";
import type {
  MarkdownEditorHandle,
  MarkdownSelectionActionPosition,
} from "./markdownEditorTypes";
import type { CenterPopover, TopPopover } from "../uiTypes";
import type {
  FileViewMode,
  ReadingWidth,
} from "../workspaceStorage";
import { useDocumentWorkbenchController } from "./useDocumentWorkbenchController";

type ValueUpdater<T> = T | ((currentValue: T) => T);

type SetUiValue<T> = (nextValue: ValueUpdater<T>) => void;

type UseDocumentSurfaceControllerOptions = {
  activeDocument: ActiveDocumentRuntime;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  selectedCharacterCount: number;
  searchOpen: boolean;
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

export function useDocumentSurfaceController({
  activeDocument,
  activeLineNumbers,
  activeLineWrapping,
  activeSyncScrolling,
  activeViewMode,
  editorRef,
  selectedCharacterCount,
  searchOpen,
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
}: UseDocumentSurfaceControllerOptions) {
  const documentSurface = buildDocumentSurface({
    document: activeDocument,
    hasSelectionActionPosition: Boolean(selectionActionPosition),
    searchOpen,
    selectedCharacterCount,
    shareOpen,
    splitDividerDragging,
  });
  const documentWorkbenchController = useDocumentWorkbenchController({
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
    documentWorkbenchController,
  };
}
