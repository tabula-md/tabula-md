import { type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { Collaborator } from "../collab";
import {
  getCollaboratorPresenceLabel,
  isCollaboratorInFile,
} from "../collaborationPresence";

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

const toCssColor = (color: string) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#763fc8");

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

export const createRemotePresenceExtension = (
  collaborators: Collaborator[] = [],
  currentFileTitle?: string,
  currentRoomId?: string,
): Extension =>
  EditorView.decorations.of((view) => {
    if (collaborators.length === 0) {
      return Decoration.set([]);
    }

    const text = view.state.doc.toString();
    const docLength = view.state.doc.length;
    const ranges = collaborators
      .flatMap((collaborator) => {
        if (!isCollaboratorInFile(collaborator, currentFileTitle, currentRoomId)) {
          return [];
        }

        const selection = collaborator.selection;
        if (!selection) {
          return [];
        }

        const color = toCssColor(collaborator.color);
        const from = clampPosition(Math.min(selection.from, selection.to), docLength);
        const to = clampPosition(Math.max(selection.from, selection.to), docLength);
        const anchor = clampPosition(selection.to, docLength);
        const line = view.state.doc.lineAt(anchor);
        const label = getCollaboratorPresenceLabel(collaborator, text);
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
  });
