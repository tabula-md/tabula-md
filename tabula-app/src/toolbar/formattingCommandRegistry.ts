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

export type FormattingToolbarCommandGroup =
  | "history"
  | "inline"
  | "heading"
  | "list"
  | "block"
  | "insert"
  | "cleanup";

export type FormattingToolbarCommandPlacement = "primary" | "block" | "list" | "overflow";

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
  id: string;
  group: FormattingToolbarCommandGroup;
  icon: ComponentType<{ size?: number }>;
  label: string;
  tooltip: string;
  shortcut?: string;
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
    label: "Undo",
    tooltip: "Undo",
    shortcut: "⌘Z",
    placement: "primary",
    applyCommand: ({ onUndo }) => onUndo(),
    isDisabled: ({ canUndo }) => !canUndo,
  },
  {
    id: "redo",
    group: "history",
    icon: Redo2,
    label: "Redo",
    tooltip: "Redo",
    shortcut: "⇧⌘Z",
    placement: "primary",
    applyCommand: ({ onRedo }) => onRedo(),
    isDisabled: ({ canRedo }) => !canRedo,
  },
  createFormattingCommand({
    command: "bold",
    group: "inline",
    icon: Bold,
    label: "Bold",
    tooltip: "Bold",
    shortcut: "⌘B",
    placement: "primary",
  }),
  createFormattingCommand({
    command: "italic",
    group: "inline",
    icon: Italic,
    label: "Italic",
    tooltip: "Italic",
    shortcut: "⌘I",
    placement: "primary",
  }),
  createFormattingCommand({
    command: "inline-code",
    group: "inline",
    icon: Code2,
    label: "Inline code",
    tooltip: "Inline code",
    shortcut: "⌘E",
    placement: "primary",
  }),
  createFormattingCommand({
    command: "link",
    group: "inline",
    icon: Link2,
    label: "Link",
    tooltip: "Link",
    shortcut: "⌘K",
    placement: "primary",
  }),
  createFormattingCommand({
    command: "heading-1",
    group: "heading",
    icon: Heading1,
    label: "Heading 1",
    tooltip: "Heading 1",
    placement: "block",
  }),
  createFormattingCommand({
    command: "heading-2",
    group: "heading",
    icon: Heading2,
    label: "Heading 2",
    tooltip: "Heading 2",
    placement: "block",
  }),
  createFormattingCommand({
    command: "heading-3",
    group: "heading",
    icon: Heading3,
    label: "Heading 3",
    tooltip: "Heading 3",
    placement: "block",
  }),
  createFormattingCommand({
    command: "bullet-list",
    group: "list",
    icon: List,
    label: "Bullet list",
    tooltip: "Bullet list",
    placement: "list",
  }),
  createFormattingCommand({
    command: "numbered-list",
    group: "list",
    icon: ListOrdered,
    label: "Numbered list",
    tooltip: "Numbered list",
    placement: "list",
  }),
  createFormattingCommand({
    command: "check-list",
    group: "list",
    icon: CheckSquare,
    label: "Checklist",
    tooltip: "Checklist",
    placement: "list",
  }),
  createFormattingCommand({
    command: "quote",
    group: "block",
    icon: Quote,
    label: "Quote",
    tooltip: "Quote",
    placement: "block",
  }),
  createFormattingCommand({
    command: "code-block",
    group: "block",
    icon: SquareCode,
    label: "Code block",
    tooltip: "Code block",
    placement: "block",
  }),
  createFormattingCommand({
    command: "horizontal-rule",
    group: "block",
    icon: SeparatorHorizontal,
    label: "Horizontal rule",
    tooltip: "Horizontal rule",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "strikethrough",
    group: "inline",
    icon: Strikethrough,
    label: "Strikethrough",
    tooltip: "Strikethrough",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "table",
    group: "insert",
    icon: Table2,
    label: "Table",
    tooltip: "Insert table",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "image",
    group: "insert",
    icon: Image,
    label: "Image",
    tooltip: "Insert image",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "frontmatter",
    group: "insert",
    icon: FileCode2,
    label: "Frontmatter",
    tooltip: "Insert frontmatter",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "footnote",
    group: "insert",
    icon: Superscript,
    label: "Footnote",
    tooltip: "Insert footnote",
    placement: "overflow",
  }),
  createFormattingCommand({
    command: "clear-formatting",
    group: "cleanup",
    icon: Eraser,
    label: "Clear formatting",
    tooltip: "Clear formatting",
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

const compactPrimaryCommandIds = new Set(["undo", "redo", "bold", "italic"]);

export const getFormattingToolbarLayout = (compact: boolean) => {
  return {
    primary: compact
      ? formattingToolbarCommands.filter((command) => compactPrimaryCommandIds.has(command.id))
      : getFormattingToolbarCommandsByPlacement("primary"),
    block: getFormattingToolbarCommandsByPlacement("block"),
    list: getFormattingToolbarCommandsByPlacement("list"),
    overflow: compact
      ? getFormattingToolbarCommandsByPlacement("primary")
          .filter((command) => !compactPrimaryCommandIds.has(command.id))
          .concat(getFormattingToolbarCommandsByPlacement("overflow"))
      : getFormattingToolbarCommandsByPlacement("overflow"),
  };
};
