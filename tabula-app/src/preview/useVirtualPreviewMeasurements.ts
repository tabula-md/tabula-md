import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPreviewBlockMeasurements,
  type PreviewBlock,
  type PreviewBlockIndex,
  type PreviewBlockMeasurements,
} from "@tabula-md/tabula";

type UseVirtualPreviewMeasurementsArgs = {
  onBeforeMeasurementsCommit?: () => void;
  previewBlockIndex: PreviewBlockIndex | null;
};

const getPreviewBlockMeasurementSignature = (block: PreviewBlock) => {
  let hash = 2166136261;
  const text = `${block.kind}:${block.headingLevel ?? 0}:${block.text}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${block.kind}:${block.headingLevel ?? 0}:${hash >>> 0}`;
};

export const useVirtualPreviewMeasurements = ({
  onBeforeMeasurementsCommit,
  previewBlockIndex,
}: UseVirtualPreviewMeasurementsArgs) => {
  const previewBlockMeasurementCacheRef = useRef(new Map<string, number>());
  const pendingPreviewBlockMeasurementsRef = useRef<PreviewBlockMeasurements>({});
  const pendingPreviewBlockMeasurementFrameRef = useRef<number | null>(null);
  const [previewBlockMeasurements, setPreviewBlockMeasurements] = useState<PreviewBlockMeasurements>({});
  const effectivePreviewBlockMeasurements = useMemo(() => {
    if (!previewBlockIndex) {
      return previewBlockMeasurements;
    }

    let nextMeasurements: Record<string, number> | null = null;
    for (const block of previewBlockIndex.blocks) {
      if (typeof previewBlockMeasurements[block.id] === "number") {
        continue;
      }

      const cachedHeight = previewBlockMeasurementCacheRef.current.get(getPreviewBlockMeasurementSignature(block));
      if (cachedHeight === undefined) {
        continue;
      }

      nextMeasurements ??= { ...previewBlockMeasurements };
      nextMeasurements[block.id] = cachedHeight;
    }

    return nextMeasurements ?? previewBlockMeasurements;
  }, [previewBlockIndex, previewBlockMeasurements]);
  const virtualPreviewBlockIndex = useMemo(
    () => (previewBlockIndex ? applyPreviewBlockMeasurements(previewBlockIndex, effectivePreviewBlockMeasurements) : null),
    [effectivePreviewBlockMeasurements, previewBlockIndex],
  );

  const handlePreviewBlockHeightChange = useCallback((block: PreviewBlock, height: number) => {
    const measuredHeight = Math.max(0, Math.ceil(height));
    if (!Number.isFinite(measuredHeight)) {
      return;
    }

    previewBlockMeasurementCacheRef.current.set(getPreviewBlockMeasurementSignature(block), measuredHeight);
    pendingPreviewBlockMeasurementsRef.current = {
      ...pendingPreviewBlockMeasurementsRef.current,
      [block.id]: measuredHeight,
    };
    if (pendingPreviewBlockMeasurementFrameRef.current !== null) {
      return;
    }

    pendingPreviewBlockMeasurementFrameRef.current = window.requestAnimationFrame(() => {
      pendingPreviewBlockMeasurementFrameRef.current = null;
      onBeforeMeasurementsCommit?.();
      const pendingMeasurements = pendingPreviewBlockMeasurementsRef.current;
      pendingPreviewBlockMeasurementsRef.current = {};
      startTransition(() => {
        setPreviewBlockMeasurements((currentMeasurements) => {
          let nextMeasurements: Record<string, number> | null = null;
          for (const [pendingBlockId, pendingHeight] of Object.entries(pendingMeasurements)) {
            const currentHeight = currentMeasurements[pendingBlockId];
            if (typeof currentHeight === "number" && Math.abs(currentHeight - pendingHeight) < 1) {
              continue;
            }

            nextMeasurements ??= { ...currentMeasurements };
            nextMeasurements[pendingBlockId] = pendingHeight;
          }

          return nextMeasurements ?? currentMeasurements;
        });
      });
    });
  }, [onBeforeMeasurementsCommit]);

  useEffect(() => () => {
    if (pendingPreviewBlockMeasurementFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingPreviewBlockMeasurementFrameRef.current);
    }
  }, []);

  return {
    handlePreviewBlockHeightChange,
    virtualPreviewBlockIndex,
  };
};
