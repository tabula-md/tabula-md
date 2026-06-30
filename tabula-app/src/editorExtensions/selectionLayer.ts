import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView, layer, RectangleMarker, type LayerMarker } from "@codemirror/view";
import { buildSelectionSegments, type SelectionSourceRectangle, type SelectionSourceSegmentKind } from "../editorSelectionGeometry";

const createSelectionSourceRectangle = (
  view: EditorView,
  marker: RectangleMarker,
  runIndex: number,
  kind: SelectionSourceSegmentKind,
): SelectionSourceRectangle => {
  const isEmptyLine = kind === "empty-line";
  const width = isEmptyLine ? Math.max(view.defaultCharacterWidth, 8) : Math.max(marker.width ?? view.defaultCharacterWidth, 0);
  const height = isEmptyLine ? Math.max(marker.height, view.defaultLineHeight) : Math.max(marker.height, 1);
  const top = isEmptyLine ? marker.top - Math.max(0, height - marker.height) / 2 : marker.top;
  return {
    kind,
    left: marker.left,
    top,
    width,
    height,
    runIndex,
  };
};

export const createTextSelectionHighlightExtension = (): Extension =>
  layer({
    above: false,
    class: "cm-tabula-selection-layer",
    update: (update) => update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged,
    markers: (view): readonly LayerMarker[] => {
      const rectangles: SelectionSourceRectangle[] = [];

      for (const [runIndex, selectionRange] of view.state.selection.ranges.entries()) {
        const from = Math.min(selectionRange.from, selectionRange.to);
        const to = Math.max(selectionRange.from, selectionRange.to);
        if (from === to) {
          continue;
        }

        const selectedLines = [];
        for (let position = from; position <= to;) {
          const line = view.state.doc.lineAt(position);
          const lineFrom = Math.max(from, line.from);
          const lineTo = Math.min(to, line.to);
          if (lineTo > lineFrom || (line.from >= from && line.from < to)) {
            selectedLines.push({ line, lineFrom, lineTo });
          }

          if (line.to >= to) {
            break;
          }
          position = line.to + 1;
        }

        for (const selectedLine of selectedLines) {
          const isEmptyLine = selectedLine.lineTo <= selectedLine.lineFrom;
          const range = isEmptyLine
            ? EditorSelection.cursor(selectedLine.line.from)
            : EditorSelection.range(selectedLine.lineFrom, selectedLine.lineTo);
          const kind = isEmptyLine ? "empty-line" : "text";
          for (const marker of RectangleMarker.forRange(view, "cm-user-selection-segment", range)) {
            rectangles.push(createSelectionSourceRectangle(view, marker, runIndex, kind));
          }
        }
      }

      return buildSelectionSegments(rectangles).map(
        (segment) =>
          new RectangleMarker(
            segment.classNames.join(" "),
            segment.left,
            segment.top,
            segment.width,
            segment.height,
          ),
      );
    },
  });
