import { StateEffect, StateField, type EditorState, type Extension, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { Collaborator } from "../collaboration";
import {
  getCollaboratorPresenceLabel,
  isCollaboratorInFile,
} from "../collaboration/collaborationPresence";
import { clampEditorPosition } from "./editorTransactions";

const toCssColor = (color: string) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#763fc8");

export type EditorPresenceState = {
  collaborators: Collaborator[];
  currentDocumentId?: string;
  currentFileTitle?: string;
  currentRoomId?: string;
};

type EditorPresenceFieldValue = {
  decorations: DecorationSet;
  signature: string;
  state: EditorPresenceState;
};

export const updateEditorPresenceEffect = StateEffect.define<EditorPresenceState>();

const getSelectionSignature = (selection: Collaborator["selection"]) =>
  selection ? `${selection.from}:${selection.to}` : "";

export const shouldRenderRemoteCursor = ({
  anchor,
  docLength,
}: {
  anchor: number;
  docLength: number;
}) => anchor >= 0 && anchor <= docLength;

export const getRemoteCursorWidgetSide = ({
  anchor,
  docLength,
}: {
  anchor: number;
  docLength: number;
}) => (docLength === 0 && anchor === 0 ? -1 : 1);

export const mapEditorPresenceStateThroughTransaction = (
  presenceState: EditorPresenceState,
  transaction: Transaction,
): EditorPresenceState => {
  if (presenceState.collaborators.length === 0 || !transaction.docChanged) {
    return presenceState;
  }

  const previousDocLength = transaction.startState.doc.length;
  return {
    ...presenceState,
    collaborators: presenceState.collaborators.map((collaborator) => {
      const selection = collaborator.selection;
      if (!selection) {
        return collaborator;
      }

      const from = clampEditorPosition(selection.from, previousDocLength);
      const to = clampEditorPosition(selection.to, previousDocLength);
      if (selection.from === selection.to) {
        const position = transaction.changes.mapPos(to, -1);
        return {
          ...collaborator,
          selection: {
            ...selection,
            from: position,
            to: position,
            lineNumber: undefined,
            toLineNumber: undefined,
          },
        };
      }

      return {
        ...collaborator,
        selection: {
          ...selection,
          from: transaction.changes.mapPos(from, -1),
          to: transaction.changes.mapPos(to, 1),
          lineNumber: undefined,
          toLineNumber: undefined,
        },
      };
    }),
  };
};

export const getEditorPresenceSignature = ({
  collaborators = [],
  currentDocumentId = "",
  currentFileTitle = "",
  currentRoomId = "",
}: EditorPresenceState) =>
  [
    currentDocumentId,
    currentFileTitle,
    currentRoomId,
    ...collaborators.map((collaborator) =>
      [
        collaborator.id,
        collaborator.name,
        collaborator.color,
        collaborator.activeDocumentId ?? "",
        collaborator.roomId ?? "",
        collaborator.fileTitle ?? "",
        getSelectionSignature(collaborator.selection),
      ].join(":"),
    ),
  ].join("|");

class RemoteCursorWidget extends WidgetType {
  constructor(
    private readonly collaborator: Collaborator,
    private readonly label: string,
    private readonly color: string,
  ) {
    super();
  }

  eq(other: RemoteCursorWidget) {
    return (
      other.collaborator.id === this.collaborator.id &&
      other.collaborator.name === this.collaborator.name &&
      other.label === this.label &&
      other.color === this.color
    );
  }

  toDOM() {
    const cursor = document.createElement("span");
    cursor.className = "cm-remote-cursor";
    cursor.style.setProperty("--remote-presence-color", this.color);
    cursor.setAttribute("aria-label", this.label);
    cursor.setAttribute("title", this.label);

    return cursor;
  }

  ignoreEvent() {
    return true;
  }
}

export const createEditorPresenceExtension = (
  collaborators: Collaborator[] = [],
  currentFileTitle?: string,
  currentRoomId?: string,
  currentDocumentId?: string,
): Extension => {
  const createPresenceDecorations = (state: EditorState, presenceState: EditorPresenceState) => {
    if (presenceState.collaborators.length === 0) {
      return Decoration.set([]);
    }

    const docLength = state.doc.length;
    const ranges = presenceState.collaborators
      .flatMap((collaborator) => {
        if (
          !isCollaboratorInFile(
            collaborator,
            presenceState.currentFileTitle,
            presenceState.currentRoomId,
            presenceState.currentDocumentId,
          )
        ) {
          return [];
        }

        const selection = collaborator.selection;
        if (!selection) {
          return [];
        }

        const color = toCssColor(collaborator.color);
        const from = clampEditorPosition(Math.min(selection.from, selection.to), docLength);
        const to = clampEditorPosition(Math.max(selection.from, selection.to), docLength);
        const anchor = clampEditorPosition(selection.to, docLength);
        if (!shouldRenderRemoteCursor({ anchor, docLength })) {
          return [];
        }

        const line = state.doc.lineAt(anchor);
        const label = getCollaboratorPresenceLabel({
          ...collaborator,
          selection: {
            ...selection,
            lineNumber: line.number,
            toLineNumber: line.number,
          },
        });
        const style = `--remote-presence-color: ${color};`;
        const decorations = [
          Decoration.widget({
            widget: new RemoteCursorWidget(collaborator, label, color),
            side: getRemoteCursorWidgetSide({ anchor, docLength }),
          }).range(anchor),
        ];

        if (to > from) {
          decorations.push(
            Decoration.mark({
              class: "cm-remote-selection",
              attributes: {
                style,
                title: label,
              },
            }).range(from, to),
          );
        }

        return decorations;
      })
      .sort((first, second) => first.from - second.from || first.to - second.to);

    return Decoration.set(ranges, true);
  };
  const initialState: EditorPresenceState = {
    collaborators,
    currentDocumentId,
    currentFileTitle,
    currentRoomId,
  };

  const presenceField = StateField.define<EditorPresenceFieldValue>({
    create: (state) => ({
      decorations: createPresenceDecorations(state, initialState),
      signature: getEditorPresenceSignature(initialState),
      state: initialState,
    }),
    update: (value, transaction) => {
      const presenceEffect = transaction.effects.find((effect) => effect.is(updateEditorPresenceEffect));
      const nextPresence = mapEditorPresenceStateThroughTransaction(
        presenceEffect?.value ?? value.state,
        transaction,
      );
      const nextSignature = getEditorPresenceSignature(nextPresence);

      if (nextSignature !== value.signature || transaction.docChanged) {
        return {
          decorations: createPresenceDecorations(transaction.state, nextPresence),
          signature: nextSignature,
          state: nextPresence,
        };
      }

      if (!presenceEffect) {
        return value;
      }

      return {
        ...value,
        state: nextPresence,
      };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });

  const cursorLabelPlugin = ViewPlugin.fromClass(
    class {
      private readonly labelLayer: HTMLDivElement;
      private renderFrame: number | null = null;

      constructor(private readonly view: EditorView) {
        this.labelLayer = document.createElement("div");
        this.labelLayer.className = "cm-remote-cursor-label-layer";
        this.view.dom.append(this.labelLayer);
        this.view.scrollDOM.addEventListener("scroll", this.scheduleRender, { passive: true });
        this.scheduleRender();
      }

      update(_update: ViewUpdate) {
        this.scheduleRender();
      }

      destroy() {
        this.view.scrollDOM.removeEventListener("scroll", this.scheduleRender);
        const viewWindow = this.view.dom.ownerDocument.defaultView;
        if (this.renderFrame !== null && viewWindow) {
          viewWindow.cancelAnimationFrame(this.renderFrame);
        }
        this.labelLayer.remove();
      }

      private readonly scheduleRender = () => {
        if (this.renderFrame !== null) {
          return;
        }

        const viewWindow = this.view.dom.ownerDocument.defaultView;
        if (!viewWindow) {
          this.render();
          return;
        }

        this.renderFrame = viewWindow.requestAnimationFrame(() => {
          this.renderFrame = null;
          this.render();
        });
      };

      private readonly render = () => {
        const field = this.view.state.field(presenceField, false);
        const presenceState = field?.state;
        if (!presenceState || presenceState.collaborators.length === 0) {
          this.labelLayer.replaceChildren();
          return;
        }

        const editorRect = this.view.dom.getBoundingClientRect();
        const docLength = this.view.state.doc.length;
        const labels = presenceState.collaborators.flatMap((collaborator) => {
          if (
            !isCollaboratorInFile(
              collaborator,
              presenceState.currentFileTitle,
              presenceState.currentRoomId,
              presenceState.currentDocumentId,
            )
          ) {
            return [];
          }

          const selection = collaborator.selection;
          if (!selection) {
            return [];
          }

          const anchor = clampEditorPosition(selection.to, docLength);
          if (!shouldRenderRemoteCursor({ anchor, docLength })) {
            return [];
          }

          const coords = this.view.coordsAtPos(anchor, 1);
          if (!coords) {
            return [];
          }

          const line = this.view.state.doc.lineAt(anchor);
          const label = getCollaboratorPresenceLabel({
            ...collaborator,
            selection: {
              ...selection,
              lineNumber: line.number,
              toLineNumber: line.number,
            },
          });
          const color = toCssColor(collaborator.color);
          const labelElement = document.createElement("span");
          labelElement.className =
            coords.top - editorRect.top < 24
              ? "cm-remote-cursor-label below"
              : "cm-remote-cursor-label above";
          labelElement.style.setProperty("--remote-presence-color", color);
          labelElement.style.left = `${Math.max(
            0,
            Math.min(coords.left - editorRect.left + 6, Math.max(0, editorRect.width - 180)),
          )}px`;
          labelElement.style.top = `${
            coords.top - editorRect.top < 24 ? coords.bottom - editorRect.top : coords.top - editorRect.top
          }px`;
          labelElement.setAttribute("title", label);
          labelElement.textContent = collaborator.name;
          return [labelElement];
        });

        this.labelLayer.replaceChildren(...labels);
      };
    },
  );

  return [presenceField, cursorLabelPlugin];
};
