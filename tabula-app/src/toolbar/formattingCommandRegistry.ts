import {
  Bold,
  CheckSquare,
  Code2,
  Eraser,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SeparatorHorizontal,
  SquareCode,
  Strikethrough,
  Superscript,
  Table2,
  Undo2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import type { SemanticShortcut } from "../keyboardShortcuts";
import type { FormattingCommandId } from "./formattingCommandLocale";

export type FormattingToolbarCommandGroup =
  | "history"
  | "inline"
  | "heading"
  | "list"
  | "block"
  | "insert"
  | "cleanup";

export type FormattingToolbarCommandPlacement =
  | "history"
  | "inline"
  | "block"
  | "list"
  | "insert"
  | "overflow";

export type FormattingToolbarCommandState = {
  canRedo: boolean;
  canUndo: boolean;
};

export type FormattingToolbarCommandActions = FormattingToolbarCommandState & {
  onFormat: (command: MarkdownFormatCommand) => void;
  onRedo: () => void;
  onUndo: () => void;
};

export type ToolbarApplyCommand = (actions: FormattingToolbarCommandActions) => void;

export type FormattingToolbarCommand = {
  id: FormattingCommandId;
  group: FormattingToolbarCommandGroup;
  icon: ComponentType<{ size?: number }>;
  shortcut?: SemanticShortcut;
  placement: FormattingToolbarCommandPlacement;
  applyCommand: ToolbarApplyCommand;
  isDisabled?: (state: FormattingToolbarCommandState) => boolean;
};

type FormattingCommandConfig = Omit<FormattingToolbarCommand, "applyCommand" | "id"> & {
  command: MarkdownFormatCommand;
};

const createFormattingCommand = ({
  command,
  ...config
}: FormattingCommandConfig): FormattingToolbarCommand => ({
  ...config,
  id: command,
  applyCommand: ({ onFormat }) => onFormat(command),
});

export const formattingToolbarCommands: FormattingToolbarCommand[] = [
  {
    id: "undo",
    group: "history",
    icon: Undo2,
    shortcut: "Mod+Z",
    placement: "history",
    applyCommand: ({ onUndo }) => onUndo(),
    isDisabled: ({ canUndo }) => !canUndo,
  },
  {
    id: "redo",
    group: "history",
    icon: Redo2,
    shortcut: "Mod+Shift+Z",
    placement: "history",
    applyCommand: ({ onRedo }) => onRedo(),
    isDisabled: ({ canRedo }) => !canRedo,
  },
  createFormattingCommand({
    command: "bold",
    group: "inline",
    icon: Bold,
    shortcut: "Mod+B",
    placement: "inline",
  }),
  createFormattingCommand({
    command: "italic",
    group: "inline",
    icon: Italic,
    shortcut: "Mod+I",
    placement: "inline",
  }),
  createFormattingCommand({
    command: "inline-code",
    group: "inline",
    icon: Code2,
    shortcut: "Mod+E",
    placement: "inline",
  }),
  createFormattingCommand({
    command: "link",
    group: "inline",
    icon: Link2,
    shortcut: "Mod+K",
    placement: "inline",
  }),
  createFormattingCommand({
    command: "heading-1",
    group: "heading",
    icon: Heading1,
    placement: "block",
  }),
  createFormattingCommand({
    command: "heading-2",
    group: "heading",
    icon: Heading2,
    placement: "block",
  }),
  createFormattingCommand({
    command: "heading-3",
    group: "heading",
    icon: Heading3,
    placement: "block",
  }),
  createFormattingCommand({
    command: "bullet-list",
    group: "list",
    icon: List,
    placement: "list",
  }),
  createFormattingCommand({
    command: "numbered-list",
    group: "list",
    icon: ListOrdered,
    placement: "list",
  }),
  createFormattingCommand({
    command: "check-list",
    group: "list",
    icon: CheckSquare,
    placement: "list",
  }),
  createFormattingCommand({
    command: "quote",
    group: "block",
    icon: Quote,
    placement: "block",
  }),
  createFormattingCommand({
    command: "code-block",
    group: "block",
    icon: SquareCode,
    placement: "block",
  }),
  createFormattingCommand({
    command: "horizontal-rule",
    group: "block",
    icon: SeparatorHorizontal,
    placement: "insert",
  }),
  createFormattingCommand({
    command: "strikethrough",
    group: "inline",
    icon: Strikethrough,
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "table",
    group: "insert",
    icon: Table2,
    placement: "insert",
  }),
  createFormattingCommand({
    command: "image",
    group: "insert",
    icon: Image,
    placement: "insert",
  }),
  createFormattingCommand({
    command: "frontmatter",
    group: "insert",
    icon: FileCode2,
    placement: "insert",
  }),
  createFormattingCommand({
    command: "footnote",
    group: "insert",
    icon: Superscript,
    placement: "insert",
  }),
  createFormattingCommand({
    command: "clear-formatting",
    group: "cleanup",
    icon: Eraser,
    placement: "overflow",
  }),
];

export const formattingToolbarGroupOrder: FormattingToolbarCommandGroup[] = [
  "history",
  "inline",
  "heading",
  "list",
  "block",
  "insert",
  "cleanup",
];

export const getFormattingToolbarCommandsByPlacement = (
  placement: FormattingToolbarCommandPlacement,
) => formattingToolbarCommands.filter((command) => command.placement === placement);

const compactInlineCommandIds = new Set(["bold", "italic"]);

export const getFormattingToolbarLayout = (compact: boolean) => {
  const inlineCommands = getFormattingToolbarCommandsByPlacement("inline");
  const insertCommands = getFormattingToolbarCommandsByPlacement("insert");
  const overflowCommands = getFormattingToolbarCommandsByPlacement("overflow");
  return {
    history: getFormattingToolbarCommandsByPlacement("history"),
    inline: compact
      ? inlineCommands.filter((command) => compactInlineCommandIds.has(command.id))
      : inlineCommands,
    block: getFormattingToolbarCommandsByPlacement("block"),
    list: getFormattingToolbarCommandsByPlacement("list"),
    insert: compact ? [] : insertCommands,
    overflow: compact
      ? inlineCommands
          .filter((command) => !compactInlineCommandIds.has(command.id))
          .concat(insertCommands, overflowCommands)
      : overflowCommands,
  };
};
