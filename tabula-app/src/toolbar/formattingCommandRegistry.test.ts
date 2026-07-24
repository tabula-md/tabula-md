import { describe, expect, it, vi } from "vitest";
import {
  formattingToolbarCommands,
  getFormattingToolbarCommandsByPlacement,
  getFormattingToolbarLayout,
} from "./formattingCommandRegistry";

describe("formatting command registry", () => {
  it("separates frequent inline, block, list, and overflow commands", () => {
    expect(getFormattingToolbarCommandsByPlacement("history").map((command) => command.id)).toEqual([
      "undo",
      "redo",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("inline").map((command) => command.id)).toEqual([
      "bold",
      "italic",
      "inline-code",
      "inline-math",
      "link",
      "strikethrough",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("block").map((command) => command.id)).toEqual([
      "heading-1",
      "heading-2",
      "heading-3",
      "quote",
      "code-block",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("list").map((command) => command.id)).toEqual([
      "bullet-list",
      "numbered-list",
      "check-list",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("insert").map((command) => command.id)).toEqual([
      "table",
      "horizontal-rule",
      "image",
      "footnote",
      "frontmatter",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("component").map((command) => command.id)).toEqual([
      "math-block",
      "mermaid",
      "callout",
      "accordion",
      "tabs",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("cleanup").map((command) => command.id)).toEqual([
      "clear-formatting",
    ]);
    expect(getFormattingToolbarCommandsByPlacement("overflow")).toEqual([]);
  });

  it("keeps essential commands and moves every hidden command into More on compact lanes", () => {
    const layout = getFormattingToolbarLayout("compact");

    expect(layout.history.map((command) => command.id)).toEqual([
      "undo",
    ]);
    expect(layout.inline.map((command) => command.id)).toEqual([
      "bold",
      "italic",
    ]);
    expect(layout.block.map((command) => command.id)).toEqual([
      "heading-1",
      "heading-2",
      "heading-3",
      "quote",
      "code-block",
    ]);
    expect(layout.list.map((command) => command.id)).toEqual([
      "bullet-list",
      "numbered-list",
      "check-list",
    ]);
    expect(layout.insert).toEqual([]);
    expect(layout.overflow.map((command) => command.id)).toEqual([
      "redo",
      "inline-code",
      "inline-math",
      "link",
      "strikethrough",
      "table",
      "horizontal-rule",
      "image",
      "footnote",
      "frontmatter",
      "math-block",
      "mermaid",
      "callout",
      "accordion",
      "tabs",
      "clear-formatting",
    ]);
  });

  it("keeps inline formatting and the insert menu visible on medium lanes", () => {
    const layout = getFormattingToolbarLayout("medium");

    expect(layout.history.map((command) => command.id)).toEqual(["undo", "redo"]);
    expect(layout.inline.map((command) => command.id)).toEqual([
      "bold",
      "italic",
      "inline-code",
      "inline-math",
      "link",
      "strikethrough",
    ]);
    expect(layout.insert.map((command) => command.id)).toEqual([
      "table",
      "horizontal-rule",
      "image",
      "footnote",
      "frontmatter",
    ]);
    expect(layout.component.map((command) => command.id)).toEqual([
      "math-block",
      "mermaid",
      "callout",
      "accordion",
      "tabs",
    ]);
    expect(layout.cleanup.map((command) => command.id)).toEqual(["clear-formatting"]);
    expect(layout.overflow).toEqual([]);
  });

  it("keeps dedicated insert controls on wide lanes", () => {
    const layout = getFormattingToolbarLayout("wide");

    expect(layout.insert.map((command) => command.id)).toEqual([
      "table",
      "horizontal-rule",
      "image",
      "footnote",
      "frontmatter",
    ]);
    expect(layout.component.map((command) => command.id)).toEqual([
      "math-block",
      "mermaid",
      "callout",
      "accordion",
      "tabs",
    ]);
    expect(layout.cleanup.map((command) => command.id)).toEqual(["clear-formatting"]);
    expect(layout.overflow).toEqual([]);
  });

  it.each(["compact", "medium", "wide"] as const)(
    "renders every registered command exactly once at %s density",
    (density) => {
      const layout = getFormattingToolbarLayout(density);
      const renderedIds = [
        ...layout.history,
        ...layout.inline,
        ...layout.block,
        ...layout.list,
        ...layout.insert,
        ...layout.component,
        ...layout.cleanup,
        ...layout.overflow,
      ].map((command) => command.id);
      const registeredIds = formattingToolbarCommands.map((command) => command.id);

      expect(renderedIds).toHaveLength(new Set(renderedIds).size);
      expect([...renderedIds].sort()).toEqual([...registeredIds].sort());
    },
  );

  it("routes history and Markdown commands through their registered actions", () => {
    const onFormat = vi.fn();
    const onRedo = vi.fn();
    const onUndo = vi.fn();
    const actions = {
      canRedo: true,
      canUndo: true,
      onFormat,
      onRedo,
      onUndo,
    };

    formattingToolbarCommands.find((command) => command.id === "undo")?.applyCommand(actions);
    formattingToolbarCommands.find((command) => command.id === "redo")?.applyCommand(actions);
    formattingToolbarCommands.find((command) => command.id === "table")?.applyCommand(actions);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onFormat).toHaveBeenCalledWith("table");
  });

  it("keeps history disabled state in the command registry", () => {
    const undo = formattingToolbarCommands.find((command) => command.id === "undo");
    const redo = formattingToolbarCommands.find((command) => command.id === "redo");

    expect(undo?.isDisabled?.({ canUndo: false, canRedo: true })).toBe(true);
    expect(redo?.isDisabled?.({ canUndo: true, canRedo: false })).toBe(true);
  });
});
