import type { ShortcutLabels } from "./keyboardShortcuts";

const getAppShortcut = ({ primary, alternate }: ShortcutLabels, key: string) => `${primary} + ${alternate} + ${key}`;

export const getKeyboardShortcuts = (shortcutLabels: ShortcutLabels) => [
  { keys: getAppShortcut(shortcutLabels, "N"), action: "New Markdown" },
  { keys: getAppShortcut(shortcutLabels, "O"), action: "Open .md file" },
  { keys: getAppShortcut(shortcutLabels, "F"), action: "Browse project files" },
  { keys: "?", action: "Open HELP.md" },
  { keys: `${shortcutLabels.primary} + B`, action: "Bold" },
  { keys: `${shortcutLabels.primary} + I`, action: "Italic" },
  { keys: `${shortcutLabels.primary} + K`, action: "Link" },
  { keys: `${shortcutLabels.primary} + Shift + 7`, action: "Numbered list" },
  { keys: `${shortcutLabels.primary} + Shift + 8`, action: "Bullet list" },
  { keys: `${shortcutLabels.primary} + Shift + 9`, action: "Quote" },
  { keys: getAppShortcut(shortcutLabels, "1"), action: "Edit mode" },
  { keys: getAppShortcut(shortcutLabels, "2"), action: "Split mode" },
  { keys: getAppShortcut(shortcutLabels, "3"), action: "Preview mode" },
  { keys: getAppShortcut(shortcutLabels, "Left"), action: "Previous file tab" },
  { keys: getAppShortcut(shortcutLabels, "Right"), action: "Next file tab" },
  { keys: "Enter in search", action: "Next search match" },
  { keys: "Shift + Enter in search", action: "Previous search match" },
  { keys: "Double-click tab", action: "Rename file" },
  { keys: "Enter", action: "Commit rename" },
  { keys: "Escape", action: "Cancel rename or close menu" },
];

export const createHelpMarkdown = (shortcutLabels: ShortcutLabels) => `---
title: HELP
description: Quick reference for using Tabula.md.
---

# HELP

## Start

- Create a Markdown file with **New Markdown**.
- Open an existing \`.md\` or \`.markdown\` file with **Open .md file**.
- Use **Browse project files** to reopen files after closing every tab.

## Work

- Edit Markdown in Edit mode.
- Use Split mode to edit and preview together.
- Use Preview mode to read and comment on the rendered document.

## Share

- Share a live room when people need to edit together.

## Preferences

- Set the default mode for newly created Markdown files.
- Choose the default reading width for new files.
- Turn line wrapping and line numbers on or off for new editor surfaces.

## Shortcuts

| Shortcut | Action |
| --- | --- |
${getKeyboardShortcuts(shortcutLabels).map((shortcut) => `| ${shortcut.keys} | ${shortcut.action} |`).join("\n")}
`;
