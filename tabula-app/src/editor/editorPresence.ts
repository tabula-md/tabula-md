import { StateEffect, StateField, type EditorState, type Extension, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import type { Collaborator } from "../collaboration";
import {
  getCollaboratorPresenceLabel,
  isCollaboratorInFile,
} from "../collaboration/collaborationPresence";
import { clampEditorPosition } from "./editorTransactions";

const toCssColor = (color: string) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#763fc8");

export type EditorPresenceState = {
  collaborators: Collaborator[];
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

const mapEditorPresenceStateThroughTransaction = (
  presenceState: EditorPresenceState,
  transaction: Transaction,
): EditorPresenceState => {
  if (presenceState.collaborators.length === 0 || !transaction.docChanged) {
    return presenceState;
  }

  return {
    ...presenceState,
    collaborators: presenceState.collaborators.map((collaborator) => {
      const selection = collaborator.selection;
      if (!selection) {
        return collaborator;
      }

      if (selection.from === selection.to) {
        const position = transaction.changes.mapPos(selection.to, -1);
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
          from: transaction.changes.mapPos(selection.from, -1),
          to: transaction.changes.mapPos(selection.to, 1),
          lineNumber: undefined,
          toLineNumber: undefined,
        },
      };
    }),
  };
};

export const getEditorPresenceSignature = ({
  collaborators = [],
  currentFileTitle = "",
  currentRoomId = "",
}: EditorPresenceState) =>
  [
    currentFileTitle,
    currentRoomId,
    ...collaborators.map((collaborator) =>
      [
        collaborator.id,
        collaborator.name,
        collaborator.color,
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

    const label = document.createElement("span");
    label.className = "cm-remote-cursor-label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = this.collaborator.name;
    cursor.append(label);

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
): Extension => {
  const createPresenceDecorations = (state: EditorState, presenceState: EditorPresenceState) => {
    if (presenceState.collaborators.length === 0) {
      return Decoration.set([]);
    }

    const docLength = state.doc.length;
    const ranges = presenceState.collaborators
      .flatMap((collaborator) => {
        if (!isCollaboratorInFile(collaborator, presenceState.currentFileTitle, presenceState.currentRoomId)) {
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
          Decoration.line({
            class: "cm-remote-presence-line",
            attributes: {
              style,
              title: label,
            },
          }).range(line.from),
          Decoration.widget({
            widget: new RemoteCursorWidget(collaborator, label, color),
            side: 1,
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

  return presenceField;
};
