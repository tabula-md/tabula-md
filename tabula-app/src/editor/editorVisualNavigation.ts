import {
  EditorSelection,
  type EditorState,
  type SelectionRange,
} from "@codemirror/state";
import type {
  EditorVisualBlockRange,
  EditorVisualReplacement,
} from "./editorVisualModeModel";
import {
  findEditorVisualMappedBlockOnLine,
  getEditorVisualBlockEntryPosition,
} from "./editorVisualPositionMapping";

export type EditorVisualVerticalMove =
  | {
      anchor: number;
      block: EditorVisualReplacement;
      kind: "block-entry";
    }
  | {
      anchor: number;
      block: EditorVisualReplacement;
      forward: boolean;
      goalColumn: number;
      kind: "block-stop";
    }
  | {
      kind: "logical-line";
      selection: SelectionRange;
    }
  | {
      adjacentLineNumber: number;
      kind: "native";
    }
  | {
      kind: "unhandled";
    };

export type EditorVisualBlockStop = EditorVisualBlockRange & {
  forward: boolean;
  goalColumn: number;
};

const overlapsBlock = (
  state: EditorState,
  selection: SelectionRange,
  block: EditorVisualBlockRange,
) => {
  const currentLine = state.doc.lineAt(selection.head);
  return currentLine.from <= block.to && currentLine.to >= block.from;
};

const cursorOnLogicalLine = (
  state: EditorState,
  lineNumber: number,
  goalColumn: number,
  forward: boolean,
  visualGoalColumn?: number,
) => {
  const line = state.doc.line(lineNumber);
  return EditorSelection.cursor(
    Math.min(line.to, line.from + Math.max(0, goalColumn)),
    forward ? 1 : -1,
    undefined,
    visualGoalColumn,
  );
};

export const resolveEditorVisualVerticalMove = (
  state: EditorState,
  selection: SelectionRange,
  forward: boolean,
  replacements: readonly EditorVisualReplacement[],
  editingBlock: EditorVisualBlockRange | null,
  stoppedBlock: EditorVisualBlockStop | null = null,
): EditorVisualVerticalMove => {
  if (!selection.empty) return { kind: "unhandled" };
  if (stoppedBlock) {
    const block = replacements.find((candidate) =>
      candidate.from === stoppedBlock.from &&
      candidate.to === stoppedBlock.to);
    if (block) {
      if (forward === stoppedBlock.forward) {
        return {
          anchor: getEditorVisualBlockEntryPosition(
            state,
            block,
            forward,
            stoppedBlock.goalColumn,
          ),
          block,
          kind: "block-entry",
        };
      }
      const firstLine = state.doc.lineAt(block.from).number;
      const lastLine = state.doc.lineAt(Math.max(block.from, block.to - 1)).number;
      const adjacentLineNumber = stoppedBlock.forward
        ? firstLine - 1
        : lastLine + 1;
      if (adjacentLineNumber < 1 || adjacentLineNumber > state.doc.lines) {
        return { kind: "unhandled" };
      }
      return {
        kind: "logical-line",
        selection: cursorOnLogicalLine(
          state,
          adjacentLineNumber,
          stoppedBlock.goalColumn,
          forward,
        ),
      };
    }
  }
  const currentLine = state.doc.lineAt(selection.head);
  const adjacentLineNumber = currentLine.number + (forward ? 1 : -1);
  if (adjacentLineNumber < 1 || adjacentLineNumber > state.doc.lines) {
    return { kind: "unhandled" };
  }
  const block = findEditorVisualMappedBlockOnLine(
    state,
    replacements,
    adjacentLineNumber,
  );
  const goalColumn = selection.head - currentLine.from;
  if (block) {
    return {
      anchor: getEditorVisualBlockEntryPosition(
        state,
        block,
        forward,
        goalColumn,
      ),
      block,
      forward,
      goalColumn,
      kind: "block-stop",
    };
  }
  if (editingBlock && overlapsBlock(state, selection, editingBlock)) {
    return {
      kind: "logical-line",
      selection: cursorOnLogicalLine(
        state,
        adjacentLineNumber,
        goalColumn,
        forward,
      ),
    };
  }
  return { adjacentLineNumber, kind: "native" };
};

export const normalizeEditorVisualNativeMove = (
  state: EditorState,
  current: SelectionRange,
  moved: SelectionRange,
  adjacentLineNumber: number,
  forward: boolean,
) => {
  if (moved.head === current.head) return null;
  const currentLine = state.doc.lineAt(current.head);
  if (state.doc.lineAt(moved.head).number === currentLine.number) return moved;
  return cursorOnLogicalLine(
    state,
    adjacentLineNumber,
    current.head - currentLine.from,
    forward,
    moved.goalColumn,
  );
};
