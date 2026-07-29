import {
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { classifyMarkdownHref } from "./markdownHref";
import type {
  MarkdownPreviewProps,
  MarkdownPreviewWorkspaceLink,
} from "./markdownPreviewTypes";
import {
  getCodeLanguage,
  getNodeText,
  hasCodeClass,
  PreviewCodeBlock,
  PreviewImage,
  PreviewMath,
} from "./PreviewAsyncBlocks";
import {
  getWorkspaceSurfaceCopy,
  type WorkspaceSurfaceCopy,
} from "../workspace/workspaceSurfaceLocale";
import {
  PREVIEW_DOCS_COMPONENTS,
  type MarkdownPreviewComponents,
  type PreviewWorkspaceEmbedRawProps,
} from "./PreviewDocsComponents";
import {
  PreviewWorkspaceEmbed,
  type WorkspaceEmbedRenderContext,
} from "./PreviewWorkspaceEmbed";

export const createMarkdownPreviewComponents = (
  onOpenComment?: (commentId: string) => void,
  onToggleTaskLine?: (sourceLineIndex: number) => void,
  onOpenWorkspaceLink?: (
    link: Extract<MarkdownPreviewWorkspaceLink, { status: "resolved" }>,
  ) => void,
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"],
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"],
  workspaceEmbedContext: WorkspaceEmbedRenderContext = {
    ancestorDocumentIds: [],
    depth: 0,
  },
  searchActive = false,
  copy: WorkspaceSurfaceCopy = getWorkspaceSurfaceCopy("en"),
): MarkdownPreviewComponents => ({
  ...PREVIEW_DOCS_COMPONENTS,
  "tabula-workspace-embed": ({
    node: _node,
    "data-workspace-embed-target": target,
  }: PreviewWorkspaceEmbedRawProps) => (
    <PreviewWorkspaceEmbed
      context={workspaceEmbedContext}
      copy={copy}
      createNestedComponents={(context) =>
        createMarkdownPreviewComponents(
          undefined,
          undefined,
          onOpenWorkspaceLink,
          resolveWorkspaceLink,
          resolveWorkspaceDocument,
          context,
          false,
          copy,
        )}
      onOpenWorkspaceLink={onOpenWorkspaceLink}
      resolveWorkspaceDocument={resolveWorkspaceDocument}
      resolveWorkspaceLink={resolveWorkspaceLink}
      target={typeof target === "string" ? target : ""}
    />
  ),
  a: ({ node: _node, href, children, ...props }) => {
    const wikiLinkProps = props as typeof props & {
      "data-footnote-backref"?: unknown;
      "data-footnote-ref"?: unknown;
      "data-wikilink-relation"?: unknown;
      "data-wikilink-target"?: unknown;
    };
    const isFootnoteLink =
      wikiLinkProps["data-footnote-ref"] !== undefined ||
      wikiLinkProps["data-footnote-backref"] !== undefined;
    if (isFootnoteLink && typeof href === "string" && href.startsWith("#")) {
      const activateFootnoteTarget = (link: HTMLAnchorElement) => {
        const id = decodeURIComponent(href.slice(1));
        const preview = link.closest(".preview-surface");
        const target = preview?.querySelector<HTMLElement>(
          `#${CSS.escape(id)}`,
        );
        if (!target) return;
        target.classList.remove("preview-footnote-target");
        target.addEventListener(
          "animationend",
          () => target.classList.remove("preview-footnote-target"),
          { once: true },
        );
        target.classList.add("preview-footnote-target");
        target.scrollIntoView({ block: "center" });
      };
      return (
        <a
          {...props}
          role="link"
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault();
            activateFootnoteTarget(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            activateFootnoteTarget(event.currentTarget);
          }}
        >
          {children}
        </a>
      );
    }
    const wikiTarget =
      typeof wikiLinkProps["data-wikilink-target"] === "string"
        ? wikiLinkProps["data-wikilink-target"]
        : undefined;
    const workspaceTarget = wikiTarget ?? href;
    const workspaceLink =
      typeof workspaceTarget === "string"
        ? resolveWorkspaceLink?.(
            workspaceTarget,
            wikiTarget ? "wikilink" : "markdown",
            {
              relation: wikiTarget ? "link" : undefined,
              sourceDocumentId: workspaceEmbedContext.sourceDocumentId,
            },
          )
        : undefined;
    const resolvedHref = typeof href === "string" ? classifyMarkdownHref(href) : null;
    const wikiLinkClassName = wikiTarget
      ? `preview-wikilink ${workspaceLink?.relation ?? "link"} ${props.className ?? ""}`.trim()
      : props.className;
    const isCurrentDocumentFragment =
      typeof workspaceTarget === "string" && workspaceTarget.trim().startsWith("#");
    const resolvedWorkspaceLinkClassName =
      workspaceLink?.status === "resolved" && !isCurrentDocumentFragment
        ? `preview-workspace-link resolved ${wikiLinkClassName ?? ""}`.trim()
        : isCurrentDocumentFragment
          ? `preview-heading-link ${wikiLinkClassName ?? ""}`.trim()
          : wikiLinkClassName;

    if (workspaceLink?.status === "resolved" && href && onOpenWorkspaceLink) {
      return (
        <a
          {...props}
          className={resolvedWorkspaceLinkClassName}
          href={href}
          data-workspace-link-relation={workspaceLink.relation}
          data-workspace-link-syntax={workspaceLink.syntax}
          data-workspace-link-target={workspaceLink.targetDocumentId}
          data-workspace-link-status="resolved"
          onClick={(event) => {
            event.preventDefault();
            onOpenWorkspaceLink(workspaceLink);
          }}
        >
          {children}
        </a>
      );
    }

    if (workspaceLink?.status === "broken" || workspaceLink?.status === "ambiguous") {
      const linkTarget = workspaceTarget ?? "";
      const statusTitle = workspaceLink.status === "broken"
        ? copy.brokenWorkspaceLink(linkTarget)
        : copy.ambiguousWorkspaceLink(linkTarget);
      return (
        <span
          {...props}
          className={`preview-workspace-link ${workspaceLink.status} ${wikiLinkClassName ?? ""}`.trim()}
          data-workspace-link-relation={workspaceLink.relation}
          data-workspace-link-syntax={workspaceLink.syntax}
          data-workspace-link-status={workspaceLink.status}
          title={props.title ?? statusTitle}
        >
          {children}
        </span>
      );
    }

    if (resolvedHref?.kind !== "external") {
      return <span {...props}>{children}</span>;
    }

    return (
      <a
        {...props}
        className={`preview-external-link ${wikiLinkClassName ?? ""}`.trim()}
        href={resolvedHref?.href}
        target={resolvedHref?.openInNewTab ? "_blank" : undefined}
        rel={resolvedHref?.openInNewTab ? "noreferrer" : undefined}
      >
        {children}
        <span className="preview-external-link-mark" aria-hidden="true">↗</span>
      </a>
    );
  },
  code: ({ node: _node, className, children, ...props }) => {
    const language = getCodeLanguage(className);

    if (language === "math" || hasCodeClass(className, "math-inline")) {
      return <PreviewMath copy={copy} expression={getNodeText(children)} />;
    }

    return (
      <code
        className={`ui-selection-aware-inline ${className ?? ""}`.trim()}
        data-language={language}
        {...props}
      >
        {children}
      </code>
    );
  },
  input: ({ node: _node, type, checked, ...props }) => {
    if (type !== "checkbox") {
      return <input type={type} checked={checked} {...props} />;
    }

    const className = `preview-task-checkbox ${checked ? "checked" : ""}`;
    if (!onToggleTaskLine) {
      return (
        <span
          aria-hidden="true"
          className={className}
          data-checked={checked ? "true" : "false"}
        />
      );
    }

    const handleTaskClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const block = event.currentTarget.closest("[data-preview-line-start]");
      const sourceLineNumber = Number((block as HTMLElement | null)?.dataset.previewLineStart);
      if (!Number.isFinite(sourceLineNumber)) {
        return;
      }

      onToggleTaskLine(sourceLineNumber - 1);
    };

    return (
      <button
        type="button"
        aria-label={checked ? copy.markTaskIncomplete : copy.markTaskComplete}
        aria-pressed={checked}
        className={className}
        data-checked={checked ? "true" : "false"}
        onClick={handleTaskClick}
      />
    );
  },
  img: ({ node: _node, alt, src, title, ...props }) => (
    <PreviewImage alt={alt} copy={copy} src={src} title={typeof title === "string" ? title : undefined} {...props} />
  ),
  pre: ({ node: _node, children, ...props }) => (
    <PreviewCodeBlock copy={copy} searchActive={searchActive} {...props}>{children}</PreviewCodeBlock>
  ),
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
