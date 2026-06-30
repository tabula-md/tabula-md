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
  FileComment,
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
  activeOpenComments: FileComment[];
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  focusedCommentId: string | null;
  isLive: boolean;
  searchOpen: boolean;
  selectedCharacterCount: number;
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  shareOpen: boolean;
  splitDividerDragging: boolean;
  onOpenCommentsPanel: (commentId?: string) => void;
  onSetActiveFileLineNumbers: (isEnabled: boolean) => void;
  onSetActiveFileLineWrapping: (isEnabled: boolean) => void;
  onSetActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetActiveFileViewMode: (viewMode: FileViewMode) => void;
  setCenterPopover: SetUiValue<CenterPopover>;
  setSearchOpen: SetUiValue<boolean>;
  setTopPopover: SetUiValue<TopPopover>;
};

export function useDocumentSurfaceRuntime({
  activeDocument,
  activeLineNumbers,
  activeLineWrapping,
  activeOpenComments,
  activeViewMode,
  editorRef,
  focusedCommentId,
  isLive,
  searchOpen,
  selectedCharacterCount,
  selectionActionPosition,
  shareOpen,
  splitDividerDragging,
  onOpenCommentsPanel,
  onSetActiveFileLineNumbers,
  onSetActiveFileLineWrapping,
  onSetActiveFileReadingWidth,
  onSetActiveFileViewMode,
  setCenterPopover,
  setSearchOpen,
  setTopPopover,
}: UseDocumentSurfaceRuntimeOptions) {
  const documentSurface = buildDocumentSurface({
    document: activeDocument,
    hasSelectionActionPosition: Boolean(selectionActionPosition),
    isLive,
    openCommentCount: activeOpenComments.length,
    searchOpen,
    selectedCharacterCount,
    shareOpen,
    splitDividerDragging,
  });
  const documentWorkbenchRuntime = useDocumentWorkbenchRuntime({
    activeLineNumbers,
    activeLineWrapping,
    activeOpenComments,
    activeViewMode,
    editorRef,
    focusedCommentId,
    onOpenCommentsPanel,
    onSetActiveFileLineNumbers,
    onSetActiveFileLineWrapping,
    onSetActiveFileReadingWidth,
    onSetActiveFileViewMode,
    setCenterPopover,
    setSearchOpen,
    setTopPopover,
  });

  return {
    documentSurface,
    documentWorkbenchRuntime,
  };
}
