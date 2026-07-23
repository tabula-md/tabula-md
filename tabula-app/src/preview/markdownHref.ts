export type MarkdownHrefKind = "external" | "inert";

export type ResolvedMarkdownHref = {
  href?: string;
  kind: MarkdownHrefKind;
  openInNewTab: boolean;
};

const absoluteWebUrlPattern = /^https?:\/\//i;
const emailUrlPattern = /^mailto:/i;

export const classifyMarkdownHref = (value: string): ResolvedMarkdownHref => {
  const href = value.trim();

  if (absoluteWebUrlPattern.test(href)) {
    return { href, kind: "external", openInNewTab: true };
  }

  if (emailUrlPattern.test(href)) {
    return { href, kind: "external", openInNewTab: false };
  }

  return { kind: "inert", openInNewTab: false };
};
