import {
  startTransition,
  type Dispatch,
  useLayoutEffect,
  useRef,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  getPreviewWindow,
  type PreviewBlockIndex,
} from "@tabula-md/tabula";
import {
  getPreviewScrollSurface,
  getPreviewViewport,
  type PreviewViewport,
} from "./usePreviewFollowController";

export const PREVIEW_VIRTUAL_OVERSCAN = 1_200;

type PreviewVirtualizationControllerOptions = {
  clearHoverLineAnnotation: () => void;
  documentRef: RefObject<HTMLDivElement | null>;
  handlePreviewScrollEvent: (scrollSurface: HTMLElement) => void;
  renderableBody: string;
  setPreviewViewport: Dispatch<SetStateAction<PreviewViewport>>;
  shouldVirtualizePreview: boolean;
  virtualPreviewBlockIndex: PreviewBlockIndex | null;
};

export const usePreviewVirtualizationController = ({
  clearHoverLineAnnotation,
  documentRef,
  handlePreviewScrollEvent,
  renderableBody,
  setPreviewViewport,
  shouldVirtualizePreview,
  virtualPreviewBlockIndex,
}: PreviewVirtualizationControllerOptions) => {
  const previewViewportBlockIndexRef = useRef<PreviewBlockIndex | null>(null);

  useLayoutEffect(() => {
    previewViewportBlockIndexRef.current = virtualPreviewBlockIndex;
  });

  useLayoutEffect(() => {
    if (!shouldVirtualizePreview) {
      return undefined;
    }

    const scrollSurface = getPreviewScrollSurface(documentRef.current);
    if (!scrollSurface) {
      setPreviewViewport(getPreviewViewport(documentRef.current));
      return undefined;
    }

    let frameId: number | null = null;
    const updateViewport = () => {
      frameId = null;
      const nextViewport = getPreviewViewport(documentRef.current);
      startTransition(() => {
        setPreviewViewport((currentViewport) => {
          if (
            currentViewport.scrollTop === nextViewport.scrollTop &&
            currentViewport.viewportHeight === nextViewport.viewportHeight
          ) {
            return currentViewport;
          }

          const blockIndex = previewViewportBlockIndexRef.current;
          if (
            blockIndex &&
            currentViewport.viewportHeight === nextViewport.viewportHeight
          ) {
            const currentWindow = getPreviewWindow(
              blockIndex,
              currentViewport.scrollTop,
              currentViewport.viewportHeight,
              PREVIEW_VIRTUAL_OVERSCAN,
            );
            const nextWindow = getPreviewWindow(
              blockIndex,
              nextViewport.scrollTop,
              nextViewport.viewportHeight,
              PREVIEW_VIRTUAL_OVERSCAN,
            );
            if (
              currentWindow.startIndex === nextWindow.startIndex &&
              currentWindow.blocks.length === nextWindow.blocks.length
            ) {
              return currentViewport;
            }
          }

          return nextViewport;
        });
      });
    };
    const scheduleViewportUpdate = () => {
      clearHoverLineAnnotation();
      handlePreviewScrollEvent(scrollSurface);
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    scrollSurface.addEventListener("scroll", scheduleViewportUpdate, {
      passive: true,
    });
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleViewportUpdate);
    resizeObserver?.observe(scrollSurface);

    return () => {
      scrollSurface.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    clearHoverLineAnnotation,
    documentRef,
    handlePreviewScrollEvent,
    renderableBody,
    setPreviewViewport,
    shouldVirtualizePreview,
  ]);
};
