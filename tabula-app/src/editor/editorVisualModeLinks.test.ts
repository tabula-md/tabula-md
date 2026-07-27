import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import type {
  MarkdownPreviewProps,
  MarkdownPreviewWorkspaceLink,
} from "../preview/markdownPreviewTypes";
import { getEditorVisualWorkspaceLinkRanges } from "./editorVisualMode";

const createState = (
  doc: string,
  selection?: { anchor: number; head: number },
) =>
  EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: selection
      ? EditorSelection.single(selection.anchor, selection.head)
      : undefined,
  });

const resolveWorkspaceLink: NonNullable<
  MarkdownPreviewProps["resolveWorkspaceLink"]
> = (target, syntax) => {
  if (target === "#section" || target.startsWith("https://")) return undefined;
  const status: MarkdownPreviewWorkspaceLink["status"] =
    target.includes("missing") ? "broken" : "resolved";
  return status === "resolved"
    ? {
        status,
        relation: "link",
        syntax: syntax ?? "markdown",
        targetDocumentId: "guide",
      }
    : {
        status,
        relation: "link",
        syntax: syntax ?? "markdown",
      };
};

describe("Visual workspace links", () => {
  it("classifies document, heading, and external link labels by destination", () => {
    const doc = [
      "[Guide](./guide.md)",
      "[Section](#section)",
      "[External](https://example.com)",
      "[Missing](./missing.md)",
      "[Reference][guide]",
      "[[Guide|Wiki guide]]",
      "",
      "[guide]: ./guide.md",
    ].join("\n");
    const ranges = getEditorVisualWorkspaceLinkRanges(createState(doc), {
      resolveWorkspaceLink,
      sourceDocumentId: "start",
    });

    expect(ranges.map(({ from, status, to }) => ({
      label: doc.slice(from, to),
      status,
    }))).toEqual([
      { label: "Guide", status: "resolved" },
      { label: "Section", status: "heading" },
      { label: "External", status: "external" },
      { label: "Missing", status: "broken" },
      { label: "Reference", status: "resolved" },
      { label: "Guide|Wiki guide", status: "resolved" },
    ]);
  });

  it("classifies headings and external links without a workspace resolver", () => {
    const doc = "[Section](#section) [External](https://example.com)";
    expect(
      getEditorVisualWorkspaceLinkRanges(createState(doc), {}),
    ).toEqual([
      { from: 1, status: "heading", to: 8 },
      { from: 21, status: "external", to: 29 },
    ]);
  });

  it("removes the background decoration while its label is selected", () => {
    const doc = "[Guide](./guide.md)";
    expect(
      getEditorVisualWorkspaceLinkRanges(
        createState(doc, { anchor: 1, head: 6 }),
        {
          resolveWorkspaceLink,
          sourceDocumentId: "start",
        },
      ),
    ).toEqual([]);
  });
});
