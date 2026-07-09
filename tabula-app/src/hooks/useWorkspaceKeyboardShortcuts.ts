import { useEffect, type RefObject } from "react";
import type { FileViewMode } from "../workspaceStorage";

type WorkspaceShortcutAction =
  | "newFile"
  | "openFile"
  | "browseFiles"
  | "openHelp"
  | "previousFile"
  | "nextFile"
  | "documentSearch"
  | "editMode"
  | "splitMode"
  | "previewMode";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

type ShortcutTargetState = {
  isEditableTarget: boolean;
  isRenameInput: boolean;
};

type UseWorkspaceKeyboardShortcutsArgs = {
  importInputRef: RefObject<HTMLInputElement | null>;
  addFile: () => void;
  closeFloatingChrome: () => void;
  openFilesPanel: () => void;
  openHelpFile: () => void;
  openDocumentSearch: () => void;
  selectAdjacentFile: (direction: -1 | 1) => void;
  setActiveFileViewMode: (nextViewMode: FileViewMode) => void;
  setCenterPopover: (popover: null) => void;
};

const isShortcutKey = (event: ShortcutEvent, nextKey: string) =>
  event.key.toLowerCase() === nextKey.toLowerCase() || event.code === `Key${nextKey.toUpperCase()}`;

const isShortcutDigit = (event: ShortcutEvent, digit: string) =>
  event.key === digit || event.code === `Digit${digit}`;

export function getWorkspaceShortcutAction(
  event: ShortcutEvent,
  targetState: ShortcutTargetState,
): WorkspaceShortcutAction | null {
  if (targetState.isRenameInput) {
    return null;
  }

  const hasCommandModifier = event.metaKey || event.ctrlKey;
  if (hasCommandModifier && !event.altKey && !event.shiftKey && isShortcutKey(event, "f")) {
    return "documentSearch";
  }

  const hasAppModifier = hasCommandModifier && event.altKey && !event.shiftKey;

  if (hasAppModifier && isShortcutKey(event, "n")) {
    return "newFile";
  }

  if (hasAppModifier && isShortcutKey(event, "o")) {
    return "openFile";
  }

  if (hasAppModifier && isShortcutKey(event, "f")) {
    return "browseFiles";
  }

  if (!targetState.isEditableTarget && !hasCommandModifier && !event.altKey && event.key === "?") {
    return "openHelp";
  }

  if (!hasAppModifier) {
    return null;
  }

  if (event.key === "ArrowLeft") {
    return "previousFile";
  }

  if (event.key === "ArrowRight") {
    return "nextFile";
  }

  if (isShortcutDigit(event, "1")) {
    return "editMode";
  }

  if (isShortcutDigit(event, "2")) {
    return "splitMode";
  }

  if (isShortcutDigit(event, "3")) {
    return "previewMode";
  }

  return null;
}

const getShortcutTargetState = (target: EventTarget | null): ShortcutTargetState => {
  const targetElement = target instanceof HTMLElement ? target : null;
  return {
    isRenameInput: Boolean(targetElement?.classList.contains("tab-rename-input")),
    isEditableTarget: Boolean(
      targetElement &&
        (targetElement.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(targetElement.tagName)),
    ),
  };
};

export function useWorkspaceKeyboardShortcuts({
  importInputRef,
  addFile,
  closeFloatingChrome,
  openFilesPanel,
  openHelpFile,
  openDocumentSearch,
  selectAdjacentFile,
  setActiveFileViewMode,
  setCenterPopover,
}: UseWorkspaceKeyboardShortcutsArgs) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getWorkspaceShortcutAction(event, getShortcutTargetState(event.target));
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (action === "newFile") {
        addFile();
        return;
      }

      if (action === "openFile") {
        closeFloatingChrome();
        importInputRef.current?.click();
        return;
      }

      if (action === "browseFiles") {
        openFilesPanel();
        return;
      }

      if (action === "openHelp") {
        openHelpFile();
        return;
      }

      if (action === "documentSearch") {
        closeFloatingChrome();
        openDocumentSearch();
        return;
      }

      if (action === "previousFile") {
        selectAdjacentFile(-1);
        return;
      }

      if (action === "nextFile") {
        selectAdjacentFile(1);
        return;
      }

      if (action === "editMode") {
        setActiveFileViewMode("edit");
        setCenterPopover(null);
        return;
      }

      if (action === "splitMode") {
        setActiveFileViewMode("split");
        setCenterPopover(null);
        return;
      }

      if (action === "previewMode") {
        setActiveFileViewMode("preview");
        setCenterPopover(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });
}
