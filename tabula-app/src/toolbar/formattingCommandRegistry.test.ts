import { describe, expect, it, vi } from "vitest";
import {
  formattingToolbarCommands,
  getFormattingToolbarCommandsByPlacement,
  getFormattingToolbarLayout,
} from "./formattingCommandRegistry";

describe("formatting command registry", () => {
  it("separates frequent inline, block, list, and overflow commands", () => {
    expect(getFormattingToolbarCommandsByPlacement("primary").map((command) => command.id)).toEqual([
      "undo",
      "redo",
      "bold",
      "italic",
      "inline-code",
      "link",
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
    expect(getFormattingToolbarCommandsByPlacement("overflow").map((command) => command.id)).toEqual([
      "horizontal-rule",
      "strikethrough",
      "table",
      "image",
      "frontmatter",
      "footnote",
      "clear-formatting",
    ]);
  });

  it("keeps essential commands and More reachable on compact screens", () => {
    const layout = getFormattingToolbarLayout(true);

    expect(layout.primary.map((command) => command.id)).toEqual([
      "undo",
      "redo",
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
    expect(layout.overflow.map((command) => command.id)).toEqual([
      "inline-code",
      "link",
      "horizontal-rule",
      "strikethrough",
      "table",
      "image",
      "frontmatter",
      "footnote",
      "clear-formatting",
    ]);
  });

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
