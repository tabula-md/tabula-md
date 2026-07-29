import { useId } from "react";
import ReactMarkdown from "react-markdown";
import type {
  MarkdownPreviewProps,
  MarkdownPreviewWorkspaceDocument,
  MarkdownPreviewWorkspaceLink,
} from "./markdownPreviewTypes";
import { transformMarkdownPreviewUrl } from "./markdownPreviewUrl";
import { MARKDOWN_REMARK_PLUGINS } from "./markdownRemarkPlugins";
import { createPreviewRehypePlugins } from "./markdownRehypePlugins";
import { normalizePreviewDocsComponents } from "./previewDocsCompatibility";
import {
  getWorkspaceEmbedMarkdown,
  MAX_WORKSPACE_EMBED_DEPTH,
} from "./workspacePreviewEmbeds";
import type { WorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type { MarkdownPreviewComponents } from "./PreviewDocsComponents";

export type WorkspaceEmbedRenderContext = {
  ancestorDocumentIds: readonly string[];
  depth: number;
  sourceDocumentId?: string;
};

type PreviewWorkspaceEmbedProps = {
  target: string;
  context: WorkspaceEmbedRenderContext;
  copy: WorkspaceSurfaceCopy;
  createNestedComponents: (context: WorkspaceEmbedRenderContext) => MarkdownPreviewComponents;
  onOpenWorkspaceLink?: MarkdownPreviewProps["onOpenWorkspaceLink"];
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"];
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
};

const PreviewWorkspaceEmbedStatus = ({
  kind,
  message,
  target,
}: {
  kind: "ambiguous" | "broken" | "cycle" | "depth-limit";
  message: string;
  target: string;
}) => (
  <section
    className={`preview-workspace-embed status ${kind}`}
    data-workspace-embed-status={kind}
    data-workspace-embed-target={target}
    role="note"
    title={message}
  >
    <span>{message}</span>
  </section>
);

const getResolvedWorkspaceEmbedDocument = (
  workspaceLink: Extract<MarkdownPreviewWorkspaceLink, { status: "resolved" }>,
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"],
): MarkdownPreviewWorkspaceDocument | undefined =>
  resolveWorkspaceDocument?.(workspaceLink.targetDocumentId);

export function PreviewWorkspaceEmbed({
  target,
  context,
  copy,
  createNestedComponents,
  onOpenWorkspaceLink,
  resolveWorkspaceDocument,
  resolveWorkspaceLink,
}: PreviewWorkspaceEmbedProps) {
  const embedInstanceId = useId().replace(/[^a-z0-9_-]/gi, "");
  const workspaceLink = resolveWorkspaceLink?.(
    target,
    "wikilink",
    {
      relation: "embed",
      sourceDocumentId: context.sourceDocumentId,
    },
  );

  if (!workspaceLink || workspaceLink.status === "broken") {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="broken"
        message={copy.brokenWorkspaceLink(target)}
        target={target}
      />
    );
  }
  if (workspaceLink.status === "ambiguous") {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="ambiguous"
        message={copy.ambiguousWorkspaceLink(target)}
        target={target}
      />
    );
  }
  if (workspaceLink.status !== "resolved") {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="broken"
        message={copy.brokenWorkspaceLink(target)}
        target={target}
      />
    );
  }
  if (context.ancestorDocumentIds.includes(workspaceLink.targetDocumentId)) {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="cycle"
        message={copy.circularWorkspaceEmbed(target)}
        target={target}
      />
    );
  }
  if (context.depth >= MAX_WORKSPACE_EMBED_DEPTH) {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="depth-limit"
        message={copy.workspaceEmbedDepthLimit(target)}
        target={target}
      />
    );
  }

  const document = getResolvedWorkspaceEmbedDocument(
    workspaceLink,
    resolveWorkspaceDocument,
  );
  const embeddedMarkdown = document
    ? getWorkspaceEmbedMarkdown(document, workspaceLink.fragment)
    : undefined;
  if (!document || embeddedMarkdown === undefined) {
    return (
      <PreviewWorkspaceEmbedStatus
        kind="broken"
        message={copy.brokenWorkspaceLink(target)}
        target={target}
      />
    );
  }

  const sourceLabel = `${document.path}${
    workspaceLink.fragment ? `#${workspaceLink.fragment}` : ""
  }`;
  const nestedComponents = createNestedComponents({
    ancestorDocumentIds: [
      ...context.ancestorDocumentIds,
      workspaceLink.targetDocumentId,
    ],
    depth: context.depth + 1,
    sourceDocumentId: workspaceLink.targetDocumentId,
  });

  return (
    <section
      className="preview-workspace-embed resolved"
      data-workspace-embed-depth={context.depth + 1}
      data-workspace-embed-status="resolved"
      data-workspace-embed-target={target}
    >
      <header className="preview-workspace-embed-header">
        {onOpenWorkspaceLink ? (
          <button
            type="button"
            title={copy.openWorkspaceEmbedSource(sourceLabel)}
            onClick={() => onOpenWorkspaceLink(workspaceLink)}
          >
            {sourceLabel}
          </button>
        ) : (
          <span>{sourceLabel}</span>
        )}
      </header>
      <div className="preview-workspace-embed-body">
        {embeddedMarkdown.trim().length > 0 ? (
          <ReactMarkdown
            components={nestedComponents}
            rehypePlugins={createPreviewRehypePlugins([], 0, {
              idPrefix: `tabula-embed-${embedInstanceId}-`,
              includeSourceLineMetadata: false,
            })}
            remarkPlugins={MARKDOWN_REMARK_PLUGINS}
            urlTransform={transformMarkdownPreviewUrl}
          >
            {normalizePreviewDocsComponents(embeddedMarkdown)}
          </ReactMarkdown>
        ) : (
          <p className="ui-empty-state preview-empty-state">{copy.nothingToPreview}</p>
        )}
      </div>
    </section>
  );
}
