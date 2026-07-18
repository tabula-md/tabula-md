import { applyTextPatches, type TextPatch } from "../textPatches";

export type PendingDocumentBufferCommit = {
  fileId: string;
  text?: string;
};

export type DocumentBufferTextReader = () => string | null | undefined;

export type DocumentBufferTextState = {
  committedText: string;
  fileId: string;
  pending: boolean;
  pendingTextAvailable: boolean;
  visibleText: string;
};

export type EditorDocumentRuntimeSnapshot = {
  committedText: string;
  dirty: boolean;
  fileId: string;
  pendingCommit: boolean;
  pendingTextAvailable: boolean;
  revision: number;
  text: string;
};

export type EditorDocumentRuntimeFlushResult = {
  fileId: string;
  revision: number;
  text: string;
};

export type EditorDocumentRuntime = {
  applyPatch(patches: readonly TextPatch[]): boolean;
  flush(): EditorDocumentRuntimeFlushResult | null;
  getSnapshot(): EditorDocumentRuntimeSnapshot;
  getText(): string;
  getVisibleText(): string;
  replaceAll(text: string): void;
  setPendingCommit(input: { readText?: DocumentBufferTextReader; text?: string }): void;
  syncCommitted(input: { fileId: string; revision?: number; text: string }): void;
};

export const createPendingDocumentBufferCommit = (
  fileId: string,
  text?: string,
): PendingDocumentBufferCommit => (
  text === undefined
    ? { fileId }
    : { fileId, text }
);

export const resolvePendingDocumentBufferText = (
  pendingCommit: PendingDocumentBufferCommit,
  fallbackText: string,
  readPendingText?: DocumentBufferTextReader,
) => {
  if (typeof pendingCommit.text === "string") {
    return pendingCommit.text;
  }

  const readText = readPendingText?.();
  return typeof readText === "string" ? readText : fallbackText;
};

export const getDocumentBufferVisibleText = ({
  committedText,
  fileId,
  pendingCommit,
  readPendingText,
}: {
  committedText: string;
  fileId: string;
  pendingCommit?: PendingDocumentBufferCommit | null;
  readPendingText?: DocumentBufferTextReader;
}) => {
  if (pendingCommit?.fileId !== fileId) {
    return committedText;
  }

  return resolvePendingDocumentBufferText(pendingCommit, committedText, readPendingText);
};

export const createDocumentBufferTextState = ({
  committedText,
  fileId,
  pendingCommit,
  readPendingText,
}: {
  committedText: string;
  fileId: string;
  pendingCommit?: PendingDocumentBufferCommit | null;
  readPendingText?: DocumentBufferTextReader;
}): DocumentBufferTextState => {
  const pending = pendingCommit?.fileId === fileId;
  const visibleText = pending
    ? resolvePendingDocumentBufferText(pendingCommit, committedText, readPendingText)
    : committedText;

  return {
    committedText,
    fileId,
    pending,
    pendingTextAvailable: pending && typeof pendingCommit.text === "string",
    visibleText,
  };
};

export const shouldCancelPendingDocumentBufferCommit = (
  pendingCommit: PendingDocumentBufferCommit | null,
  activeDocument: { id: string; text: string } | undefined,
) =>
  Boolean(
    activeDocument &&
      pendingCommit &&
      pendingCommit.fileId === activeDocument.id &&
      pendingCommit.text !== undefined &&
      activeDocument.text !== pendingCommit.text,
  );

export const createEditorDocumentRuntime = ({
  fileId: initialFileId,
  revision: initialRevision = 0,
  text: initialText,
}: {
  fileId: string;
  revision?: number;
  text: string;
}): EditorDocumentRuntime => {
  let committedText = initialText;
  let dirty = false;
  let fileId = initialFileId;
  let pendingCommit = false;
  let pendingReader: DocumentBufferTextReader | undefined;
  let pendingTextAvailable = false;
  let revision = initialRevision;
  let text = initialText;

  const replaceAll = (nextText: string) => {
    pendingReader = undefined;
    pendingCommit = true;
    pendingTextAvailable = true;
    if (nextText !== text) {
      text = nextText;
      revision += 1;
    }
    dirty = text !== committedText;
  };

  const getSnapshot = (): EditorDocumentRuntimeSnapshot => ({
    committedText,
    dirty,
    fileId,
    pendingCommit,
    pendingTextAvailable,
    revision,
    text,
  });

  const getVisibleText = () => {
    if (pendingReader) {
      const readText = pendingReader();
      if (typeof readText === "string") {
        return readText;
      }
    }

    return text;
  };

  return {
    applyPatch(patches) {
      const nextText = applyTextPatches(text, patches);
      if (typeof nextText !== "string") {
        return false;
      }

      replaceAll(nextText);
      return true;
    },

    flush() {
      if (pendingReader) {
        const readText = pendingReader();
        if (typeof readText === "string" && readText !== text) {
          text = readText;
          if (!dirty) {
            revision += 1;
          }
        }
      }

      pendingReader = undefined;
      pendingCommit = false;
      pendingTextAvailable = true;

      if (!dirty && text === committedText) {
        return null;
      }

      committedText = text;
      dirty = false;
      return { fileId, revision, text };
    },

    getSnapshot,
    getText: () => text,
    getVisibleText,
    replaceAll,

    setPendingCommit(input) {
      pendingCommit = true;
      pendingReader = input.readText;
      pendingTextAvailable = typeof input.text === "string";
      if (typeof input.text === "string") {
        replaceAll(input.text);
        return;
      }

      dirty = true;
      revision += 1;
    },

    syncCommitted(input) {
      fileId = input.fileId;
      committedText = input.text;
      text = input.text;
      dirty = false;
      pendingCommit = false;
      pendingReader = undefined;
      pendingTextAvailable = true;
      revision = input.revision ?? revision;
    },
  };
};
