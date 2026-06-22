import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { SearchMatch } from "../markdown";

export const createSearchHighlightExtension = (
  searchMatches: SearchMatch[] = [],
  activeSearchMatchIndex = -1,
): Extension =>
  EditorView.decorations.of((view) => {
    if (searchMatches.length === 0) {
      return Decoration.set([]);
    }

    const docLength = view.state.doc.length;
    const ranges = searchMatches
      .map((match, index) => ({
        ...match,
        index,
        start: Math.max(0, Math.min(match.start, docLength)),
        end: Math.max(0, Math.min(match.end, docLength)),
      }))
      .filter((match) => match.end > match.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((match) =>
        Decoration.mark({
          class: match.index === activeSearchMatchIndex ? "cm-search-match active" : "cm-search-match",
        }).range(match.start, match.end),
      );

    return Decoration.set(ranges, true);
  });
