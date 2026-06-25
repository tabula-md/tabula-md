import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { Collaborator } from "../collab";
import { getCollaboratorPresenceLabel } from "../collaborationPresence";

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

const toCssColor = (color: string) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#763fc8");

export const createRemotePresenceExtension = (collaborators: Collaborator[] = []): Extension =>
  EditorView.decorations.of((view) => {
    if (collaborators.length === 0) {
      return Decoration.set([]);
    }

    const text = view.state.doc.toString();
    const docLength = view.state.doc.length;
    const ranges = collaborators
      .flatMap((collaborator) => {
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
