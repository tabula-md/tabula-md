import type { TextPatch, WorkspaceKnowledgeLink } from "@tabula-md/tabula";

export type WorkspaceLinkResolutionEdit = {
  patch: TextPatch;
  selection: {
    from: number;
    to: number;
  };
};

const removeMarkdownExtension = (value: string) =>
  value.replace(/\.(?:md|markdown)$/i, "");

const getExplicitWikiTarget = (targetPath: string, fragment?: string) =>
  `/${removeMarkdownExtension(targetPath)}${fragment ? `#${fragment}` : ""}`;

export const getAmbiguousWorkspaceLinkResolutionEdit = (
  markdown: string,
  link: WorkspaceKnowledgeLink,
  targetPath: string,
): WorkspaceLinkResolutionEdit | null => {
  if (link.status !== "ambiguous" || link.syntax !== "wikilink") {
    return null;
  }

  const source = markdown.slice(link.from, link.to);
  const opening = source.indexOf("[[");
  const closing = source.lastIndexOf("]]");
  if (opening === -1 || closing <= opening + 2) {
    return null;
  }

  const contentStart = opening + 2;
  const content = source.slice(contentStart, closing);
  const aliasSeparator = content.indexOf("|");
  const rawTarget = content.slice(0, aliasSeparator === -1 ? undefined : aliasSeparator);
  const leadingWhitespace = rawTarget.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = rawTarget.match(/\s*$/)?.[0] ?? "";
  const replacement = getExplicitWikiTarget(targetPath, link.fragment);
  const from = link.from + contentStart + leadingWhitespace.length;
  const to = link.from + contentStart + rawTarget.length - trailingWhitespace.length;

  if (from > to || markdown.slice(from, to).trim() !== link.target.trim()) {
    return null;
  }

  return {
    patch: {
      from,
      to,
      insert: replacement,
    },
    selection: {
      from,
      to: from + replacement.length,
    },
  };
};
