export type TextPatch = {
  from: number;
  to: number;
  insert: string;
};

export type TextChange = {
  docLength?: number;
  lineCount?: number;
  patches: TextPatch[];
};

const comparePatchesDescending = (first: TextPatch, second: TextPatch) =>
  second.from - first.from || second.to - first.to;

const comparePatchesAscending = (first: TextPatch, second: TextPatch) =>
  first.from - second.from || first.to - second.to;

export const diffTextPatch = (oldText: string, nextText: string): TextPatch => {
  let start = 0;
  while (
    start < oldText.length &&
    start < nextText.length &&
    oldText[start] === nextText[start]
  ) {
    start += 1;
  }

  let oldEnd = oldText.length;
  let nextEnd = nextText.length;
  while (
    oldEnd > start &&
    nextEnd > start &&
    oldText[oldEnd - 1] === nextText[nextEnd - 1]
  ) {
    oldEnd -= 1;
    nextEnd -= 1;
  }

  return {
    from: start,
    to: oldEnd,
    insert: nextText.slice(start, nextEnd),
  };
};

export const normalizeTextPatches = (patches: readonly TextPatch[]) =>
  [...patches].sort(comparePatchesAscending);

export const areTextPatchesApplicable = (text: string, patches: readonly TextPatch[]) => {
  let previousTo = 0;

  for (const patch of normalizeTextPatches(patches)) {
    if (
      !Number.isInteger(patch.from) ||
      !Number.isInteger(patch.to) ||
      patch.from < 0 ||
      patch.to < patch.from ||
      patch.to > text.length ||
      patch.from < previousTo
    ) {
      return false;
    }

    previousTo = patch.to;
  }

  return true;
};

export const applyTextPatches = (text: string, patches: readonly TextPatch[]) => {
  if (!areTextPatchesApplicable(text, patches)) {
    return null;
  }

  return [...patches]
    .sort(comparePatchesDescending)
    .reduce(
      (currentText, patch) =>
        `${currentText.slice(0, patch.from)}${patch.insert}${currentText.slice(patch.to)}`,
      text,
    );
};

export const getTextPatchesForChange = (
  oldText: string,
  nextText: string,
  preferredPatches?: readonly TextPatch[],
) => {
  if (preferredPatches?.length) {
    const patchedText = applyTextPatches(oldText, preferredPatches);
    if (patchedText === nextText) {
      return normalizeTextPatches(preferredPatches);
    }
  }

  const fallbackPatch = diffTextPatch(oldText, nextText);
  return fallbackPatch.from === fallbackPatch.to && fallbackPatch.insert === "" ? [] : [fallbackPatch];
};
