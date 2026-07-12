import {
  formatShortcut,
  type SemanticShortcut,
  type ShortcutPlatform,
} from "./keyboardShortcuts";

type HelpShortcut = {
  action: string;
  context?: string;
  gesture?: string;
  shortcut?: SemanticShortcut;
};

const helpShortcuts: HelpShortcut[] = [
  { shortcut: "Mod+Alt+N", action: "New document" },
  { shortcut: "Mod+Alt+O", action: "Open Markdown file" },
  { shortcut: "Mod+Alt+F", action: "Browse project files" },
  { shortcut: "?", action: "Open HELP.md" },
  { shortcut: "Mod+B", action: "Bold" },
  { shortcut: "Mod+I", action: "Italic" },
  { shortcut: "Mod+K", action: "Link" },
  { shortcut: "Mod+Shift+7", action: "Numbered list" },
  { shortcut: "Mod+Shift+8", action: "Bullet list" },
  { shortcut: "Mod+Shift+9", action: "Quote" },
  { shortcut: "Mod+Alt+1", action: "Edit mode" },
  { shortcut: "Mod+Alt+2", action: "Split mode" },
  { shortcut: "Mod+Alt+3", action: "Preview mode" },
  { shortcut: "Mod+Alt+ArrowLeft", action: "Previous file tab" },
  { shortcut: "Mod+Alt+ArrowRight", action: "Next file tab" },
  { shortcut: "Enter", context: "in search", action: "Next search match" },
  { shortcut: "Shift+Enter", context: "in search", action: "Previous search match" },
  { gesture: "Double-click tab", action: "Rename file" },
  { shortcut: "Enter", action: "Commit rename" },
  { shortcut: "Escape", action: "Cancel rename or close menu" },
];

export const getKeyboardShortcuts = (platform: ShortcutPlatform) =>
  helpShortcuts.map(({ action, context, gesture, shortcut }) => ({
    action,
    keys: gesture ?? `${formatShortcut(shortcut ?? "", platform)}${context ? ` ${context}` : ""}`,
  }));

export const createHelpMarkdown = (platform: ShortcutPlatform) => `---
title: HELP
description: Quick reference for using Tabula.md.
---

# HELP

## Start

- Create a document with **New document**.
- Open an existing \`.md\` or \`.markdown\` file with **Open Markdown file**.
- Use **Browse project files** to reopen files after closing every tab.

## Work

- Edit in Edit mode.
- Use Split mode to edit and preview together.
- Use Preview mode to read and comment on the rendered document.

## Share

- Share a live room when people need to edit together.

## Preferences

- Choose System, Light, or Dark theme.
- Switch the app chrome language from the Preferences menu.

## Shortcuts

| Shortcut | Action |
| --- | --- |
${getKeyboardShortcuts(platform).map((shortcut) => `| ${shortcut.keys} | ${shortcut.action} |`).join("\n")}
`;
