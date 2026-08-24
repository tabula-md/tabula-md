import { describe, expect, it } from "vitest";
import { EditorState, Transaction } from "@codemirror/state";
import {
  allowVisualFrontmatterChange,
  createVisualFrontmatterProtectionExtension,
  getVisualBodyPlaceholderPosition,
  getVisualFrontmatterSelectionTransition,
  restoreFrontmatterSourceSelection,
} from "./editorVisualFrontmatter";

const markdown = [
  "---",
  "title: Incident response",
  "owner:",
  "  team: operations",
  "---",
  "",
  "# Body",
].join("\n");

describe("visual frontmatter selection", () => {
  it("moves a source cursor in frontmatter to the body before Write renders", () => {
    const transition = getVisualFrontmatterSelectionTransition(markdown, {
      anchor: markdown.indexOf("operations"),
      head: markdown.indexOf("operations"),
    });

    expect(transition).toEqual({
      bodyOffset: markdown.indexOf("\n\n# Body") + 1,
      sourceSelection: {
        anchor: markdown.indexOf("operations"),
        head: markdown.indexOf("operations"),
      },
      visualSelection: {
        anchor: markdown.indexOf("\n\n# Body") + 1,
        head: markdown.indexOf("\n\n# Body") + 1,
      },
    });
  });

  it("places the visual placeholder at an empty body instead of the hidden source", () => {
    const metadataOnly = "---\ntype: Note\n---\n";
    expect(getVisualBodyPlaceholderPosition(metadataOnly)).toBe(metadataOnly.length);
    expect(getVisualBodyPlaceholderPosition(`${metadataOnly}Body`)).toBeNull();
    expect(getVisualBodyPlaceholderPosition("")).toBeNull();
  });

  it("does not move a body selection or invalid frontmatter", () => {
    const bodyPosition = markdown.indexOf("Body");
    expect(getVisualFrontmatterSelectionTransition(markdown, {
      anchor: bodyPosition,
      head: bodyPosition,
    })).toBeNull();
    expect(getVisualFrontmatterSelectionTransition("---\ntitle: [\n---\nBody", {
      anchor: 2,
      head: 2,
    })).toBeNull();
  });

  it("restores a remembered Source cursor without crossing a changed delimiter", () => {
    const changed = markdown.replace("title: Incident response", "title: Incident response guide");
    const restored = restoreFrontmatterSourceSelection(changed, {
      anchor: markdown.length,
      head: markdown.length,
    });

    expect(restored).toEqual({
      anchor: changed.indexOf("\n\n# Body"),
      head: changed.indexOf("\n\n# Body"),
    });
  });
});

describe("visual frontmatter protection", () => {
  const createState = (source = markdown) => EditorState.create({
    doc: source,
    extensions: createVisualFrontmatterProtectionExtension(),
  });

  it("blocks Backspace and range replacement from crossing the hidden boundary", () => {
    const state = createState();
    const bodyOffset = markdown.indexOf("\n\n# Body") + 1;

    expect(state.update({
      changes: { from: bodyOffset - 1, to: bodyOffset },
      userEvent: "delete.backward",
    }).newDoc.toString()).toBe(markdown);
    expect(state.update({
      changes: { from: 0, to: bodyOffset + 1, insert: "X" },
      userEvent: "input.type",
    }).newDoc.toString()).toBe(markdown);
  });

  it("keeps a closing delimiter valid when typing the first visible body text", () => {
    const source = "---\ntype: Note\n---";
    const state = createState(source);
    const transaction = state.update({
      changes: { from: source.length, insert: "Body" },
      userEvent: "input.type",
    });

    expect(transaction.newDoc.toString()).toBe("---\ntype: Note\n---\nBody");
    expect(transaction.newSelection.main.head).toBe(source.length + "\nBody".length);
  });

  it("allows body edits and deliberate or remote frontmatter updates", () => {
    const state = createState();
    const bodyPosition = markdown.indexOf("Body");
    expect(state.update({
      changes: { from: bodyPosition, to: bodyPosition + 4, insert: "Guide" },
      userEvent: "input.type",
    }).newDoc.toString()).toContain("# Guide");

    expect(state.update({
      annotations: allowVisualFrontmatterChange.of(true),
      changes: { from: markdown.indexOf("Incident"), to: markdown.indexOf(" response"), insert: "Runbook" },
    }).newDoc.toString()).toContain("title: Runbook response");

    expect(state.update({
      annotations: Transaction.remote.of(true),
      changes: { from: markdown.indexOf("Incident"), to: markdown.indexOf(" response"), insert: "Remote" },
    }).newDoc.toString()).toContain("title: Remote response");
  });

  it("admits unannotated projections from the collaboration binding", () => {
    const state = createState();
    expect(state.update({
      changes: {
        from: markdown.indexOf("Incident"),
        to: markdown.indexOf(" response"),
        insert: "Collaborative",
      },
    }).newDoc.toString()).toContain("title: Collaborative response");
  });

  it("does not protect malformed or absent frontmatter as hidden metadata", () => {
    const malformed = "---\ntype: [\n---\nBody";
    const state = createState(malformed);
    expect(state.update({ changes: { from: 0, to: 3, insert: "" } }).newDoc.toString())
      .toBe("\ntype: [\n---\nBody");
  });
});
