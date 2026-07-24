import { parseFrontmatterData } from "@tabula-md/tabula";
import type { MarkdownPreviewWorkspaceDocument } from "./markdownPreviewTypes";

export const MAX_WORKSPACE_EMBED_DEPTH = 5;

export const getWorkspaceEmbedMarkdown = (
  document: MarkdownPreviewWorkspaceDocument,
  fragment?: string,
): string | undefined => {
  if (!fragment) {
    return parseFrontmatterData(document.markdown).body;
  }

  const headingIndex = document.headings.findIndex((heading) => heading.id === fragment);
  if (headingIndex === -1) {
    return undefined;
  }

  const heading = document.headings[headingIndex];
  const nextPeerHeading = document.headings
    .slice(headingIndex + 1)
    .find((candidate) => candidate.depth <= heading.depth);
  return document.markdown
    .slice(heading.from, nextPeerHeading?.from ?? document.markdown.length)
    .trimEnd();
};
