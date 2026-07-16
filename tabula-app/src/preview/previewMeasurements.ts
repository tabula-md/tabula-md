import type { PreviewBlockIndex, PreviewBlockMeasurements } from "@tabula-md/tabula";

export const getElementOuterHeight = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop);
  const marginBottom = Number.parseFloat(style.marginBottom);
  const outerHeight =
    rect.height +
    (Number.isFinite(marginTop) ? marginTop : 0) +
    (Number.isFinite(marginBottom) ? marginBottom : 0);
  return Math.max(0, Math.ceil(outerHeight));
};

type PreviewMeasuredSourceElement = {
  bottom: number;
  element: HTMLElement;
  endLine: number;
  startLine: number;
  top: number;
};

export const getPreviewMeasurementsAreEqual = (
  firstMeasurements: PreviewBlockMeasurements,
  secondMeasurements: PreviewBlockMeasurements,
) => {
  const firstEntries = Object.entries(firstMeasurements);
  const secondEntries = Object.entries(secondMeasurements);
  if (firstEntries.length !== secondEntries.length) {
    return false;
  }

  return firstEntries.every(([key, value]) => secondMeasurements[key] === value);
};

export const getInlinePreviewBlockMeasurements = (
  contentElement: HTMLElement,
  blockIndex: PreviewBlockIndex,
  sourceLineOffset: number,
): PreviewBlockMeasurements => {
  const measuredElements = Array.from(
    contentElement.querySelectorAll<HTMLElement>("[data-preview-line-start], [data-preview-block-start-line]"),
  ).map((element): PreviewMeasuredSourceElement | null => {
    const startLine = Number(element.dataset.previewLineStart ?? element.dataset.previewBlockStartLine);
    const endLine = Number(element.dataset.previewLineEnd ?? element.dataset.previewBlockEndLine);
    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      element,
      endLine: Math.max(startLine, endLine),
      startLine,
      top: rect.top,
    };
  }).filter((element): element is PreviewMeasuredSourceElement => Boolean(element));

  const measurements: Record<string, number> = {};
  for (const block of blockIndex.blocks) {
    if (block.kind === "blank") {
      measurements[block.id] = 0;
      continue;
    }

    const sourceStartLine = block.startLine + sourceLineOffset;
    const sourceEndLine = block.endLine + sourceLineOffset;
    const exactElements = measuredElements.filter(
      (element) => element.startLine === sourceStartLine && element.endLine === sourceEndLine,
    );
    const containedElements = measuredElements.filter(
      (element) => element.startLine >= sourceStartLine && element.endLine <= sourceEndLine,
    );
    const overlappingElements = measuredElements.filter(
      (element) => element.startLine <= sourceEndLine && element.endLine >= sourceStartLine,
    );
    const blockElements =
      exactElements.length > 0
        ? exactElements
        : containedElements.length > 0
          ? containedElements
          : overlappingElements;
    if (blockElements.length === 0) {
      continue;
    }

    measurements[block.id] =
      blockElements.length === 1
        ? getElementOuterHeight(blockElements[0].element)
        : Math.max(
            0,
            Math.ceil(
              Math.max(...blockElements.map((element) => element.bottom)) -
                Math.min(...blockElements.map((element) => element.top)),
            ),
          );
  }

  return measurements;
};
