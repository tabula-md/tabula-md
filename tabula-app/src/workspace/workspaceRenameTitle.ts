import { stripMarkdownExtension } from "@tabula-md/tabula";

const markdownExtensionPattern = /\.(?:md|mdx|markdown)$/i;

export const getWorkspaceRenameDisplayTitle = (title: string) =>
  stripMarkdownExtension(title);

export const restoreWorkspaceRenameExtension = (
  currentTitle: string,
  nextDisplayTitle: string,
) => {
  const displayTitle = getWorkspaceRenameDisplayTitle(currentTitle);
  if (displayTitle === currentTitle || nextDisplayTitle.trim().length === 0) {
    return nextDisplayTitle;
  }

  const extension = currentTitle.match(markdownExtensionPattern)?.[0] ?? "";
  return `${stripMarkdownExtension(nextDisplayTitle)}${extension}`;
};
