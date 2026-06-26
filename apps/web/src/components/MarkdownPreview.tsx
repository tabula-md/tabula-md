import {
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Bookmark, Check, Copy, MessageSquare, WrapText } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  areLineSurfaceRowsEqual,
  buildLineSurfaceAnnotationRows,
  getLineSurfaceAnnotationsSignature,
  type LineSurfaceAnnotation,
  type LineSurfaceRow,
  type LineSurfaceSourceBlock,
} from "../lineSurfaceModel";

export type MarkdownPreviewMetadata = {
  key: string;
  value: string;
};

type MarkdownPreviewProps = {
  metadata: MarkdownPreviewMetadata[];
  body: string;
  commentAnchors?: MarkdownPreviewCommentAnchor[];
  lineAnnotations?: MarkdownPreviewLineAnnotation[];
  activeCommentId?: string | null;
  commentsEnabled?: boolean;
  suspendLineMeasurement?: boolean;
  onLineAction?: (request: MarkdownPreviewLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
};

export type MarkdownPreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownPreviewLineAnnotation = LineSurfaceAnnotation;

export type MarkdownPreviewLineActionRequest = MarkdownPreviewLineAnnotation & {
  action: "bookmark" | "comment";
};

const externalLinkPattern = /^(?:https?:)?\/\//i;
const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks];
const EMPTY_MARKDOWN_PREVIEW_METADATA: MarkdownPreviewMetadata[] = [];
const EMPTY_PREVIEW_COMMENT_ANCHORS: MarkdownPreviewCommentAnchor[] = [];
const EMPTY_PREVIEW_LINE_ANNOTATIONS: MarkdownPreviewLineAnnotation[] = [];
const previewSourceBlockTags = new Set([
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

const getNodeText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
};

type PreviewCodeBlockProps = {
  children?: ReactNode;
};

type PreviewImageProps = {
  alt?: string;
  src?: string;
  title?: string;
};

function PreviewImage({ alt = "", src, title, ...props }: PreviewImageProps) {
  const [hasError, setHasError] = useState(false);
  const caption = title || alt;

  return (
    <span className={`preview-image-frame ${hasError ? "broken" : ""}`}>
      {hasError ? (
        <span className="preview-image-fallback" role="img" aria-label={alt || "Image failed to load"}>
          {alt || "Image failed to load"}
        </span>
      ) : (
        <img
          {...props}
          alt={alt}
          className="preview-image"
          loading="lazy"
          src={src}
          title={title}
          onError={() => setHasError(true)}
        />
      )}
      {caption && <span className="preview-image-caption">{caption}</span>}
    </span>
  );
}

function PreviewCodeBlock({ children, ...props }: PreviewCodeBlockProps) {
  const [isWrapped, setIsWrapped] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeText = useMemo(() => getNodeText(children).replace(/\n$/, ""), [children]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(codeText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const CopyIcon = copied ? Check : Copy;

  return (
    <div className={`preview-code-block ${isWrapped ? "wrapped" : ""}`}>
      <div className="preview-code-actions" aria-label="Code block actions">
        <button
          type="button"
          className={`preview-code-action ${isWrapped ? "active" : ""}`}
          title={isWrapped ? "Disable word wrap" : "Enable word wrap"}
          aria-label={isWrapped ? "Disable word wrap" : "Enable word wrap"}
          aria-pressed={isWrapped}
          onClick={() => setIsWrapped((nextIsWrapped) => !nextIsWrapped)}
        >
          <WrapText size={16} />
        </button>
        <button
          type="button"
          className="preview-code-action"
          title={copied ? "Copied" : "Copy code"}
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={copyCode}
        >
          <CopyIcon size={16} />
        </button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}

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

const ignoredPreviewSourceTags = new Set(["button", "code", "pre"]);
const ignoredCommentAnchorTags = new Set(["a", "button", "code", "pre"]);

const createPreviewSourceLinePlugin = () => () => {
  const walk = (node: HastNode) => {
    if (node.type === "element" && typeof node.tagName === "string" && previewSourceBlockTags.has(node.tagName)) {
      const startLine = node.position?.start?.line;
      const endLine = node.position?.end?.line;
      if (typeof startLine === "number" && typeof endLine === "number") {
        node.properties = {
          ...node.properties,
          dataPreviewLineStart: startLine,
          dataPreviewLineEnd: Math.max(startLine, endLine),
        };
      }
    }

    node.children?.forEach(walk);
  };

  return (tree: HastNode) => {
    walk(tree);
  };
};

const PREVIEW_SOURCE_LINE_REHYPE_PLUGINS = [createPreviewSourceLinePlugin()];

const createPreviewCommentAnchorPlugin =
  (commentAnchors: MarkdownPreviewCommentAnchor[] = [], activeCommentId?: string | null) => () => {
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
        const isSourceIgnored =
          sourceIgnored ||
          (node.type === "element" && typeof node.tagName === "string" && ignoredPreviewSourceTags.has(node.tagName));
        const isCommentIgnored =
          commentIgnored ||
          (node.type === "element" && typeof node.tagName === "string" && ignoredCommentAnchorTags.has(node.tagName));

        if (node.type === "text" && !isSourceIgnored && parent?.children && typeof childIndex === "number") {
          const value = node.value ?? "";
          const nodeStart = node.position?.start?.offset;
          const nodeEnd = node.position?.end?.offset;

          if (typeof nodeStart !== "number" || typeof nodeEnd !== "number" || value.length === 0) {
            return;
          }

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
          intersections.forEach((range) => {
            boundaries.add(range.start);
            boundaries.add(range.end);
          });
          const sortedBoundaries = [...boundaries].sort((first, second) => first - second);

          const nextChildren: HastNode[] = [];
          for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
            const start = sortedBoundaries[index];
            const end = sortedBoundaries[index + 1];
            if (end <= start) {
              continue;
            }

            const segmentAnchor = intersections.find((range) => range.start <= start && range.end >= end)?.anchor;
            const className = ["preview-source-text"];
            if (segmentAnchor) {
              className.push("preview-comment-mark");
              if (segmentAnchor.id === activeCommentId) {
                className.push("active");
              }
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
              properties.title = segmentAnchor.id === activeCommentId ? "Active comment" : "Open comment";
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

        if (!node.children) {
          return;
        }

        for (let index = node.children.length - 1; index >= 0; index -= 1) {
          walk(node.children[index], node, index, isSourceIgnored, isCommentIgnored);
        }
      };

      walk(tree);
    };
  };

const createMarkdownPreviewComponents = (onOpenComment?: (commentId: string) => void): Components => ({
  a: ({ node: _node, href, ...props }) => {
    const isExternal = typeof href === "string" && externalLinkPattern.test(href);

    return <a href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} {...props} />;
  },
  code: ({ node: _node, className, ...props }) => {
    const language = className?.match(/language-([A-Za-z0-9_-]+)/)?.[1];

    return <code className={className} data-language={language} {...props} />;
  },
  input: ({ node: _node, type, checked, ...props }) => {
    if (type !== "checkbox") {
      return <input type={type} checked={checked} {...props} />;
    }

    return (
      <span
        aria-hidden="true"
        className={`preview-task-checkbox ${checked ? "checked" : ""}`}
        data-checked={checked ? "true" : "false"}
      />
    );
  },
  img: ({ node: _node, alt, src, title, ...props }) => (
    <PreviewImage alt={alt} src={src} title={typeof title === "string" ? title : undefined} {...props} />
  ),
  pre: ({ node: _node, children, ...props }) => <PreviewCodeBlock {...props}>{children}</PreviewCodeBlock>,
  span: ({ node: _node, className, children, ...props }) => {
    const spanProps = props as typeof props & { "data-comment-id"?: unknown };
    const commentId = typeof spanProps["data-comment-id"] === "string" ? spanProps["data-comment-id"] : undefined;
    const openComment = () => {
      if (commentId) {
        onOpenComment?.(commentId);
      }
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openComment();
    };

    if (!commentId) {
      return (
        <span className={className} {...props}>
          {children}
        </span>
      );
    }

    return (
      <span className={className} {...props} onClick={openComment} onKeyDown={handleKeyDown}>
        {children}
      </span>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="preview-table-wrap">
      <table {...props} />
    </div>
  ),
});

type PreviewLineRailRow = LineSurfaceRow<MarkdownPreviewLineAnnotation>;

const PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET = 8;
const PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT = 12;

const getStringHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return `${value.length}:${hash.toString(36)}`;
};

const getWidthBucket = (width: number) =>
  Math.max(0, Math.round(width / PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET) * PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET);

const writePreviewLineMeasurementCache = (
  cache: Map<string, PreviewLineRailRow[]>,
  key: string,
  rows: PreviewLineRailRow[],
) => {
  cache.delete(key);
  cache.set(key, rows);

  while (cache.size > PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") {
      return;
    }

    cache.delete(oldestKey);
  }
};

const getPreviewLineButtonLabel = (
  side: "bookmark" | "comment",
  row: MarkdownPreviewLineAnnotation,
) => {
  if (side === "bookmark") {
    return row.hasBookmark ? "Remove preview line bookmark" : "Bookmark preview line";
  }

  return row.hasComment ? "Open preview line comments" : "Comment on preview line";
};

function PreviewLineGutter({
  side,
  rows,
  onLineAction,
  enabled = true,
}: {
  side: "bookmark" | "comment";
  rows: PreviewLineRailRow[];
  onLineAction: (request: MarkdownPreviewLineActionRequest) => void;
  enabled?: boolean;
}) {
  const Icon = side === "bookmark" ? Bookmark : MessageSquare;

  return (
    <div className={`preview-line-gutter ${side}`} aria-label={side === "bookmark" ? "Preview bookmarks" : "Preview comments"}>
      {enabled && rows.map((row) => {
        const isActive = side === "bookmark" ? row.hasBookmark : row.hasComment;
        const className = [
          "preview-line-action",
          side,
          isActive ? `has-${side === "bookmark" ? "bookmark" : "comment"}` : "",
          side === "comment" && row.hasActiveComment ? "active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={`${side}-${row.lineNumber}`}
            className={className}
            type="button"
            style={{ top: row.top, height: row.height }}
            tabIndex={isActive ? 0 : -1}
            aria-label={getPreviewLineButtonLabel(side, row)}
            title={side === "bookmark" ? (row.hasBookmark ? "Remove bookmark" : "Bookmark line") : row.hasComment ? "Open comments" : "Comment on line"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLineAction({ ...row, action: side });
            }}
          >
            <Icon className="preview-line-action-icon" size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function MarkdownPreviewComponent({
  metadata = EMPTY_MARKDOWN_PREVIEW_METADATA,
  body,
  commentAnchors = EMPTY_PREVIEW_COMMENT_ANCHORS,
  lineAnnotations = EMPTY_PREVIEW_LINE_ANNOTATIONS,
  activeCommentId,
  commentsEnabled = true,
  suspendLineMeasurement = false,
  onLineAction,
  onOpenComment,
}: MarkdownPreviewProps) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasLineMeasurementSuspendedRef = useRef(suspendLineMeasurement);
  const lineMeasurementCacheRef = useRef(new Map<string, PreviewLineRailRow[]>());
  const [lineRailRows, setLineRailRows] = useState<PreviewLineRailRow[]>([]);
  const showLineGutters = Boolean(onLineAction);
  const showCommentGutter = showLineGutters;
  const markdownPreviewComponents = useMemo(() => createMarkdownPreviewComponents(onOpenComment), [onOpenComment]);
  const commentAnchorPlugins = useMemo(
    () => (commentsEnabled ? [createPreviewCommentAnchorPlugin(commentAnchors, activeCommentId)] : []),
    [activeCommentId, commentAnchors, commentsEnabled],
  );
  const rehypePlugins = useMemo(
    () => [...PREVIEW_SOURCE_LINE_REHYPE_PLUGINS, ...commentAnchorPlugins],
    [commentAnchorPlugins],
  );
  const bodyMeasurementKey = useMemo(() => getStringHash(body), [body]);
  const lineAnnotationsSignature = useMemo(
    () => getLineSurfaceAnnotationsSignature(lineAnnotations),
    [lineAnnotations],
  );
  const measurePreviewLineRows = useCallback((options: { force?: boolean } = {}) => {
    if (suspendLineMeasurement && !options.force) {
      return;
    }

    const documentElement = documentRef.current;
    const contentElement = contentRef.current;
    if (!documentElement || !contentElement || !showLineGutters) {
      setLineRailRows((currentRows) => (currentRows.length > 0 ? [] : currentRows));
      return;
    }

    const widthBucket = getWidthBucket(contentElement.clientWidth);
    const cacheKey = `${bodyMeasurementKey}:${widthBucket}:${lineAnnotationsSignature}`;
    const cachedRows = lineMeasurementCacheRef.current.get(cacheKey);
    if (cachedRows) {
      setLineRailRows((currentRows) => (areLineSurfaceRowsEqual(currentRows, cachedRows) ? currentRows : cachedRows));
      return;
    }

    const documentRect = documentElement.getBoundingClientRect();
    const sourceBlocks = Array.from(contentElement.querySelectorAll<HTMLElement>("[data-preview-line-start]"))
      .map((element) => {
        const startLine = Number(element.dataset.previewLineStart);
        const endLine = Number(element.dataset.previewLineEnd);
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          startLine,
          endLine: Math.max(startLine, endLine),
          top: rect.top - documentRect.top,
          bottom: rect.bottom - documentRect.top,
        };
      })
      .filter((block): block is LineSurfaceSourceBlock => Boolean(block))
      .sort((first, second) => first.startLine - second.startLine || first.top - second.top);
    const nextRows = buildLineSurfaceAnnotationRows(lineAnnotations, sourceBlocks);

    writePreviewLineMeasurementCache(lineMeasurementCacheRef.current, cacheKey, nextRows);
    setLineRailRows((currentRows) => (areLineSurfaceRowsEqual(currentRows, nextRows) ? currentRows : nextRows));
  }, [bodyMeasurementKey, lineAnnotations, lineAnnotationsSignature, showLineGutters, suspendLineMeasurement]);

  useLayoutEffect(() => {
    const wasSuspended = wasLineMeasurementSuspendedRef.current;
    wasLineMeasurementSuspendedRef.current = suspendLineMeasurement;

    if (suspendLineMeasurement) {
      return undefined;
    }

    let rafId: number | null = null;
    if (wasSuspended) {
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        measurePreviewLineRows({ force: true });
      });
    } else {
      measurePreviewLineRows();
    }

    const contentElement = contentRef.current;
    if (!contentElement || !showLineGutters) {
      return () => {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
      };
    }

    const handleLineMeasurementInvalidated = () => measurePreviewLineRows();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleLineMeasurementInvalidated);
    resizeObserver?.observe(contentElement);
    window.addEventListener("resize", handleLineMeasurementInvalidated);
    const initialMeasureFrame = window.requestAnimationFrame(handleLineMeasurementInvalidated);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleLineMeasurementInvalidated);
      window.cancelAnimationFrame(initialMeasureFrame);
    };
  }, [measurePreviewLineRows, showLineGutters, suspendLineMeasurement]);

  return (
    <div ref={documentRef} className={`preview-document ${showLineGutters ? "with-line-gutters" : ""}`}>
      {showLineGutters && onLineAction && (
        <PreviewLineGutter side="bookmark" rows={lineRailRows} onLineAction={onLineAction} />
      )}

      <div ref={contentRef} className="preview-document-content">
        {metadata.length > 0 && (
          <section className="frontmatter-view" aria-label="Frontmatter">
            {metadata.map((attribute) => (
              <div className="frontmatter-row" key={attribute.key}>
                <span>{attribute.key}</span>
                <strong>{attribute.value}</strong>
              </div>
            ))}
          </section>
        )}

        {body.trim().length > 0 ? (
          <ReactMarkdown components={markdownPreviewComponents} rehypePlugins={rehypePlugins} remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
            {body}
          </ReactMarkdown>
        ) : (
          <div className="preview-placeholder">Preview appears here.</div>
        )}
      </div>

      {showCommentGutter && onLineAction && (
        <PreviewLineGutter side="comment" rows={lineRailRows} onLineAction={onLineAction} enabled={commentsEnabled} />
      )}
    </div>
  );
}

const arePreviewMetadataEqual = (firstMetadata: MarkdownPreviewMetadata[], secondMetadata: MarkdownPreviewMetadata[]) =>
  firstMetadata === secondMetadata ||
  (firstMetadata.length === secondMetadata.length &&
    firstMetadata.every((firstAttribute, index) => {
      const secondAttribute = secondMetadata[index];
      return firstAttribute.key === secondAttribute.key && firstAttribute.value === secondAttribute.value;
    }));

const arePreviewCommentAnchorsEqual = (
  firstAnchors: MarkdownPreviewCommentAnchor[] = EMPTY_PREVIEW_COMMENT_ANCHORS,
  secondAnchors: MarkdownPreviewCommentAnchor[] = EMPTY_PREVIEW_COMMENT_ANCHORS,
) =>
  firstAnchors === secondAnchors ||
  (firstAnchors.length === secondAnchors.length &&
    firstAnchors.every((firstAnchor, index) => {
      const secondAnchor = secondAnchors[index];
      return firstAnchor.id === secondAnchor.id && firstAnchor.start === secondAnchor.start && firstAnchor.end === secondAnchor.end;
    }));

const arePreviewLineAnnotationsEqual = (
  firstAnnotations: MarkdownPreviewLineAnnotation[] = EMPTY_PREVIEW_LINE_ANNOTATIONS,
  secondAnnotations: MarkdownPreviewLineAnnotation[] = EMPTY_PREVIEW_LINE_ANNOTATIONS,
) =>
  firstAnnotations === secondAnnotations ||
  (firstAnnotations.length === secondAnnotations.length &&
    firstAnnotations.every((firstAnnotation, index) => {
      const secondAnnotation = secondAnnotations[index];
      return (
        firstAnnotation.lineNumber === secondAnnotation.lineNumber &&
        firstAnnotation.start === secondAnnotation.start &&
        firstAnnotation.end === secondAnnotation.end &&
        firstAnnotation.hasBookmark === secondAnnotation.hasBookmark &&
        firstAnnotation.hasComment === secondAnnotation.hasComment &&
        firstAnnotation.hasActiveComment === secondAnnotation.hasActiveComment
      );
    }));

const areMarkdownPreviewPropsEqual = (firstProps: MarkdownPreviewProps, secondProps: MarkdownPreviewProps) =>
  firstProps.body === secondProps.body &&
  firstProps.activeCommentId === secondProps.activeCommentId &&
  firstProps.commentsEnabled === secondProps.commentsEnabled &&
  firstProps.suspendLineMeasurement === secondProps.suspendLineMeasurement &&
  firstProps.onLineAction === secondProps.onLineAction &&
  firstProps.onOpenComment === secondProps.onOpenComment &&
  arePreviewMetadataEqual(firstProps.metadata, secondProps.metadata) &&
  arePreviewCommentAnchorsEqual(firstProps.commentAnchors, secondProps.commentAnchors) &&
  arePreviewLineAnnotationsEqual(firstProps.lineAnnotations, secondProps.lineAnnotations);

export const MarkdownPreview = memo(MarkdownPreviewComponent, areMarkdownPreviewPropsEqual);
MarkdownPreview.displayName = "MarkdownPreview";
