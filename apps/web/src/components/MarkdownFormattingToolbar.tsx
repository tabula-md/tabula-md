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
  SeparatorHorizontal,
  SquareCode,
} from "lucide-react";
import type { ComponentType } from "react";
import type { MarkdownFormatCommand } from "../markdownFormatting";

type MarkdownFormattingToolbarProps = {
  className?: string;
  onFormat: (command: MarkdownFormatCommand) => void;
};

type MarkdownFormattingTool = {
  command: MarkdownFormatCommand;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

const inlineTools: MarkdownFormattingTool[] = [
  { command: "bold", label: "Bold", icon: Bold },
  { command: "italic", label: "Italic", icon: Italic },
  { command: "inline-code", label: "Inline code", icon: Code2 },
  { command: "link", label: "Link", icon: Link2 },
];

const headingTools: MarkdownFormattingTool[] = [
  { command: "heading-1", label: "Heading 1", icon: Heading1 },
  { command: "heading-2", label: "Heading 2", icon: Heading2 },
  { command: "heading-3", label: "Heading 3", icon: Heading3 },
];

const listTools: MarkdownFormattingTool[] = [
  { command: "bullet-list", label: "Bullet list", icon: List },
  { command: "numbered-list", label: "Numbered list", icon: ListOrdered },
  { command: "check-list", label: "Checklist", icon: CheckSquare },
];

const blockTools: MarkdownFormattingTool[] = [
  { command: "quote", label: "Quote", icon: Quote },
  { command: "code-block", label: "Code block", icon: SquareCode },
  { command: "horizontal-rule", label: "Horizontal rule", icon: SeparatorHorizontal },
];

const renderToolButton = (tool: MarkdownFormattingTool, onFormat: (command: MarkdownFormatCommand) => void) => {
  const Icon = tool.icon;

  return (
    <button
      key={tool.command}
      className="tool-button markdown-format-button"
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

export function MarkdownFormattingToolbar({ className = "", onFormat }: MarkdownFormattingToolbarProps) {
  return (
    <div className={`markdown-formatting-row ${className}`}>
      <nav className="markdown-formatting-toolbar" aria-label="Markdown formatting">
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
