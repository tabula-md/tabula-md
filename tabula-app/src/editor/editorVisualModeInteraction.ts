import {
  EditorSelection,
  Prec,
  StateEffect,
  type EditorState,
  type StateField,
  type Transaction,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  ViewPlugin,
} from "@codemirror/view";
import {
  findEditorVisualReplacementInRange,
  type EditorVisualBlockRange,
  type EditorVisualReplacement,
} from "./editorVisualModeModel";
import {
  findEditorVisualMappedBlockAt,
  getEditorVisualBlockEntryPosition,
  getEditorVisualPointerPosition,
  readEditorVisualPointerTextPoint,
  readEditorVisualBlockRange,
} from "./editorVisualPositionMapping";
import {
  type EditorVisualBlockStop,
  normalizeEditorVisualNativeMove,
  resolveEditorVisualVerticalMove,
} from "./editorVisualNavigation";
import {
  dispatchEditorVisualCursor,
} from "./editorVisualViewport";
import { revealEditorVisualSelection } from "./editorVisualEffects";

export type EditorVisualInteraction = {
  editing: EditorVisualBlockRange | null;
  stopped: EditorVisualBlockStop | null;
};

export const setEditorVisualInteraction =
  StateEffect.define<Partial<EditorVisualInteraction>>();

const isInteractiveVisualTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest("button, input, a, summary"));

const editSource = (
  view: EditorView,
  block: EditorVisualBlockRange,
  anchor = block.from,
) => {
  dispatchEditorVisualCursor(
    view,
    { anchor },
    [setEditorVisualInteraction.of({ editing: block, stopped: null })],
    true,
  );
};

const moveByVisualLine = (
  view: EditorView,
  forward: boolean,
  replacements: readonly EditorVisualReplacement[],
  interaction: EditorVisualInteraction,
) => {
  const selection = view.state.selection.main;
  const move = resolveEditorVisualVerticalMove(
    view.state,
    selection,
    forward,
    replacements,
    interaction.editing,
    interaction.stopped,
  );
  if (move.kind === "unhandled") return false;
  if (move.kind === "block-entry") {
    editSource(
      view,
      { from: move.block.from, to: move.block.to },
      move.anchor,
    );
  } else if (move.kind === "block-stop") {
    view.dispatch({
      effects: setEditorVisualInteraction.of({
        editing: null,
        stopped: {
          forward: move.forward,
          from: move.block.from,
          goalColumn: move.goalColumn,
          to: move.block.to,
        },
      }),
      selection: { anchor: move.anchor },
    });
    view.focus();
  } else if (move.kind === "logical-line") {
    dispatchEditorVisualCursor(
      view,
      view.state.selection.replaceRange(move.selection),
      [setEditorVisualInteraction.of({ stopped: null })],
    );
  } else {
    const moved = view.moveVertically(selection, forward);
    const nextSelection = normalizeEditorVisualNativeMove(
      view.state,
      selection,
      moved,
      move.adjacentLineNumber,
      forward,
    );
    if (!nextSelection) return false;
    dispatchEditorVisualCursor(
      view,
      view.state.selection.replaceRange(nextSelection),
    );
  }
  return true;
};

const getSourcePositionAtPointer = (
  view: EditorView,
  block: EditorVisualBlockRange,
  container: HTMLElement,
  clientX: number,
  clientY: number,
) => {
  const replacement = findEditorVisualReplacementInRange(
    view.state,
    block.from,
    block.to,
  ) ?? block;
  const rect = container.getBoundingClientRect();
  return getEditorVisualPointerPosition(
    view.state,
    replacement,
    {
      clientX,
      clientY,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    },
    readEditorVisualPointerTextPoint(container, clientX, clientY),
  );
};

type EditorVisualPointerSession = {
  abortController: AbortController;
  anchor: number;
  block: EditorVisualBlockRange;
  dragging: boolean;
  pointerId: number;
  startX: number;
  startY: number;
};

const visualPointerSessions = new WeakMap<
  EditorView,
  EditorVisualPointerSession
>();
const VISUAL_POINTER_DRAG_THRESHOLD = 4;

const getVisualPointerContainer = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>("[data-visual-from][data-visual-to]")
    : null;

const getSourcePositionAtCoords = (
  view: EditorView,
  clientX: number,
  clientY: number,
) => {
  const target = document.elementFromPoint(clientX, clientY);
  const container = getVisualPointerContainer(target);
  const block = readEditorVisualBlockRange(container);
  if (container && block) {
    return getSourcePositionAtPointer(
      view,
      block,
      container,
      clientX,
      clientY,
    );
  }
  const mapped = view.posAtCoords({ x: clientX, y: clientY }, false);
  if (mapped !== null) return mapped;
  const editorRect = view.dom.getBoundingClientRect();
  return clientY < editorRect.top ? 0 : view.state.doc.length;
};

const dispatchEditorVisualSourceSelection = (
  view: EditorView,
  anchor: number,
  head: number,
) => {
  dispatchEditorVisualCursor(
    view,
    EditorSelection.single(anchor, head),
    [
      revealEditorVisualSelection.of(null),
      setEditorVisualInteraction.of({ editing: null, stopped: null }),
    ],
  );
};

const clearEditorVisualPointerSession = (
  view: EditorView,
) => {
  const session = visualPointerSessions.get(view);
  if (!session) return;
  visualPointerSessions.delete(view);
  session.abortController.abort();
  if (view.dom.hasPointerCapture?.(session.pointerId)) {
    view.dom.releasePointerCapture(session.pointerId);
  }
};

const startEditorVisualPointerSelection = (
  view: EditorView,
  event: PointerEvent,
  block: EditorVisualBlockRange,
  container: HTMLElement,
) => {
  clearEditorVisualPointerSession(view);
  const anchor = getSourcePositionAtPointer(
    view,
    block,
    container,
    event.clientX,
    event.clientY,
  );
  event.preventDefault();
  event.stopPropagation();
  view.focus();

  if (event.shiftKey) {
    dispatchEditorVisualSourceSelection(
      view,
      view.state.selection.main.anchor,
      anchor,
    );
    return;
  }

  const abortController = new AbortController();
  const session: EditorVisualPointerSession = {
    abortController,
    anchor,
    block,
    dragging: false,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  };
  visualPointerSessions.set(view, session);
  view.dom.setPointerCapture?.(event.pointerId);

  const updateSelection = (pointerEvent: PointerEvent) => {
    const active = visualPointerSessions.get(view);
    if (
      !active ||
      !pointerEvent.isPrimary ||
      pointerEvent.pointerId !== active.pointerId
    ) {
      return;
    }
    if (!active.dragging) {
      const distance = Math.hypot(
        pointerEvent.clientX - active.startX,
        pointerEvent.clientY - active.startY,
      );
      if (distance < VISUAL_POINTER_DRAG_THRESHOLD) return;
      active.dragging = true;
    }
    pointerEvent.preventDefault();
    dispatchEditorVisualSourceSelection(
      view,
      active.anchor,
      getSourcePositionAtCoords(
        view,
        pointerEvent.clientX,
        pointerEvent.clientY,
      ),
    );
  };
  const onPointerMove = (pointerEvent: PointerEvent) => {
    updateSelection(pointerEvent);
  };
  const onPointerUp = (pointerEvent: PointerEvent) => {
    const active = visualPointerSessions.get(view);
    if (!active || pointerEvent.pointerId !== active.pointerId) return;
    if (active.dragging) {
      updateSelection(pointerEvent);
    }
    const editBlock = active.dragging ? null : active.block;
    const editAnchor = active.anchor;
    clearEditorVisualPointerSession(view);
    if (editBlock) editSource(view, editBlock, editAnchor);
  };
  const onPointerCancel = (pointerEvent: PointerEvent) => {
    const active = visualPointerSessions.get(view);
    if (!active || pointerEvent.pointerId !== active.pointerId) return;
    clearEditorVisualPointerSession(view);
  };
  const listenerOptions = {
    capture: true,
    signal: abortController.signal,
  };
  window.addEventListener("pointermove", onPointerMove, listenerOptions);
  window.addEventListener("pointerup", onPointerUp, listenerOptions);
  window.addEventListener("pointercancel", onPointerCancel, listenerOptions);
  window.addEventListener(
    "blur",
    () => clearEditorVisualPointerSession(view),
    { signal: abortController.signal },
  );
  view.dom.addEventListener(
    "lostpointercapture",
    () => clearEditorVisualPointerSession(view),
    { signal: abortController.signal },
  );
};

const editorVisualPointerSessionPlugin = ViewPlugin.fromClass(class {
  constructor(readonly view: EditorView) {}

  destroy() {
    clearEditorVisualPointerSession(this.view);
  }
});

const pointerSelectionHandler = EditorView.domEventHandlers({
  pointerdown: (event, view) => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      isInteractiveVisualTarget(event.target)
    ) {
      return false;
    }
    const container = getVisualPointerContainer(event.target);
    const block = readEditorVisualBlockRange(container);
    if (!container || !block) return false;
    startEditorVisualPointerSelection(view, event, block, container);
    return true;
  },
});

export const editorVisualPointerSelectionExtensions = [
  pointerSelectionHandler,
  editorVisualPointerSessionPlugin,
];

const moveIntoVisualBlockHorizontally = (
  view: EditorView,
  forward: boolean,
  replacements: readonly EditorVisualReplacement[],
) => {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const target = selection.head + (forward ? 1 : -1);
  if (target < 0 || target > view.state.doc.length) return false;
  const block = findEditorVisualMappedBlockAt(replacements, target);
  if (!block) return false;
  const crossesIntoBlock = forward
    ? selection.head <= block.from && target >= block.from
    : selection.head >= block.to && target <= block.to;
  if (!crossesIntoBlock) return false;
  editSource(
    view,
    block,
    getEditorVisualBlockEntryPosition(view.state, block, forward),
  );
  return true;
};

export const createEditorVisualNavigationExtension = (
  interactionField: StateField<EditorVisualInteraction>,
  getReplacements: (state: EditorState) => readonly EditorVisualReplacement[],
) => Prec.highest(keymap.of([
  {
    key: "ArrowDown",
    run: (view) =>
      moveByVisualLine(
        view,
        true,
        getReplacements(view.state),
        view.state.field(interactionField),
      ),
  },
  {
    key: "ArrowUp",
    run: (view) =>
      moveByVisualLine(
        view,
        false,
        getReplacements(view.state),
        view.state.field(interactionField),
      ),
  },
  {
    key: "ArrowRight",
    run: (view) =>
      moveIntoVisualBlockHorizontally(
        view,
        true,
        getReplacements(view.state),
      ),
  },
  {
    key: "ArrowLeft",
    run: (view) =>
      moveIntoVisualBlockHorizontally(
        view,
        false,
        getReplacements(view.state),
      ),
  },
]));

const mapBlock = (
  block: EditorVisualBlockRange | null,
  transaction: Transaction,
) => block && transaction.docChanged
  ? {
      from: transaction.changes.mapPos(block.from, -1),
      to: transaction.changes.mapPos(block.to, 1),
    }
  : block;

const mapStoppedBlock = (
  block: EditorVisualBlockStop | null,
  transaction: Transaction,
): EditorVisualBlockStop | null => {
  const mapped = mapBlock(block, transaction);
  return mapped && block
    ? {
        ...mapped,
        forward: block.forward,
        goalColumn: block.goalColumn,
      }
    : null;
};

export const updateEditorVisualInteraction = (
  value: EditorVisualInteraction,
  transaction: Transaction,
): EditorVisualInteraction => {
  let editing = mapBlock(value.editing, transaction);
  let stopped = mapStoppedBlock(value.stopped, transaction);
  let explicitlyEdited = false;
  let explicitlyStopped = false;
  let revealSelection = false;

  for (const effect of transaction.effects) {
    if (effect.is(setEditorVisualInteraction)) {
      if ("editing" in effect.value) {
        editing = effect.value.editing ?? null;
        explicitlyEdited = true;
      }
      if ("stopped" in effect.value) {
        stopped = effect.value.stopped ?? null;
        explicitlyStopped = true;
      }
      continue;
    }
    if (effect.is(revealEditorVisualSelection)) revealSelection = true;
  }

  if (revealSelection && !explicitlyEdited) {
    const selection = transaction.state.selection.main;
    const block = findEditorVisualReplacementInRange(
      transaction.state,
      selection.from,
      selection.to,
      null,
    );
    editing = block ? { from: block.from, to: block.to } : null;
    explicitlyEdited = true;
  }

  if (editing) stopped = null;
  if (editing && !explicitlyEdited) {
    const selection = transaction.state.selection.main;
    if (selection.to < editing.from || selection.from > editing.to) editing = null;
  }
  if (
    stopped &&
    !explicitlyStopped &&
    !transaction.startState.selection.eq(transaction.state.selection)
  ) {
    stopped = null;
  }
  return { editing, stopped };
};
