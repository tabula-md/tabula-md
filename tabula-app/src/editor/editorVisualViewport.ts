import {
  type StateEffect,
  type TransactionSpec,
} from "@codemirror/state";
import {
  EditorView,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";

export const EDITOR_VISUAL_CURSOR_SAFE_MARGIN = 48;

export type EditorVisualViewportAnchor = {
  position: number;
  top: number;
};

type EditorVisualViewportState = {
  anchor: EditorVisualViewportAnchor | null;
  anchorRequest: number;
  pendingMeasure: boolean;
  programmaticScrollTarget: number | null;
  scrollRevision: number;
};

const viewportStates = new WeakMap<EditorView, EditorVisualViewportState>();

const getViewportState = (view: EditorView) => {
  const existing = viewportStates.get(view);
  if (existing) return existing;
  const created = {
    anchor: null,
    anchorRequest: 0,
    pendingMeasure: false,
    programmaticScrollTarget: null,
    scrollRevision: 0,
  };
  viewportStates.set(view, created);
  return created;
};

const readCursorBounds = (view: EditorView, position: number) => {
  const rendered = view.coordsAtPos(position);
  if (rendered) {
    return {
      bottom: rendered.bottom,
      top: rendered.top,
    };
  }
  const line = view.lineBlockAt(position);
  const top = view.documentTop + line.top;
  return {
    bottom: top + line.height,
    top,
  };
};

const readCursorAnchor = (
  view: EditorView,
  position = view.state.selection.main.head,
): EditorVisualViewportAnchor | null => {
  if (view.state.selection.main.head !== position) return null;
  return {
    position,
    top: readCursorBounds(view, position).top,
  };
};

const getScrollOwner = (view: EditorView) =>
  view.dom.closest<HTMLElement>(".workspace") ?? view.scrollDOM;

export const classifyEditorVisualScroll = (
  scrollTop: number,
  programmaticTarget: number | null,
  tolerance = 0.5,
) => programmaticTarget !== null &&
  Math.abs(scrollTop - programmaticTarget) <= tolerance
  ? "programmatic" as const
  : "user" as const;

const applyEditorVisualScroll = (
  view: EditorView,
  offset: number,
) => {
  const viewport = getViewportState(view);
  const scrollOwner = getScrollOwner(view);
  const previousTop = scrollOwner.scrollTop;
  viewport.programmaticScrollTarget = previousTop + offset;
  scrollOwner.scrollTop = viewport.programmaticScrollTarget;
  viewport.programmaticScrollTarget = scrollOwner.scrollTop;
  const requestTarget = viewport.programmaticScrollTarget;
  requestAnimationFrame(() => {
    if (viewport.programmaticScrollTarget === requestTarget) {
      viewport.programmaticScrollTarget = null;
    }
  });
  return Math.abs(scrollOwner.scrollTop - previousTop) > 0.5;
};

export const getEditorVisualScrollCorrection = (
  anchor: EditorVisualViewportAnchor | null,
  current: EditorVisualViewportAnchor | null,
) => anchor === null || current === null || anchor.position !== current.position
  ? null
  : current.top - anchor.top;

export const getEditorVisualVisibilityCorrection = (
  cursorTop: number,
  cursorBottom: number,
  viewportTop: number,
  viewportBottom: number,
  margin = EDITOR_VISUAL_CURSOR_SAFE_MARGIN,
) => {
  const safeTop = viewportTop + margin;
  const safeBottom = viewportBottom - margin;
  if (cursorTop < safeTop) return cursorTop - safeTop;
  if (cursorBottom > safeBottom) return cursorBottom - safeBottom;
  return 0;
};

export const rememberEditorVisualViewportAnchor = (view: EditorView) => {
  const viewport = getViewportState(view);
  const position = view.state.selection.main.head;
  const request = ++viewport.anchorRequest;
  const revision = viewport.scrollRevision;
  view.requestMeasure({
    read: () => ({
      anchor: readCursorAnchor(view, position),
      request,
      revision,
    }),
    write: ({ anchor, request: measuredRequest, revision: measuredRevision }) => {
      if (
        anchor &&
        measuredRequest === viewport.anchorRequest &&
        measuredRevision === viewport.scrollRevision &&
        view.state.selection.main.head === anchor.position
      ) {
        viewport.anchor = anchor;
      }
    },
  });
};

export const requestEditorVisualCursorVisibility = (
  view: EditorView,
  position = view.state.selection.main.head,
) => {
  const viewportState = getViewportState(view);
  const revision = viewportState.scrollRevision;
  view.requestMeasure({
    read: () => {
      if (view.state.selection.main.head !== position) return null;
      const cursor = readCursorBounds(view, position);
      const viewport = getScrollOwner(view).getBoundingClientRect();
      return {
        cursor,
        offset: getEditorVisualVisibilityCorrection(
          cursor.top,
          cursor.bottom,
          viewport.top,
          viewport.bottom,
        ),
        revision,
      };
    },
    write: (measurement) => {
      if (
        measurement === null ||
        measurement.revision !== viewportState.scrollRevision ||
        view.state.selection.main.head !== position
      ) return;
      if (Math.abs(measurement.offset) <= 0.5) {
        viewportState.anchor = {
          position,
          top: measurement.cursor.top,
        };
        return;
      }
      if (applyEditorVisualScroll(view, measurement.offset)) {
        rememberEditorVisualViewportAnchor(view);
      } else {
        viewportState.anchor = {
          position,
          top: measurement.cursor.top,
        };
      }
    },
  });
};

export const requestEditorVisualGeometryMeasure = (view: EditorView) => {
  const viewport = getViewportState(view);
  if (viewport.pendingMeasure) return;
  viewport.pendingMeasure = true;
  const revision = viewport.scrollRevision;
  view.requestMeasure({
    read: () => {
      const current = readCursorAnchor(view);
      return {
        current,
        offset: getEditorVisualScrollCorrection(
          viewport.anchor,
          current,
        ),
        revision,
      };
    },
    write: ({ current, offset, revision: measuredRevision }) => {
      viewport.pendingMeasure = false;
      if (
        !current ||
        measuredRevision !== viewport.scrollRevision ||
        view.state.selection.main.head !== current.position
      ) return;
      if (offset !== null && Math.abs(offset) > 0.5) {
        if (applyEditorVisualScroll(view, offset)) {
          rememberEditorVisualViewportAnchor(view);
        } else {
          viewport.anchor = current;
        }
      } else {
        viewport.anchor = current;
      }
      requestEditorVisualCursorVisibility(view, current.position);
    },
  });
};

export const dispatchEditorVisualCursor = (
  view: EditorView,
  selection: TransactionSpec["selection"],
  effects: readonly StateEffect<unknown>[] = [],
  focus = false,
) => {
  view.dispatch({
    effects,
    selection,
  });
  if (focus) view.focus();
};

export const editorVisualViewportPlugin = ViewPlugin.fromClass(class {
  private readonly scrollOwner: HTMLElement;
  private readonly handleScroll: () => void;

  constructor(readonly view: EditorView) {
    this.scrollOwner = getScrollOwner(view);
    this.handleScroll = () => {
      const viewport = getViewportState(this.view);
      const kind = classifyEditorVisualScroll(
        this.scrollOwner.scrollTop,
        viewport.programmaticScrollTarget,
      );
      if (kind === "programmatic") {
        viewport.programmaticScrollTarget = null;
        return;
      }
      viewport.programmaticScrollTarget = null;
      viewport.scrollRevision += 1;
      viewport.anchor = null;
      rememberEditorVisualViewportAnchor(this.view);
    };
    this.scrollOwner.addEventListener("scroll", this.handleScroll, {
      passive: true,
    });
    rememberEditorVisualViewportAnchor(view);
  }

  update(update: ViewUpdate) {
    if (update.selectionSet) {
      requestEditorVisualCursorVisibility(this.view);
    }
  }

  destroy() {
    this.scrollOwner.removeEventListener("scroll", this.handleScroll);
    viewportStates.delete(this.view);
  }
});
