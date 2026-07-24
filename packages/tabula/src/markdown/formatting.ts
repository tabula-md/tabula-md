export type MarkdownFormatCommand =
  | "bold"
  | "italic"
  | "strikethrough"
  | "inline-code"
  | "inline-math"
  | "link"
  | "image"
  | "quote"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "numbered-list"
  | "check-list"
  | "horizontal-rule"
  | "code-block"
  | "math-block"
  | "mermaid"
  | "table"
  | "callout"
  | "accordion"
  | "tabs"
  | "frontmatter"
  | "footnote"
  | "clear-formatting";

export type MarkdownFormatSelection = {
  from: number;
  to: number;
};

export type MarkdownFormatResult = {
  text: string;
  selection: MarkdownFormatSelection;
};

interface InlineWrapOptions {
  prefix: string;
  suffix?: string;
  placeholder: string;
}

const clampOffset = (offset: number, textLength: number) => Math.max(0, Math.min(offset, textLength));

const normalizeSelection = (text: string, selection: MarkdownFormatSelection): MarkdownFormatSelection => {
  const from = clampOffset(Math.min(selection.from, selection.to), text.length);
  const to = clampOffset(Math.max(selection.from, selection.to), text.length);
  return { from, to };
};

const replaceTextRange = (
  text: string,
  from: number,
  to: number,
  insertion: string,
  selectionFrom: number,
  selectionTo: number,
): MarkdownFormatResult => ({
  text: `${text.slice(0, from)}${insertion}${text.slice(to)}`,
  selection: {
    from: selectionFrom,
    to: selectionTo,
  },
});

const wrapInlineSelection = (
  text: string,
  selection: MarkdownFormatSelection,
  { prefix, suffix = prefix, placeholder }: InlineWrapOptions,
) => {
  const { from, to } = normalizeSelection(text, selection);
  const selectedText = text.slice(from, to);

  if (!selectedText) {
    const insertion = `${prefix}${placeholder}${suffix}`;
    const selectionFrom = from + prefix.length;
    return replaceTextRange(text, from, to, insertion, selectionFrom, selectionFrom + placeholder.length);
  }

  const outerFrom = from - prefix.length;
  const outerTo = to + suffix.length;
  const hasOuterWrap =
    outerFrom >= 0 && text.slice(outerFrom, from) === prefix && text.slice(to, outerTo) === suffix;
  if (hasOuterWrap) {
    return replaceTextRange(text, outerFrom, outerTo, selectedText, outerFrom, outerFrom + selectedText.length);
  }

  const hasSelectedWrap = selectedText.startsWith(prefix) && selectedText.endsWith(suffix);
  if (hasSelectedWrap && selectedText.length >= prefix.length + suffix.length) {
    const innerText = selectedText.slice(prefix.length, selectedText.length - suffix.length);
    return replaceTextRange(text, from, to, innerText, from, from + innerText.length);
  }

  const insertion = `${prefix}${selectedText}${suffix}`;
  const selectionFrom = from + prefix.length;
  return replaceTextRange(text, from, to, insertion, selectionFrom, selectionFrom + selectedText.length);
};

const insertLink = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const selectedText = text.slice(from, to) || "link";
  const insertion = `[${selectedText}](url)`;
  const urlFrom = from + selectedText.length + 3;
  return replaceTextRange(text, from, to, insertion, urlFrom, urlFrom + 3);
};

const insertImage = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const selectedText = text.slice(from, to) || "image alt";
  const insertion = `![${selectedText}](image-url)`;
  const urlFrom = from + selectedText.length + 4;
  return replaceTextRange(text, from, to, insertion, urlFrom, urlFrom + "image-url".length);
};

const getSelectedLineRange = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const lineStart = text.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
  const selectedEnd = to > from && text[to - 1] === "\n" ? to - 1 : to;
  const nextLineBreak = text.indexOf("\n", selectedEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;

  return {
    from: lineStart,
    to: lineEnd,
    lines: text.slice(lineStart, lineEnd).split("\n"),
  };
};

const replaceSelectedLines = (
  text: string,
  selection: MarkdownFormatSelection,
  transformLines: (lines: string[]) => string[],
) => {
  const range = getSelectedLineRange(text, selection);
  const insertion = transformLines(range.lines).join("\n");
  return replaceTextRange(text, range.from, range.to, insertion, range.from, range.from + insertion.length);
};

const replaceEmptySelectedLine = (
  text: string,
  selection: MarkdownFormatSelection,
  insertion: string,
  placeholderFrom: number,
  placeholderLength: number,
) => {
  const normalizedSelection = normalizeSelection(text, selection);
  const range = getSelectedLineRange(text, selection);
  if (
    normalizedSelection.from !== normalizedSelection.to ||
    range.lines.length !== 1 ||
    range.lines[0] !== ""
  ) {
    return null;
  }

  const selectionFrom = range.from + placeholderFrom;
  return replaceTextRange(text, range.from, range.to, insertion, selectionFrom, selectionFrom + placeholderLength);
};

const stripListMarker = (line: string) => {
  const match = line.match(/^(\s*)(?:- \[[ xX]\]\s+|\d+\.\s+|[-*+]\s+)?(.*)$/);
  if (!match) {
    return { indent: "", content: line };
  }

  return {
    indent: match[1],
    content: match[2],
  };
};

const isNonEmptyLine = (line: string) => line.trim().length > 0;

const applyHeading = (text: string, selection: MarkdownFormatSelection, depth: 1 | 2 | 3) =>
  replaceEmptySelectedLine(
    text,
    selection,
    `${"#".repeat(depth)} Heading`,
    depth + 1,
    "Heading".length,
  ) ??
  replaceSelectedLines(text, selection, (lines) => {
    const marker = "#".repeat(depth);
    const nonEmptyLines = lines.filter(isNonEmptyLine);
    const shouldRemove =
      nonEmptyLines.length > 0 &&
      nonEmptyLines.every((line) => new RegExp(`^#{${depth}}\\s+`).test(line.trimStart()));

    return lines.map((line) => {
      if (!isNonEmptyLine(line)) {
        return line;
      }

      const indent = line.match(/^\s*/)?.[0] ?? "";
      const content = line.trimStart().replace(/^#{1,6}\s+/, "");
      return shouldRemove ? `${indent}${content}` : `${indent}${marker} ${content}`;
    });
  });

const applyQuote = (text: string, selection: MarkdownFormatSelection) =>
  replaceEmptySelectedLine(text, selection, "> quote", 2, "quote".length) ??
  replaceSelectedLines(text, selection, (lines) => {
    const shouldRemove = lines.some(isNonEmptyLine) && lines.filter(isNonEmptyLine).every((line) => /^>\s?/.test(line));
    return lines.map((line) => (shouldRemove ? line.replace(/^>\s?/, "") : `> ${line}`));
  });

const applyBulletList = (text: string, selection: MarkdownFormatSelection) =>
  replaceEmptySelectedLine(text, selection, "- item", 2, "item".length) ??
  replaceSelectedLines(text, selection, (lines) => {
    const nonEmptyLines = lines.filter(isNonEmptyLine);
    const shouldRemove = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => /^\s*[-*+]\s+/.test(line));
    return lines.map((line) => {
      if (!isNonEmptyLine(line)) {
        return line;
      }

      const { indent, content } = stripListMarker(line);
      return shouldRemove ? `${indent}${content}` : `${indent}- ${content}`;
    });
  });

const applyNumberedList = (text: string, selection: MarkdownFormatSelection) =>
  replaceEmptySelectedLine(text, selection, "1. item", 3, "item".length) ??
  replaceSelectedLines(text, selection, (lines) => {
    const nonEmptyLines = lines.filter(isNonEmptyLine);
    const shouldRemove = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => /^\s*\d+\.\s+/.test(line));
    let number = 1;

    return lines.map((line) => {
      if (!isNonEmptyLine(line)) {
        return line;
      }

      const { indent, content } = stripListMarker(line);
      if (shouldRemove) {
        return `${indent}${content}`;
      }

      const nextLine = `${indent}${number}. ${content}`;
      number += 1;
      return nextLine;
    });
  });

const applyCheckList = (text: string, selection: MarkdownFormatSelection) =>
  replaceEmptySelectedLine(text, selection, "- [ ] item", 6, "item".length) ??
  replaceSelectedLines(text, selection, (lines) => {
    const nonEmptyLines = lines.filter(isNonEmptyLine);
    const shouldRemove =
      nonEmptyLines.length > 0 && nonEmptyLines.every((line) => /^\s*- \[[ xX]\]\s+/.test(line));

    return lines.map((line) => {
      if (!isNonEmptyLine(line)) {
        return line;
      }

      const { indent, content } = stripListMarker(line);
      return shouldRemove ? `${indent}${content}` : `${indent}- [ ] ${content}`;
    });
  });

const isHorizontalRuleLine = (line: string) => /^\s*(?:---|\*\*\*|___)\s*$/.test(line);

const applyHorizontalRule = (text: string, selection: MarkdownFormatSelection) => {
  const normalizedSelection = normalizeSelection(text, selection);
  const range = getSelectedLineRange(text, normalizedSelection);
  const nonEmptyLines = range.lines.filter(isNonEmptyLine);

  if (nonEmptyLines.length > 0 && nonEmptyLines.every(isHorizontalRuleLine)) {
    return replaceTextRange(text, range.from, range.to, "", range.from, range.from);
  }

  if (
    normalizedSelection.from === normalizedSelection.to &&
    range.lines.length === 1 &&
    range.lines[0].trim().length === 0
  ) {
    return replaceTextRange(text, range.from, range.to, "---", range.from + 3, range.from + 3);
  }

  const insertAt = range.to;
  const before = text.slice(0, insertAt);
  const after = text.slice(insertAt);
  const leadingBreak = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trailingBreak = after.length === 0 ? "" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insertion = `${leadingBreak}---${trailingBreak}`;
  const selectionOffset = insertAt + leadingBreak.length + 3;

  return replaceTextRange(text, insertAt, insertAt, insertion, selectionOffset, selectionOffset);
};

const applyCodeBlock = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const selectedText = text.slice(from, to);
  const selectedFenceMatch = selectedText.match(/^```[^\n]*\n([\s\S]*?)\n```$/);

  if (selectedFenceMatch) {
    const innerText = selectedFenceMatch[1];
    return replaceTextRange(text, from, to, innerText, from, from + innerText.length);
  }

  const codeText = selectedText || "code";
  const languagePlaceholder = "language";
  const insertion = `\`\`\`${languagePlaceholder}\n${codeText}\n\`\`\``;
  const selectionFrom = from + 3;
  return replaceTextRange(
    text,
    from,
    to,
    insertion,
    selectionFrom,
    selectionFrom + languagePlaceholder.length,
  );
};

const insertBlockAtSelection = (
  text: string,
  selection: MarkdownFormatSelection,
  block: string,
  selectionOffset: number,
  selectionLength: number,
) => {
  const { from, to } = normalizeSelection(text, selection);
  const before = text.slice(0, from);
  const after = text.slice(to);
  const leadingBreak = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trailingBreak = after.length === 0 ? "" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insertion = `${leadingBreak}${block}${trailingBreak}`;
  const selectionFrom = from + leadingBreak.length + selectionOffset;
  return replaceTextRange(
    text,
    from,
    to,
    insertion,
    selectionFrom,
    selectionFrom + selectionLength,
  );
};

const insertTable = (text: string, selection: MarkdownFormatSelection) =>
  insertBlockAtSelection(
    text,
    selection,
    "| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |",
    2,
    "Column 1".length,
  );

const insertSelectedBlock = (
  text: string,
  selection: MarkdownFormatSelection,
  prefix: string,
  placeholder: string,
  suffix: string,
) => {
  const { from, to } = normalizeSelection(text, selection);
  const content = text.slice(from, to) || placeholder;
  return insertBlockAtSelection(
    text,
    selection,
    `${prefix}${content}${suffix}`,
    prefix.length,
    content.length,
  );
};

const insertMathBlock = (text: string, selection: MarkdownFormatSelection) =>
  insertSelectedBlock(text, selection, "$$\n", "formula", "\n$$");

const insertMermaid = (text: string, selection: MarkdownFormatSelection) =>
  insertSelectedBlock(text, selection, "```mermaid\ngraph TD\n  ", "A --> B", "\n```");

const insertCallout = (text: string, selection: MarkdownFormatSelection) =>
  insertSelectedBlock(
    text,
    selection,
    '<Callout type="note" title="Note">\n',
    "Content",
    "\n</Callout>",
  );

const insertAccordion = (text: string, selection: MarkdownFormatSelection) =>
  insertSelectedBlock(
    text,
    selection,
    '<Accordion title="Details">\n',
    "Content",
    "\n</Accordion>",
  );

const insertTabs = (text: string, selection: MarkdownFormatSelection) =>
  insertSelectedBlock(
    text,
    selection,
    '<Tabs>\n<Tab title="Tab 1">',
    "Content",
    '</Tab>\n<Tab title="Tab 2">Content</Tab>\n</Tabs>',
  );

const insertFrontmatter = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const insertion = "---\ntitle: Untitled\n---\n\n";
  const selectionFrom = "title: ".length + 4;
  if (from === 0 && to === 0) {
    return replaceTextRange(text, 0, 0, insertion, selectionFrom, selectionFrom + "Untitled".length);
  }

  return insertBlockAtSelection(text, selection, "---\ntitle: Untitled\n---", "title: ".length + 4, "Untitled".length);
};

const insertFootnote = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  const selectedText = text.slice(from, to) || "note";
  const insertion = `[^1]\n\n[^1]: ${selectedText}`;
  const selectionFrom = from + insertion.length - selectedText.length;
  return replaceTextRange(text, from, to, insertion, selectionFrom, selectionFrom + selectedText.length);
};

const clearInlineFormatting = (value: string) =>
  value
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!\[([^\]\n]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]\n]+)\]\([^)]+\)/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1$2");

const clearLineFormatting = (line: string) => {
  const withoutBlockMarker = line
    .replace(/^(\s*)#{1,6}\s+/, "$1")
    .replace(/^(\s*)>\s?/, "$1")
    .replace(/^(\s*)(?:- \[[ xX]\]\s+|\d+\.\s+|[-*+]\s+)/, "$1");
  return clearInlineFormatting(withoutBlockMarker);
};

const clearFormatting = (text: string, selection: MarkdownFormatSelection) => {
  const { from, to } = normalizeSelection(text, selection);
  if (from === to) {
    return { text, selection: { from, to } };
  }

  const selectedText = text.slice(from, to);
  const cleanedText = selectedText
    .split("\n")
    .map(clearLineFormatting)
    .join("\n");
  return replaceTextRange(text, from, to, cleanedText, from, from + cleanedText.length);
};

export const applyMarkdownFormat = (
  text: string,
  selection: MarkdownFormatSelection,
  command: MarkdownFormatCommand,
): MarkdownFormatResult => {
  switch (command) {
    case "bold":
      return wrapInlineSelection(text, selection, { prefix: "**", placeholder: "bold text" });
    case "italic":
      return wrapInlineSelection(text, selection, { prefix: "_", placeholder: "italic text" });
    case "strikethrough":
      return wrapInlineSelection(text, selection, { prefix: "~~", placeholder: "struck text" });
    case "inline-code":
      return wrapInlineSelection(text, selection, { prefix: "`", placeholder: "code" });
    case "inline-math":
      return wrapInlineSelection(text, selection, { prefix: "$", placeholder: "formula" });
    case "link":
      return insertLink(text, selection);
    case "image":
      return insertImage(text, selection);
    case "quote":
      return applyQuote(text, selection);
    case "heading-1":
      return applyHeading(text, selection, 1);
    case "heading-2":
      return applyHeading(text, selection, 2);
    case "heading-3":
      return applyHeading(text, selection, 3);
    case "bullet-list":
      return applyBulletList(text, selection);
    case "numbered-list":
      return applyNumberedList(text, selection);
    case "check-list":
      return applyCheckList(text, selection);
    case "horizontal-rule":
      return applyHorizontalRule(text, selection);
    case "code-block":
      return applyCodeBlock(text, selection);
    case "math-block":
      return insertMathBlock(text, selection);
    case "mermaid":
      return insertMermaid(text, selection);
    case "table":
      return insertTable(text, selection);
    case "callout":
      return insertCallout(text, selection);
    case "accordion":
      return insertAccordion(text, selection);
    case "tabs":
      return insertTabs(text, selection);
    case "frontmatter":
      return insertFrontmatter(text, selection);
    case "footnote":
      return insertFootnote(text, selection);
    case "clear-formatting":
      return clearFormatting(text, selection);
  }
};
