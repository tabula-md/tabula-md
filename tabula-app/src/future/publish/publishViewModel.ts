import { PRODUCT_PLUS_NAME } from "../../product";
import type { PublishScope } from "./publish";

export type PublishViewModelInput = {
  activeFileDisplayTitle: string;
  activeFileTitle: string;
  tabulaPlusEnabled: boolean;
  publishScope: PublishScope;
  publishFileCount: number;
  publishedScope?: PublishScope;
  publishedFileTitle?: string;
  publishedFileCount?: number;
  publishedAt?: string;
  publishPageUrl?: string;
  publishBlockerMessage?: string;
  canRepublishSnapshot: boolean;
  publishing: boolean;
  unpublishing: boolean;
};

export type PublishScopeCardViewModel = {
  scope: PublishScope;
  active: boolean;
  title: string;
  detail: string;
};

export type PublishManagementActionId = "update" | "view" | "copy" | "changeScope" | "unpublish";

export type PublishManagementActionViewModel = {
  id: PublishManagementActionId;
  label: string;
  disabled: boolean;
  disabledReason: string;
};

export type PublishStatus = "plus-required" | "blocked" | "publishing" | "published" | "ready";

export type PublishViewModel = {
  blocked: boolean;
  canSubmit: boolean;
  details: {
    filesLabel: string;
    publishedFilesLabel: string;
    publishedScopeTitle: string;
    selectedScopeTitle: string;
  };
  disabledReason: string;
  hasPublishedPage: boolean;
  headingDescription: string;
  headingTitle: string;
  managementActions: PublishManagementActionViewModel[];
  primaryLabel: string;
  readinessLabel: string;
  publishResultSummary: string;
  publishedScopeSummary: string;
  publishedTime: string;
  publicUrlPreview: string;
  requiresPlus: boolean;
  scopeCards: PublishScopeCardViewModel[];
  selectedScopeChanged: boolean;
  status: PublishStatus;
  summary: string;
};

export const formatPublicUrlPreview = (url?: string) => {
  if (!url) {
    return "";
  }

  try {
    const parsedUrl = new URL(url);
    const publishId = parsedUrl.pathname.match(/^\/p\/([^/]+)/)?.[1];
    if (!publishId) {
      return `${parsedUrl.origin}${parsedUrl.pathname}`;
    }

    const compactPublishId = publishId.length > 12 ? `${publishId.slice(0, 8)}...` : publishId;
    return `${parsedUrl.origin}/p/${compactPublishId}`;
  } catch {
    return url;
  }
};

const stripMarkdownExtension = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

const formatPublishedTime = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(date);
};

const getFileCountLabel = (fileCount: number) => (fileCount === 1 ? "1 file" : `${fileCount} files`);

export const buildPublishViewModel = ({
  activeFileDisplayTitle,
  activeFileTitle,
  tabulaPlusEnabled,
  publishScope,
  publishFileCount,
  publishedScope,
  publishedFileTitle,
  publishedFileCount,
  publishedAt,
  publishPageUrl,
  publishBlockerMessage,
  canRepublishSnapshot,
  publishing,
  unpublishing,
}: PublishViewModelInput): PublishViewModel => {
  const hasPublishedPage = Boolean(publishPageUrl);
  const requiresPlus = !tabulaPlusEnabled;
  const publicUrlPreview = formatPublicUrlPreview(publishPageUrl);
  const scopeFileLabel = activeFileDisplayTitle || activeFileTitle;
  const selectedScopeLabel = publishScope === "project" ? "project" : "current page";
  const selectedScopeTitle = publishScope === "project" ? "Project" : "Current page";
  const publishedScopeLabel = publishedScope === "project" ? "project" : "current-page";
  const publishedScopeTitle = publishedScope === "project" ? "Project" : "Current page";
  const selectedScopeChanged = hasPublishedPage && Boolean(publishedScope) && publishScope !== publishedScope;
  const blocked = Boolean(publishBlockerMessage);
  const filesLabel = publishScope === "file" ? "1 file" : getFileCountLabel(publishFileCount);
  const publishedFilesLabel =
    publishedScope === "project" ? getFileCountLabel(publishedFileCount ?? publishFileCount) : "1 file";
  const readinessLabel = blocked
    ? "Needs content"
    : selectedScopeChanged
      ? "Ready to replace"
      : hasPublishedPage
        ? "Ready to update"
        : "Ready to publish";
  const publishResultSummary =
    publishScope === "file"
      ? "Creates one read-only public URL for this page."
      : "Creates one read-only public URL for this project.";
  const publishScopeSummary =
    publishScope === "file"
      ? `${scopeFileLabel} will be published.`
      : publishFileCount === 1
        ? "1 project file will be published."
        : `${publishFileCount} project files will be published.`;
  const publishedScopeSummary =
    publishedScope === "project"
      ? `Published as a project: ${getFileCountLabel(publishedFileCount ?? publishFileCount)}.`
      : `Published as current page: ${stripMarkdownExtension(publishedFileTitle || scopeFileLabel)}.`;
  const publishChangeSummary = selectedScopeChanged
    ? `This will replace the existing ${publishedScopeLabel} publish with a ${selectedScopeLabel} publish at the same URL.`
    : hasPublishedPage
      ? `This updates the existing ${publishedScopeLabel} publish at the same URL.`
      : publishScopeSummary;
  const publishedTime = formatPublishedTime(publishedAt);
  const summary = [
    publishBlockerMessage || publishChangeSummary,
    !blocked && hasPublishedPage && publishedTime ? `Published ${publishedTime}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const primaryLabel = publishing
    ? "Publishing..."
    : !hasPublishedPage
      ? publishScope === "project"
        ? "Publish project"
        : "Publish current page"
      : selectedScopeChanged
        ? publishScope === "project"
          ? "Republish as project"
          : "Republish as current page"
        : publishedScope === "project"
          ? "Update project"
          : "Update current page";
  const disabledReason = publishing
    ? "Publishing is already in progress."
    : blocked
      ? (publishBlockerMessage ?? "")
      : "";
  const canSubmit = tabulaPlusEnabled && !publishing && !blocked;
  const status: PublishStatus = requiresPlus
    ? "plus-required"
    : blocked
      ? "blocked"
      : publishing
        ? "publishing"
        : hasPublishedPage
          ? "published"
          : "ready";
  const managementActions: PublishManagementActionViewModel[] = hasPublishedPage
    ? [
        ...(canRepublishSnapshot
          ? [
              {
                id: "update" as const,
                label: primaryLabel,
                disabled: !canSubmit,
                disabledReason,
              },
            ]
          : []),
        {
          id: "view" as const,
          label: "View page",
          disabled: false,
          disabledReason: "",
        },
        {
          id: "copy" as const,
          label: "Copy link",
          disabled: false,
          disabledReason: "",
        },
        ...(canRepublishSnapshot
          ? [
              {
                id: "changeScope" as const,
                label: "Change scope",
                disabled: false,
                disabledReason: "",
              },
              {
                id: "unpublish" as const,
                label: unpublishing ? "Unpublishing..." : "Unpublish",
                disabled: unpublishing,
                disabledReason: unpublishing ? "Unpublishing is already in progress." : "",
              },
            ]
          : []),
      ]
    : [];

  return {
    blocked,
    canSubmit,
    details: {
      filesLabel,
      publishedFilesLabel,
      publishedScopeTitle,
      selectedScopeTitle,
    },
    disabledReason,
    hasPublishedPage,
    headingDescription: requiresPlus
      ? "Public pages, project publishing, and durable agent handoff belong to Tabula +."
      : hasPublishedPage
        ? "Manage the read-only page at this URL."
        : "Choose what goes live, then create a read-only page.",
    headingTitle: requiresPlus
      ? `Publish with ${PRODUCT_PLUS_NAME}`
      : hasPublishedPage
        ? "Published page"
        : "Publish a public page",
    managementActions,
    primaryLabel,
    readinessLabel,
    publishResultSummary,
    publishedScopeSummary,
    publishedTime,
    publicUrlPreview,
    requiresPlus,
    scopeCards: [
      {
        scope: "file",
        active: publishScope === "file",
        title: "Current page",
        detail: scopeFileLabel,
      },
      {
        scope: "project",
        active: publishScope === "project",
        title: "Project",
        detail: getFileCountLabel(publishFileCount),
      },
    ],
    selectedScopeChanged,
    status,
    summary,
  };
};
