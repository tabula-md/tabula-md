import {
  Bold,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SeparatorHorizontal,
  SquareCode,
  Undo2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { MarkdownFormatCommand } from "../markdownFormatting";

type FormattingToolbarProps = {
  className?: string;
  canRedo: boolean;
  canUndo: boolean;
  onFormat: (command: MarkdownFormatCommand) => void;
  onRedo: () => void;
  onUndo: () => void;
};

type FormattingTool = {
  command: MarkdownFormatCommand;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

const inlineTools: FormattingTool[] = [
  { command: "bold", label: "Bold", icon: Bold },
  { command: "italic", label: "Italic", icon: Italic },
  { command: "inline-code", label: "Inline code", icon: Code2 },
  { command: "link", label: "Link", icon: Link2 },
];

const headingTools: FormattingTool[] = [
  { command: "heading-1", label: "Heading 1", icon: Heading1 },
  { command: "heading-2", label: "Heading 2", icon: Heading2 },
  { command: "heading-3", label: "Heading 3", icon: Heading3 },
];

const listTools: FormattingTool[] = [
  { command: "bullet-list", label: "Bullet list", icon: List },
  { command: "numbered-list", label: "Numbered list", icon: ListOrdered },
  { command: "check-list", label: "Checklist", icon: CheckSquare },
];

const blockTools: FormattingTool[] = [
  { command: "quote", label: "Quote", icon: Quote },
  { command: "code-block", label: "Code block", icon: SquareCode },
  { command: "horizontal-rule", label: "Horizontal rule", icon: SeparatorHorizontal },
];

const renderToolButton = (tool: FormattingTool, onFormat: (command: MarkdownFormatCommand) => void) => {
  const Icon = tool.icon;

  return (
    <button
      key={tool.command}
      className="tool-button formatting-button formatting-command-button"
      type="button"
      title={tool.label}
      aria-label={tool.label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onFormat(tool.command)}
    >
      <Icon size={16} />
    </button>
  );
};

export function FormattingToolbar({
  className = "",
  canRedo,
  canUndo,
  onFormat,
  onRedo,
  onUndo,
}: FormattingToolbarProps) {
  return (
    <div className={`formatting-row ${className}`}>
      <nav className="formatting-toolbar" aria-label="Formatting">
        <button
          className="tool-button formatting-button formatting-history-button"
          type="button"
          title="Undo"
          aria-label="Undo"
          disabled={!canUndo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onUndo}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="tool-button formatting-button formatting-history-button"
          type="button"
          title="Redo"
          aria-label="Redo"
          disabled={!canRedo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRedo}
        >
          <Redo2 size={16} />
        </button>
        <span className="toolbar-separator" />
        {inlineTools.map((tool) => renderToolButton(tool, onFormat))}
        <span className="toolbar-separator" />
        {headingTools.map((tool) => renderToolButton(tool, onFormat))}
        <span className="toolbar-separator" />
        {listTools.map((tool) => renderToolButton(tool, onFormat))}
        <span className="toolbar-separator" />
        {blockTools.map((tool) => renderToolButton(tool, onFormat))}
      </nav>
    </div>
  );
}
