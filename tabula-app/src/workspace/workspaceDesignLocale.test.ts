import { describe, expect, it } from "vitest";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import { WORKSPACE_LANGUAGE_OPTIONS } from "./workspaceLocale";
import { getWorkspaceInterfaceCopy } from "./workspaceInterfaceLocale";
import { getWorkspaceSurfaceCopy } from "./workspaceSurfaceLocale";
import {
  getFormattingCommandCopy,
  type FormattingCommandId,
} from "../toolbar/formattingCommandLocale";

const formatCommands: MarkdownFormatCommand[] = [
  "bold",
  "italic",
  "inline-code",
  "inline-math",
  "link",
  "heading-1",
  "heading-2",
  "heading-3",
  "bullet-list",
  "numbered-list",
  "check-list",
  "quote",
  "code-block",
  "math-block",
  "mermaid",
  "horizontal-rule",
  "strikethrough",
  "table",
  "callout",
  "accordion",
  "tabs",
  "image",
  "frontmatter",
  "footnote",
  "clear-formatting",
];

const commandIds: FormattingCommandId[] = ["undo", "redo", ...formatCommands];

const collectStringLeaves = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStringLeaves);
};

describe("workspace design locale contracts", () => {
  it("provides non-empty surface and interface copy for every supported language", () => {
    for (const { value: language } of WORKSPACE_LANGUAGE_OPTIONS) {
      const surface = getWorkspaceSurfaceCopy(language);
      const workspace = getWorkspaceInterfaceCopy(language);
      const staticCopy = [
        ...collectStringLeaves(surface),
        ...collectStringLeaves(workspace),
      ];

      expect(staticCopy.length).toBeGreaterThan(70);
      expect(staticCopy.every((message) => message.trim().length > 0)).toBe(true);
      expect(surface.jsonContains(2).trim()).not.toBe("");
      expect(surface.jsonMore(2).trim()).not.toBe("");
      expect(workspace.tabs.renameDocument("Plan.md").trim()).not.toBe("");
      expect(workspace.sidePanel.files.open("Plan.md").trim()).not.toBe("");
      expect(workspace.sidePanel.comments.emptyHint.trim()).not.toBe("");
      expect(workspace.sidePanel.comments.selectedCharacters(2).trim()).not.toBe("");
    }
  });

  it("provides a label and tooltip for every formatting command in every language", () => {
    for (const { value: language } of WORKSPACE_LANGUAGE_OPTIONS) {
      for (const commandId of commandIds) {
        const copy = getFormattingCommandCopy(language, commandId);
        expect(copy.label.trim()).not.toBe("");
        expect(copy.tooltip.trim()).not.toBe("");
      }
    }
  });
});
