import { useCallback, type RefObject } from "react";
import type { DocumentWorkbenchProps } from "./DocumentWorkbench";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import type { CenterPopover, TopPopover } from "../uiTypes";
import type {
  FileViewMode,
  ReadingWidth,
} from "../workspaceStorage";

type ValueUpdater<T> = T | ((currentValue: T) => T);

type SetUiValue<T> = (nextValue: ValueUpdater<T>) => void;

type DocumentWorkbenchController = Pick<
  DocumentWorkbenchProps,
  | "onFormat"
  | "onSetReadingWidth"
  | "onSetViewMode"
  | "onToggleLineNumbers"
  | "onToggleLineWrapping"
  | "onToggleSyncScrolling"
  | "onToggleViewOptions"
>;

type UseDocumentWorkbenchControllerOptions = {
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onSetActiveFileLineNumbers: (isEnabled: boolean) => void;
  onSetActiveFileLineWrapping: (isEnabled: boolean) => void;
  onSetActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetActiveFileViewMode: (viewMode: FileViewMode) => void;
  onSetSyncScrolling: (isEnabled: boolean) => void;
  setCenterPopover: SetUiValue<CenterPopover>;
  setTopPopover: SetUiValue<TopPopover>;
};

export function useDocumentWorkbenchController({
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
}: UseDocumentWorkbenchControllerOptions): DocumentWorkbenchController {
  const closeCenterPopover = useCallback(() => {
    setCenterPopover(null);
  }, [setCenterPopover]);

  const closeFloatingDocumentChrome = useCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
  }, [setCenterPopover, setTopPopover]);

  const onFormat = useCallback(
    (command: MarkdownFormatCommand) => {
      if (activeViewMode === "preview") {
        return;
      }

      closeFloatingDocumentChrome();
      editorRef.current?.format(command);
    },
    [activeViewMode, closeFloatingDocumentChrome, editorRef],
  );

  const onSetReadingWidth = useCallback(
    (nextReadingWidth: ReadingWidth) => {
      onSetActiveFileReadingWidth(nextReadingWidth);
      closeCenterPopover();
    },
    [closeCenterPopover, onSetActiveFileReadingWidth],
  );

  const onSetViewMode = useCallback(
    (nextViewMode: FileViewMode) => {
      onSetActiveFileViewMode(nextViewMode);
      closeCenterPopover();
    },
    [closeCenterPopover, onSetActiveFileViewMode],
  );

  const onToggleLineNumbers = useCallback(() => {
    onSetActiveFileLineNumbers(!activeLineNumbers);
    closeCenterPopover();
  }, [activeLineNumbers, closeCenterPopover, onSetActiveFileLineNumbers]);

  const onToggleLineWrapping = useCallback(() => {
    onSetActiveFileLineWrapping(!activeLineWrapping);
    closeCenterPopover();
  }, [activeLineWrapping, closeCenterPopover, onSetActiveFileLineWrapping]);

  const onToggleSyncScrolling = useCallback(() => {
    onSetSyncScrolling(!activeSyncScrolling);
    closeCenterPopover();
  }, [activeSyncScrolling, closeCenterPopover, onSetSyncScrolling]);

  const onToggleViewOptions = useCallback(() => {
    setCenterPopover((current) => (current === "view" ? null : "view"));
    setTopPopover(null);
  }, [setCenterPopover, setTopPopover]);

  return {
    onFormat,
    onSetReadingWidth,
    onSetViewMode,
    onToggleLineNumbers,
    onToggleLineWrapping,
    onToggleSyncScrolling,
    onToggleViewOptions,
  };
}
