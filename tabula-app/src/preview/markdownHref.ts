import { classifyPresentationLink } from "@tabula-md/tabula";

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
  const presentationKind = classifyPresentationLink(href);

  if (
    presentationKind === "external" &&
    absoluteWebUrlPattern.test(href)
  ) {
    return { href, kind: "external", openInNewTab: true };
  }

  if (
    presentationKind === "external" &&
    emailUrlPattern.test(href)
  ) {
    return { href, kind: "external", openInNewTab: false };
  }

  return { kind: "inert", openInNewTab: false };
};
