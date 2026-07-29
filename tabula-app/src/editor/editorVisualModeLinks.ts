import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  createMarkdownPresentationDocument,
  type PresentationNode,
} from "@tabula-md/tabula";
import { classifyMarkdownHref } from "../preview/markdownHref";
import type {
  EditorVisualModeOptions,
  EditorVisualWorkspaceLinkRange,
} from "./editorVisualModeTypes";

const getDirectLinkChildren = (node: SyntaxNode) => {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }
  return children;
};

const flattenPresentationNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenPresentationNodes(node.children),
]);

export const getEditorVisualWorkspaceLinkRanges = (
  state: EditorState,
  options: EditorVisualModeOptions,
): EditorVisualWorkspaceLinkRange[] => {
  const { resolveWorkspaceLink, sourceDocumentId } = options;

  const ranges: EditorVisualWorkspaceLinkRange[] = [];
  const presentation = createMarkdownPresentationDocument(
    state.doc.toString(),
  );
  for (const node of flattenPresentationNodes(presentation.blocks)) {
    if (
      node.type !== "link" ||
      !node.contentRange ||
      !node.data?.url
    ) {
      continue;
    }
    const labelFrom = node.contentRange.from;
    const labelTo = node.contentRange.to;
    const overlapsSelection = state.selection.ranges.some((selection) =>
      !selection.empty && selection.from < labelTo && selection.to > labelFrom);
    if (overlapsSelection) continue;

    if (node.data.linkKind === "external") {
      if (classifyMarkdownHref(node.data.url).kind === "external") {
        ranges.push({ from: labelFrom, status: "external", to: labelTo });
      }
      continue;
    }
    if (node.data.linkKind === "internal-heading") {
      ranges.push({ from: labelFrom, status: "heading", to: labelTo });
      continue;
    }
    if (!resolveWorkspaceLink || !sourceDocumentId) continue;
    const workspaceLink = resolveWorkspaceLink(node.data.url, "markdown", {
      relation: "link",
      sourceDocumentId,
    });
    if (!workspaceLink) continue;
    ranges.push({
      from: labelFrom,
      status: workspaceLink.status,
      to: labelTo,
    });
  }

  syntaxTree(state).iterate({
    enter(reference) {
      if (reference.name !== "Link" || reference.node.parent?.name === "Image") return;
      const node = reference.node;
      const children = getDirectLinkChildren(node);
      const marks = children.filter((child) => child.name === "LinkMark");
      const url = children.find((child) => child.name === "URL");
      const referenceLabel = children.find((child) => child.name === "LinkLabel");
      const isWikiLink =
        node.from > 0 &&
        node.to < state.doc.length &&
        state.doc.sliceString(node.from - 1, node.from + 1) === "[[" &&
        state.doc.sliceString(node.to - 1, node.to + 1) === "]]";

      if (!isWikiLink || url || referenceLabel) return;
      const target = state.doc
        .sliceString(node.from + 1, node.to - 1)
        .split("|", 1)[0]
        ?.trim();

      const labelFrom = marks[0]?.to;
      const labelTo = marks[1]?.from;
      if (
        !target ||
        labelFrom === undefined ||
        labelTo === undefined ||
        labelFrom >= labelTo
      ) {
        return;
      }

      const overlapsSelection = state.selection.ranges.some((selection) =>
        !selection.empty && selection.from < labelTo && selection.to > labelFrom);
      if (overlapsSelection) return;
      if (!resolveWorkspaceLink || !sourceDocumentId) return;
      const workspaceLink = resolveWorkspaceLink(target, "wikilink", {
        relation: "link",
        sourceDocumentId,
      });
      if (!workspaceLink) return;
      ranges.push({
        from: labelFrom,
        status: workspaceLink.status,
        to: labelTo,
      });
    },
  });
  return ranges;
};
