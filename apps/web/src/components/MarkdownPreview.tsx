import {
  isValidElement,
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
import remarkGfm from "remark-gfm";

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
  onLineAction?: (request: MarkdownPreviewLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
};

export type MarkdownPreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownPreviewLineAnnotation = {
  lineNumber: number;
  start: number;
  end: number;
  hasBookmark: boolean;
  hasComment: boolean;
  hasActiveComment?: boolean;
};

export type MarkdownPreviewLineActionRequest = MarkdownPreviewLineAnnotation & {
  action: "bookmark" | "comment";
};

const externalLinkPattern = /^(?:https?:)?\/\//i;
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

type PreviewLineRailRow = MarkdownPreviewLineAnnotation & {
  top: number;
  height: number;
};

type PreviewLineBlock = {
  startLine: number;
  endLine: number;
  top: number;
  bottom: number;
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
}: {
  side: "bookmark" | "comment";
  rows: PreviewLineRailRow[];
  onLineAction: (request: MarkdownPreviewLineActionRequest) => void;
}) {
  const Icon = side === "bookmark" ? Bookmark : MessageSquare;

  return (
    <div className={`preview-line-gutter ${side}`} aria-label={side === "bookmark" ? "Preview bookmarks" : "Preview comments"}>
      {rows.map((row) => {
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

export function MarkdownPreview({
  metadata,
  body,
  commentAnchors = [],
  lineAnnotations = [],
  activeCommentId,
  onLineAction,
  onOpenComment,
}: MarkdownPreviewProps) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [lineRailRows, setLineRailRows] = useState<PreviewLineRailRow[]>([]);
  const showLineGutters = Boolean(onLineAction);
  const markdownPreviewComponents = useMemo(() => createMarkdownPreviewComponents(onOpenComment), [onOpenComment]);
  const sourceLinePlugins = useMemo(() => [createPreviewSourceLinePlugin()], []);
  const commentAnchorPlugins = useMemo(
    () => [createPreviewCommentAnchorPlugin(commentAnchors, activeCommentId)],
    [activeCommentId, commentAnchors],
  );
  const rehypePlugins = useMemo(
    () => [...sourceLinePlugins, ...commentAnchorPlugins],
    [commentAnchorPlugins, sourceLinePlugins],
  );
  const measurePreviewLineRows = useCallback(() => {
    const documentElement = documentRef.current;
    const contentElement = contentRef.current;
    if (!documentElement || !contentElement || !showLineGutters) {
      setLineRailRows((currentRows) => (currentRows.length > 0 ? [] : currentRows));
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
      .filter((block): block is PreviewLineBlock => Boolean(block))
      .sort((first, second) => first.startLine - second.startLine || first.top - second.top);

    const getFallbackLineTop = (lineNumber: number) => {
      const previousBlock = [...sourceBlocks].reverse().find((block) => block.endLine < lineNumber);
      const nextBlock = sourceBlocks.find((block) => block.startLine > lineNumber);
      if (previousBlock && nextBlock) {
        return previousBlock.bottom + Math.max(0, nextBlock.top - previousBlock.bottom) / 2 - 10;
      }

      if (previousBlock) {
        return previousBlock.bottom + 6;
      }

      if (nextBlock) {
        return Math.max(0, nextBlock.top - 26);
      }

      return 0;
    };

    const nextRows = lineAnnotations
      .map((annotation) => {
        const matchingBlock = sourceBlocks.find(
          (block) => block.startLine <= annotation.lineNumber && block.endLine >= annotation.lineNumber,
        );

        if (!matchingBlock) {
          return {
            ...annotation,
            top: getFallbackLineTop(annotation.lineNumber),
            height: 24,
          };
        }

        const sourceLineCount = Math.max(1, matchingBlock.endLine - matchingBlock.startLine + 1);
        const sourceLineHeight = Math.max(20, (matchingBlock.bottom - matchingBlock.top) / sourceLineCount);
        const top = matchingBlock.top + (annotation.lineNumber - matchingBlock.startLine) * sourceLineHeight;
        return {
          ...annotation,
          top,
          height: sourceLineHeight,
        };
      })
      .filter((row, index, rows) => rows.findIndex((candidate) => candidate.lineNumber === row.lineNumber) === index);

    setLineRailRows(nextRows);
  }, [lineAnnotations, showLineGutters]);

  useLayoutEffect(() => {
    measurePreviewLineRows();

    const contentElement = contentRef.current;
    if (!contentElement || !showLineGutters) {
      return undefined;
    }

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measurePreviewLineRows);
    resizeObserver?.observe(contentElement);
    window.addEventListener("resize", measurePreviewLineRows);
    const timeoutId = window.setTimeout(measurePreviewLineRows, 120);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measurePreviewLineRows);
      window.clearTimeout(timeoutId);
    };
  }, [measurePreviewLineRows, showLineGutters]);

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
                <strong>{attribute.value || "true"}</strong>
              </div>
            ))}
          </section>
        )}

        {body.trim().length > 0 ? (
          <ReactMarkdown components={markdownPreviewComponents} rehypePlugins={rehypePlugins} remarkPlugins={[remarkGfm]}>
            {body}
          </ReactMarkdown>
        ) : (
          <div className="preview-placeholder">Preview appears here.</div>
        )}
      </div>

      {showLineGutters && onLineAction && (
        <PreviewLineGutter side="comment" rows={lineRailRows} onLineAction={onLineAction} />
      )}
    </div>
  );
}
