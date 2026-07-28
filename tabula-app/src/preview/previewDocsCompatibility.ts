import {
  createMarkdownPresentationDocument,
  type PresentationNode,
} from "@tabula-md/tabula";
import { PREVIEW_SANITIZE_SCHEMA } from "./previewSanitizeSchema";

const PREVIEW_DOCS_COMPONENT_TAGS: Readonly<Record<string, string>> = {
  Accordion: "tabula-accordion",
  AccordionGroup: "tabula-accordion-group",
  Badge: "tabula-badge",
  Card: "tabula-card",
  CardGroup: "tabula-card-group",
  Callout: "tabula-callout",
  CodeGroup: "tabula-code-group",
  Frame: "tabula-frame",
  Step: "tabula-step",
  Steps: "tabula-steps",
  Tab: "tabula-tab",
  Tabs: "tabula-tabs",
};

const PREVIEW_ALLOWED_HTML_TAGS = new Set(PREVIEW_SANITIZE_SCHEMA.tagNames ?? []);
const PREVIEW_STRIPPED_HTML_TAGS = new Set([
  "base",
  "embed",
  "form",
  "iframe",
  "link",
  "meta",
  "object",
  "script",
  "style",
]);

export const PREVIEW_DOCS_BLOCK_TAGS = new Set([
  "tabula-accordion",
  "tabula-accordion-group",
  "tabula-card",
  "tabula-card-group",
  "tabula-callout",
  "tabula-code-group",
  "tabula-frame",
  "tabula-step",
  "tabula-steps",
  "tabula-tab",
  "tabula-tabs",
  "tabula-unsupported-component",
  "tabula-workspace-embed",
]);

const docsComponentPattern = /<(\/?)([A-Za-z][A-Za-z0-9.-]*)(?=[\s/>])([^<>]*?)>/g;

const flattenPresentationNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenPresentationNodes(node.children),
]);

const getPresentationComponentsByOffset = (source: string) => {
  const components = new Map<number, PresentationNode>();
  for (const node of flattenPresentationNodes(
    createMarkdownPresentationDocument(source).blocks,
  )) {
    if (
      node.type === "accordion" ||
      node.type === "callout" ||
      node.type === "tab" ||
      node.type === "tabs"
    ) {
      components.set(node.range.from, node);
    }
  }
  return components;
};

const normalizeDocsComponentTags = (
  source: string,
  sourceOffset: number,
  presentationComponents: ReadonlyMap<number, PresentationNode>,
) =>
  source.replace(docsComponentPattern, (
    match,
    closing: string,
    name: string,
    suffix: string,
    matchOffset: number,
  ) => {
    const supportedTagName = PREVIEW_DOCS_COMPONENT_TAGS[name];
    if (supportedTagName) {
      const presentation = closing
        ? undefined
        : presentationComponents.get(sourceOffset + matchOffset);
      const annotation = presentation
        ? ` data-presentation-node="${presentation.type}" data-source-from="${presentation.range.from}" data-source-to="${presentation.range.to}"`
        : "";
      return `<${closing}${supportedTagName}${suffix}${annotation}>`;
    }

    const htmlTagName = name.toLowerCase();
    if (PREVIEW_ALLOWED_HTML_TAGS.has(htmlTagName)) {
      return `<${closing}${htmlTagName}${suffix}>`;
    }
    if (PREVIEW_STRIPPED_HTML_TAGS.has(htmlTagName)) {
      return match;
    }

    if (closing) {
      return "</tabula-unsupported-component>";
    }

    const selfClosing = /\/\s*$/.test(suffix);
    const openingTag = `<tabula-unsupported-component data-component-name="${name}">`;
    return selfClosing ? `${openingTag}</tabula-unsupported-component>` : openingTag;
  });

const normalizeOutsideInlineCode = (
  line: string,
  lineOffset: number,
  presentationComponents: ReadonlyMap<number, PresentationNode>,
) => {
  let cursor = 0;
  let normalized = "";

  while (cursor < line.length) {
    const codeStart = line.indexOf("`", cursor);
    if (codeStart === -1) {
      return normalized + normalizeDocsComponentTags(
        line.slice(cursor),
        lineOffset + cursor,
        presentationComponents,
      );
    }

    normalized += normalizeDocsComponentTags(
      line.slice(cursor, codeStart),
      lineOffset + cursor,
      presentationComponents,
    );
    let markerEnd = codeStart + 1;
    while (line[markerEnd] === "`") markerEnd += 1;
    const marker = line.slice(codeStart, markerEnd);
    const codeEnd = line.indexOf(marker, markerEnd);
    if (codeEnd === -1) {
      return normalized + line.slice(codeStart);
    }

    normalized += line.slice(codeStart, codeEnd + marker.length);
    cursor = codeEnd + marker.length;
  }

  return normalized;
};

export const normalizePreviewDocsComponents = (markdown: string) => {
  if (!markdown.includes("<")) return markdown;

  let isInFence = false;
  let activeFenceMarker = "";
  let sourceOffset = 0;
  const presentationComponents = getPresentationComponentsByOffset(markdown);

  return markdown
    .split(/(\r?\n)/)
    .map((segment) => {
      const segmentOffset = sourceOffset;
      sourceOffset += segment.length;
      if (segment === "\n" || segment === "\r\n") return segment;

      const fenceMatch = segment.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        if (!isInFence) {
          isInFence = true;
          activeFenceMarker = marker;
        } else if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
          isInFence = false;
          activeFenceMarker = "";
        }
        return segment;
      }

      return isInFence
        ? segment
        : normalizeOutsideInlineCode(
            segment,
            segmentOffset,
            presentationComponents,
          );
    })
    .join("");
};
