import {
  applyTextPatches,
  areTextPatchesApplicable,
  type TextChange,
  type TextPatch,
} from "@tabula-md/tabula";

export type PreviewBodyTextChangeSnapshot = {
  fileId: string;
  previewBody: string;
  previewBodyStartOffset: number;
  previewSourceLineOffset: number;
  text: string;
};

export type PatchedPreviewBodyTextChange = {
  previewBody: string;
  previewBodyStartOffset: number;
  previewSourceLineOffset: number;
  textChange: TextChange;
};

const getTextPatchLengthDelta = (patches: readonly TextPatch[]) =>
  patches.reduce((delta, patch) => delta + patch.insert.length - (patch.to - patch.from), 0);

const shiftTextPatches = (patches: readonly TextPatch[], offset: number): TextPatch[] =>
  patches.map((patch) => ({
    from: patch.from - offset,
    insert: patch.insert,
    to: patch.to - offset,
  }));

export const derivePreviewBodyTextChange = ({
  currentSnapshot,
  previousSnapshot,
  textChange,
}: {
  currentSnapshot: PreviewBodyTextChangeSnapshot;
  previousSnapshot: PreviewBodyTextChangeSnapshot | null;
  textChange?: TextChange | null;
}): TextChange | null => {
  if (!previousSnapshot || !textChange?.patches.length || previousSnapshot.fileId !== currentSnapshot.fileId) {
    return null;
  }

  if (applyTextPatches(previousSnapshot.text, textChange.patches) !== currentSnapshot.text) {
    return null;
  }

  if (previousSnapshot.previewBodyStartOffset !== currentSnapshot.previewBodyStartOffset) {
    return null;
  }

  const bodyStartOffset = previousSnapshot.previewBodyStartOffset;
  const previewBodyPatches: TextPatch[] = [];
  for (const patch of textChange.patches) {
    if (patch.from < bodyStartOffset || patch.to < bodyStartOffset) {
      return null;
    }

    previewBodyPatches.push({
      from: patch.from - bodyStartOffset,
      insert: patch.insert,
      to: patch.to - bodyStartOffset,
    });
  }

  if (applyTextPatches(previousSnapshot.previewBody, previewBodyPatches) !== currentSnapshot.previewBody) {
    return null;
  }

  return {
    ...textChange,
    docLength: currentSnapshot.previewBody.length,
    patches: previewBodyPatches,
  };
};

export const derivePatchedPreviewBodyTextChange = ({
  currentFileId,
  currentText,
  previousSnapshot,
  textChange,
}: {
  currentFileId: string;
  currentText: string;
  previousSnapshot: PreviewBodyTextChangeSnapshot | null;
  textChange?: TextChange | null;
}): PatchedPreviewBodyTextChange | null => {
  if (!previousSnapshot || !textChange?.patches.length || previousSnapshot.fileId !== currentFileId) {
    return null;
  }

  const expectedTextLength = previousSnapshot.text.length + getTextPatchLengthDelta(textChange.patches);
  if (expectedTextLength !== currentText.length || textChange.docLength !== currentText.length) {
    return null;
  }

  if (!areTextPatchesApplicable(previousSnapshot.text, textChange.patches)) {
    return null;
  }

  if (applyTextPatches(previousSnapshot.text, textChange.patches) !== currentText) {
    return null;
  }

  const bodyStartOffset = previousSnapshot.previewBodyStartOffset;
  if (textChange.patches.some((patch) => patch.from < bodyStartOffset || patch.to < bodyStartOffset)) {
    return null;
  }

  const previewBodyPatches = shiftTextPatches(textChange.patches, bodyStartOffset);
  const previewBody = applyTextPatches(previousSnapshot.previewBody, previewBodyPatches);
  if (typeof previewBody !== "string") {
    return null;
  }

  return {
    previewBody,
    previewBodyStartOffset: bodyStartOffset,
    previewSourceLineOffset: previousSnapshot.previewSourceLineOffset,
    textChange: {
      ...textChange,
      docLength: previewBody.length,
      patches: previewBodyPatches,
    },
  };
};
