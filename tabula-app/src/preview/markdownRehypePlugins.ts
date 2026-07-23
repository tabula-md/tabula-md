import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import type { Options as ReactMarkdownOptions } from "react-markdown";
import {
  DEFAULT_SEARCH_OPTIONS,
  EDITOR_SEARCH_MATCH_LIMIT,
  getEditorSearchResultWithLimit,
  getSearchQueryError,
  type SearchOptions,
} from "../editor/editorSearchModel";
import type { MarkdownPreviewCommentAnchor } from "./markdownPreviewTypes";
import { PREVIEW_SANITIZE_SCHEMA } from "./previewSanitizeSchema";
import { PREVIEW_DOCS_BLOCK_TAGS } from "./previewDocsCompatibility";
import type { WorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: {
    start?: { line?: number; offset?: number };
    end?: { line?: number; offset?: number };
  };
};

export type MarkdownRehypePlugins = NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

const previewSourceBlockTags = new Set([
  "blockquote", "card", "cardgroup", "dd", "dl", "dt", "frame", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "li", "ol", "p", "pre", ...PREVIEW_DOCS_BLOCK_TAGS,
  "table", "ul",
]);
const ignoredPreviewSourceTags = new Set(["button", "code", "pre"]);
const ignoredCommentAnchorTags = new Set(["a", "button", "code", "pre"]);
const previewAlertTypes = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

const isHastElement = (node: HastNode | undefined, tagName?: string): node is HastNode =>
  node?.type === "element" && (tagName === undefined || node.tagName === tagName);

const isWhitespaceText = (node: HastNode) =>
  node.type === "text" && (node.value ?? "").trim().length === 0;

export const unwrapPreviewDocsBlockParagraphs = (tree: HastNode) => {
  const walk = (node: HastNode) => {
    if (!node.children) return;

    node.children = node.children.map((child) => {
      if (isHastElement(child, "p")) {
        const contentChildren = child.children?.filter((candidate) => !isWhitespaceText(candidate)) ?? [];
        const onlyChild = contentChildren.length === 1 ? contentChildren[0] : undefined;
        if (
          isHastElement(onlyChild) &&
          typeof onlyChild.tagName === "string" &&
          PREVIEW_DOCS_BLOCK_TAGS.has(onlyChild.tagName)
        ) {
          onlyChild.position = child.position ?? onlyChild.position;
          walk(onlyChild);
          return onlyChild;
        }
      }

      walk(child);
      return child;
    });
  };

  walk(tree);
};

const createPreviewDocsBlockPlugin = () => unwrapPreviewDocsBlockParagraphs;

const getHastText = (node: HastNode | undefined): string => {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return node.children?.map(getHastText).join("") ?? "";
};

const pruneEmptyTextAndLeadingBreaks = (node: HastNode) => {
  if (!node.children) return;
  while (node.children.length > 0) {
    const firstChild = node.children[0];
    const isEmptyText = firstChild.type === "text" && (firstChild.value ?? "").trim().length === 0;
    const isBreak = isHastElement(firstChild, "br");
    if (!isEmptyText && !isBreak) break;
    node.children.shift();
  }
};

const removeAlertMarker = (node: HastNode, pattern: RegExp): boolean => {
  if (node.type === "text" && typeof node.value === "string") {
    const nextValue = node.value.replace(pattern, "");
    if (nextValue !== node.value) {
      node.value = nextValue;
      return true;
    }
    return false;
  }
  return node.children?.some((child) => removeAlertMarker(child, pattern)) ?? false;
};

const isNodeVisuallyEmpty = (node: HastNode | undefined) =>
  !node || getHastText(node).trim().length === 0;

const createPreviewAlertPlugin = () => (tree: HastNode) => {
  const walk = (node: HastNode) => {
    if (isHastElement(node, "blockquote")) {
      const firstContentIndex = node.children?.findIndex((child) => isHastElement(child, "p")) ?? -1;
      const firstParagraph = firstContentIndex >= 0 ? node.children?.[firstContentIndex] : undefined;
      const alertMatch = getHastText(firstParagraph).match(
        /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)(?:\/([^\]]+))?\]\s*/i,
      );

      if (firstParagraph && alertMatch) {
        const alertType = alertMatch[1].toUpperCase();
        const alertTitle = (alertMatch[2] ?? alertType).trim();
        if (previewAlertTypes.has(alertType)) {
          node.properties = {
            ...node.properties,
            className: [
              ...(Array.isArray(node.properties?.className) ? node.properties.className : []),
              "markdown-alert",
              `markdown-alert-${alertType.toLowerCase()}`,
            ],
            dir: "auto",
          };
          removeAlertMarker(firstParagraph, new RegExp(`^\\s*\\[!${alertType}(?:/[^\\]]+)?\\]\\s*`, "i"));
          pruneEmptyTextAndLeadingBreaks(firstParagraph);
          node.children?.splice(firstContentIndex, 0, {
            type: "element",
            tagName: "p",
            properties: { className: ["markdown-alert-title"], dir: "auto" },
            children: [{ type: "text", value: alertTitle }],
          });
          if (isNodeVisuallyEmpty(firstParagraph)) node.children?.splice(firstContentIndex + 1, 1);
        }
      }
    }
    node.children?.forEach(walk);
  };
  walk(tree);
};

const hasFootnoteSectionClass = (className: unknown) =>
  Array.isArray(className)
    ? className.includes("footnotes")
    : typeof className === "string" && className.split(/\s+/).includes("footnotes");

const isFootnoteSectionNode = (node: HastNode | undefined) =>
  isHastElement(node, "section") &&
  (node.properties?.dataFootnotes === true ||
    node.properties?.dataFootnotes === "true" ||
    node.properties?.["data-footnotes"] === true ||
    node.properties?.["data-footnotes"] === "true" ||
    hasFootnoteSectionClass(node.properties?.className));

const createStripFootnoteSectionPlugin = () => (tree: HastNode) => {
  const walk = (node: HastNode) => {
    if (!node.children) return;
    node.children = node.children.filter((child) => !isFootnoteSectionNode(child));
    node.children.forEach(walk);
  };
  walk(tree);
};

const createFootnoteCollectorPlugin = () => (tree: HastNode) => {
  if (!tree.children) return;
  const footnoteSectionIndex = tree.children.findIndex(isFootnoteSectionNode);
  if (footnoteSectionIndex <= 0) return;
  tree.children = tree.children.filter(
    (child, index) => index >= footnoteSectionIndex || !isHastElement(child, "p"),
  );
};

const createPreviewSourceLinePlugin = (lineOffset = 0) => () => {
  const walk = (node: HastNode) => {
    if (node.type === "element" && typeof node.tagName === "string" && previewSourceBlockTags.has(node.tagName)) {
      const startLine = node.position?.start?.line;
      const endLine = node.position?.end?.line;
      if (typeof startLine === "number" && typeof endLine === "number") {
        const sourceStartLine = startLine + lineOffset;
        node.properties = {
          ...node.properties,
          dataPreviewLineStart: sourceStartLine,
          dataPreviewLineEnd: Math.max(sourceStartLine, endLine + lineOffset),
        };
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: HastNode) => walk(tree);
};

export const namespacePreviewIds = (tree: HastNode, prefix: string) => {
  const idMap = new Map<string, string>();
  const collectIds = (node: HastNode) => {
    const id = node.properties?.id;
    if (typeof id === "string" && id.length > 0) {
      idMap.set(id, `${prefix}${id}`);
    }
    node.children?.forEach(collectIds);
  };
  const rewriteReferences = (node: HastNode) => {
    if (node.properties) {
      const id = node.properties.id;
      if (typeof id === "string" && idMap.has(id)) {
        node.properties.id = idMap.get(id);
      }
      const href = node.properties.href;
      if (typeof href === "string" && href.startsWith("#")) {
        const nextId = idMap.get(href.slice(1));
        if (nextId) node.properties.href = `#${nextId}`;
      }
      for (const property of ["ariaDescribedBy", "ariaLabelledBy"]) {
        const references = node.properties[property];
        if (typeof references !== "string") continue;
        node.properties[property] = references
          .split(/\s+/)
          .map((reference) => idMap.get(reference) ?? reference)
          .join(" ");
      }
    }
    node.children?.forEach(rewriteReferences);
  };
  collectIds(tree);
  rewriteReferences(tree);
};

const createPreviewIdNamespacePlugin = (prefix: string) => () => (tree: HastNode) =>
  namespacePreviewIds(tree, prefix);

export const createPreviewCommentAnchorPlugin = (
  commentAnchors: MarkdownPreviewCommentAnchor[] = [],
  activeCommentId: string | null | undefined,
  copy: Pick<WorkspaceSurfaceCopy, "activeComment" | "openComment">,
) => () => {
  const anchors = commentAnchors
    .filter((anchor) => anchor.end > anchor.start)
    .sort((first, second) => first.start - second.start || first.end - second.end);

  return (tree: HastNode) => {
    const walk = (
      node: HastNode,
      parent?: HastNode,
      childIndex?: number,
      sourceIgnored = false,
      commentIgnored = false,
    ) => {
      const isSourceIgnored = sourceIgnored ||
        (node.type === "element" && typeof node.tagName === "string" && ignoredPreviewSourceTags.has(node.tagName));
      const isCommentIgnored = commentIgnored ||
        (node.type === "element" && typeof node.tagName === "string" && ignoredCommentAnchorTags.has(node.tagName));

      if (node.type === "text" && !isSourceIgnored && parent?.children && typeof childIndex === "number") {
        const value = node.value ?? "";
        const nodeStart = node.position?.start?.offset;
        const nodeEnd = node.position?.end?.offset;
        if (typeof nodeStart !== "number" || typeof nodeEnd !== "number" || value.length === 0) return;

        const intersections = (isCommentIgnored ? [] : anchors)
          .filter((anchor) => anchor.start < nodeEnd && anchor.end > nodeStart)
          .map((anchor) => ({
            anchor,
            start: Math.max(0, anchor.start - nodeStart),
            end: Math.min(value.length, anchor.end - nodeStart),
          }))
          .filter((range) => range.end > range.start)
          .sort((first, second) => first.start - second.start || first.end - second.end);
        const boundaries = new Set([0, value.length]);
        intersections.forEach(({ start, end }) => {
          boundaries.add(start);
          boundaries.add(end);
        });
        const sortedBoundaries = [...boundaries].sort((first, second) => first - second);
        const nextChildren: HastNode[] = [];
        for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
          const start = sortedBoundaries[index];
          const end = sortedBoundaries[index + 1];
          if (end <= start) continue;
          const segmentAnchor = intersections.find((range) => range.start <= start && range.end >= end)?.anchor;
          const className = ["preview-source-text"];
          if (segmentAnchor) {
            className.push("preview-comment-mark");
            if (segmentAnchor.id === activeCommentId) className.push("active");
          }
          const properties: Record<string, unknown> = {
            className,
            dataSourceStart: nodeStart + start,
            dataSourceEnd: nodeStart + end,
          };
          if (segmentAnchor) {
            properties.dataCommentId = segmentAnchor.id;
            properties.role = "button";
            properties.tabIndex = 0;
            properties.dataTooltip = segmentAnchor.id === activeCommentId ? copy.activeComment : copy.openComment;
            properties.ariaLabel = segmentAnchor.id === activeCommentId ? copy.activeComment : copy.openComment;
          }
          nextChildren.push({
            type: "element",
            tagName: "span",
            properties,
            children: [{ type: "text", value: value.slice(start, end) }],
          });
        }
        parent.children.splice(childIndex, 1, ...nextChildren);
        return;
      }

      if (!node.children) return;
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        walk(node.children[index], node, index, isSourceIgnored, isCommentIgnored);
      }
    };
    walk(tree);
  };
};

const previewSearchIgnoredTags = new Set(["script", "style", "svg"]);

export const createPreviewSearchPlugin = (
  query: string,
  searchOptions: SearchOptions = DEFAULT_SEARCH_OPTIONS,
  activeMatchIndex = -1,
  options: {
    sourceBackedMatches?: Array<{ start: number; end: number }>;
    sourceOffsetBase?: number;
  } = {},
) => () => {
  const normalizedQuery = query.trim();
  const searchError = getSearchQueryError(normalizedQuery, searchOptions);
  if (!normalizedQuery || searchError) return () => undefined;

  return (tree: HastNode) => {
    let matchIndex = 0;
    const splitSearchTextNode = (node: HastNode): HastNode[] | null => {
      const value = node.value ?? "";
      const nodeStart = typeof node.position?.start?.offset === "number"
        ? node.position.start.offset + (options.sourceOffsetBase ?? 0)
        : null;
      const nodeEnd = nodeStart === null ? null : nodeStart + value.length;
      const matches = options.sourceBackedMatches && nodeStart !== null && nodeEnd !== null
        ? options.sourceBackedMatches
            .map((match, index) => ({
              end: Math.min(value.length, match.end - nodeStart),
              index,
              start: Math.max(0, match.start - nodeStart),
            }))
            .filter((match) => match.start < match.end && match.start < value.length && match.end > 0)
        : getEditorSearchResultWithLimit(
            value,
            normalizedQuery,
            searchOptions,
            Math.max(0, EDITOR_SEARCH_MATCH_LIMIT - matchIndex),
          ).matches.map((match, index) => ({
            end: match.end,
            index,
            start: match.start,
          }));
      if (matches.length === 0) return null;

      const nextChildren: HastNode[] = [];
      let cursor = 0;
      for (const match of matches) {
        if (match.start > cursor) nextChildren.push({ type: "text", value: value.slice(cursor, match.start) });
        const currentMatchIndex = options.sourceBackedMatches ? match.index : matchIndex;
        const className = ["preview-search-match"];
        if (currentMatchIndex === activeMatchIndex) className.push("active");
        nextChildren.push({
          type: "element",
          tagName: "mark",
          properties: { className, dataPreviewSearchIndex: currentMatchIndex },
          children: [{ type: "text", value: value.slice(match.start, match.end) }],
        });
        cursor = match.end;
        if (!options.sourceBackedMatches) matchIndex += 1;
      }
      if (cursor < value.length) nextChildren.push({ type: "text", value: value.slice(cursor) });
      return nextChildren;
    };

    const walk = (node: HastNode, ignored = false) => {
      if (!options.sourceBackedMatches && matchIndex >= EDITOR_SEARCH_MATCH_LIMIT) return;
      const isIgnored = ignored ||
        (node.type === "element" && typeof node.tagName === "string" && previewSearchIgnoredTags.has(node.tagName));
      if (!node.children || isIgnored) return;
      const nextChildren: HastNode[] = [];
      for (const child of node.children) {
        if (child.type === "text") {
          nextChildren.push(...(splitSearchTextNode(child) ?? [child]));
        } else {
          walk(child, isIgnored);
          nextChildren.push(child);
        }
      }
      node.children = nextChildren;
    };
    walk(tree);
  };
};

export const createPreviewRehypePlugins = (
  commentAnchorPlugins: MarkdownRehypePlugins,
  lineOffset = 0,
  options: {
    idPrefix?: string;
    includeSourceLineMetadata?: boolean;
    previewSearchPlugin?: MarkdownRehypePlugins[number] | null;
    stripFootnoteSection?: boolean;
    stripGeneratedFootnoteReferences?: boolean;
  } = {},
): MarkdownRehypePlugins => [
  rehypeRaw,
  [rehypeSanitize, PREVIEW_SANITIZE_SCHEMA],
  createPreviewDocsBlockPlugin,
  rehypeSlug,
  ...(options.idPrefix ? [createPreviewIdNamespacePlugin(options.idPrefix)] : []),
  createPreviewAlertPlugin,
  ...(options.includeSourceLineMetadata === false
    ? []
    : [createPreviewSourceLinePlugin(lineOffset)]),
  ...(options.stripFootnoteSection ? [createStripFootnoteSectionPlugin] : []),
  ...(options.stripGeneratedFootnoteReferences ? [createFootnoteCollectorPlugin] : []),
  ...commentAnchorPlugins,
  ...(options.previewSearchPlugin ? [options.previewSearchPlugin] : []),
] as MarkdownRehypePlugins;
