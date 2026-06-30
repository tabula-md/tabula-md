import * as Y from "yjs";

import {
  applyTextPatches,
  diffTextPatch,
  getTextPatchesForChange,
  type TextChange,
  type TextPatch,
} from "@tabula-md/tabula";

export const COLLAB_REMOTE_ORIGIN = "tabula-room-remote";

export type CollabTextDocument = {
  doc: Y.Doc;
  text: Y.Text;
};

export type TextChangeResult = {
  text: string;
  change: TextChange;
};

export const createCollabTextDocument = (initialText?: string): CollabTextDocument => {
  const doc = new Y.Doc();
  const text = doc.getText("markdown");

  if (initialText) {
    doc.transact(() => {
      text.insert(0, initialText);
    }, "initial");
  }

  return { doc, text };
};

export const applyTextPatchesToYText = ({
  doc,
  text,
  patches,
  origin = "local",
}: CollabTextDocument & {
  patches: readonly TextPatch[];
  origin?: unknown;
}) => {
  const orderedPatches = [...patches].sort((first, second) => second.from - first.from || second.to - first.to);
  doc.transact(() => {
    orderedPatches.forEach((patch) => {
      if (patch.to > patch.from) {
        text.delete(patch.from, patch.to - patch.from);
      }
      if (patch.insert) {
        text.insert(patch.from, patch.insert);
      }
    });
  }, origin);
};

export const getTextChangeResult = (text: Y.Text, previousText: string): TextChangeResult | null => {
  const nextText = text.toString();
  if (previousText === nextText) {
    return null;
  }

  return {
    text: nextText,
    change: {
      patches: getTextPatchesForChange(previousText, nextText),
    },
  };
};

export const applyRemoteUpdateToYText = ({
  doc,
  text,
  update,
}: CollabTextDocument & {
  update: Uint8Array;
}) => {
  const previousText = text.toString();
  Y.applyUpdate(doc, update, COLLAB_REMOTE_ORIGIN);
  return getTextChangeResult(text, previousText);
};

export const applyLocalTextToYText = ({
  doc,
  text,
  nextText,
  patches,
}: CollabTextDocument & {
  nextText: string;
  patches?: readonly TextPatch[];
}) => {
  const currentText = text.toString();
  if (currentText === nextText) {
    return;
  }

  const nextPatches = getTextPatchesForChange(currentText, nextText, patches);
  const patchedText = applyTextPatches(currentText, nextPatches);
  if (patchedText === nextText) {
    applyTextPatchesToYText({ doc, text, patches: nextPatches });
    return;
  }

  applyTextPatchesToYText({ doc, text, patches: [diffTextPatch(currentText, nextText)] });
};
