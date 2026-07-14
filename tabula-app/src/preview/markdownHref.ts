export type MarkdownHrefKind = "external" | "fragment" | "relative";

export type ResolvedMarkdownHref = {
  href: string;
  kind: MarkdownHrefKind;
  openInNewTab: boolean;
};

const absoluteWebUrlPattern = /^https?:\/\//i;
const protocolRelativeUrlPattern = /^\/\//;
const domainLikeUrlPattern = /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;

export const resolveMarkdownHref = (value: string): ResolvedMarkdownHref => {
  const href = value.trim();

  if (absoluteWebUrlPattern.test(href)) {
    return { href, kind: "external", openInNewTab: true };
  }

  if (protocolRelativeUrlPattern.test(href)) {
    return { href: `https:${href}`, kind: "external", openInNewTab: true };
  }

  if (domainLikeUrlPattern.test(href)) {
    return { href: `https://${href}`, kind: "external", openInNewTab: true };
  }

  if (href.startsWith("#") && href.length > 1) {
    return { href, kind: "fragment", openInNewTab: false };
  }

  return { href, kind: "relative", openInNewTab: false };
};
