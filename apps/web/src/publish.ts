import { buildLlmsFullTxt, buildLlmsTxt, buildMarkdownBundle, buildPublishBundle } from "./agentExports";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

const PUBLISH_STORAGE_KEY = "tabula.published-snapshots.v1";
const PUBLISH_LATEST_KEY = "tabula.latest-published-snapshot.v1";

export type PublishedFile = {
  id: string;
  title: string;
  text: string;
};

export type PublishedSnapshot = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  activeFileId: string;
  fileCount: number;
  files: PublishedFile[];
  commentsByFileId: Record<string, FileComment[]>;
  urls: {
    page: string;
    llmsTxt: string;
    llmsFullTxt: string;
  };
  servicePageUrl?: string;
  ownerToken?: string;
  llmsTxt: string;
  llmsFullTxt: string;
  markdownBundle: string;
  publishBundle: string;
};

export type PublishRoute = {
  snapshotId: string;
  output: "page" | "llms.txt" | "llms-full.txt";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type PublishPayload = {
  title?: string;
  activeFileId: string;
  files: PublishedFile[];
  commentsByFileId: Record<string, FileComment[]>;
  llmsTxt: string;
  llmsFullTxt: string;
  markdownBundle: string;
  publishBundle: string;
};

type PublishCreateResponse = {
  publishId: string;
  createdAt: string;
  updatedAt: string;
  urls: {
    page: string;
    llmsTxt: string;
    llmsFullTxt: string;
    appPage?: string;
  };
  ownerToken: string;
};

const readSnapshotMap = (): Record<string, PublishedSnapshot> => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PUBLISH_STORAGE_KEY) ?? "{}");
    return isRecord(parsed) ? (parsed as Record<string, PublishedSnapshot>) : {};
  } catch {
    return {};
  }
};

const writeSnapshotMap = (snapshots: Record<string, PublishedSnapshot>) => {
  const latestSnapshots = Object.fromEntries(
    Object.entries(snapshots)
      .sort(([, first], [, second]) => second.createdAt.localeCompare(first.createdAt))
      .slice(0, 20),
  );
  window.localStorage.setItem(PUBLISH_STORAGE_KEY, JSON.stringify(latestSnapshots));
};

export const getPublishRoute = (pathname: string): PublishRoute | null => {
  const match = pathname.match(/^\/p\/([^/]+)(?:\/(llms\.txt|llms-full\.txt))?\/?$/);
  if (!match) {
    return null;
  }

  return {
    snapshotId: decodeURIComponent(match[1]),
    output: (match[2] as PublishRoute["output"] | undefined) ?? "page",
  };
};

export const getConfiguredPublishServiceUrl = () => {
  const configuredUrl = import.meta.env.VITE_TABULA_PUBLISH_URL as string | undefined;
  return configuredUrl ? trimTrailingSlash(configuredUrl) : null;
};

export const createPublishedSnapshot = ({
  id,
  origin,
  files,
  activeFileId,
  commentsByFileId,
}: {
  id: string;
  origin: string;
  files: MarkdownFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
}): PublishedSnapshot => {
  const payload = createPublishPayload({ files, activeFileId, commentsByFileId });
  const baseUrl = `${origin}/p/${encodeURIComponent(id)}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    activeFileId,
    fileCount: payload.files.length,
    files: payload.files,
    commentsByFileId: payload.commentsByFileId,
    urls: {
      page: baseUrl,
      llmsTxt: `${baseUrl}/llms.txt`,
      llmsFullTxt: `${baseUrl}/llms-full.txt`,
    },
    llmsTxt: payload.llmsTxt,
    llmsFullTxt: payload.llmsFullTxt,
    markdownBundle: payload.markdownBundle,
    publishBundle: payload.publishBundle,
  };
};

export const createServerPublishedSnapshot = async ({
  serviceUrl,
  origin,
  files,
  activeFileId,
  commentsByFileId,
  fetchImpl = fetch,
}: {
  serviceUrl: string;
  origin: string;
  files: MarkdownFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  fetchImpl?: typeof fetch;
}): Promise<PublishedSnapshot> => {
  const publishServiceUrl = trimTrailingSlash(serviceUrl);
  const payload = createPublishPayload({ files, activeFileId, commentsByFileId });
  const response = await fetchImpl(`${publishServiceUrl}/v1/publishes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Publish failed: ${await readPublishError(response)}`);
  }

  const created = (await response.json()) as unknown;
  const publish = validatePublishCreateResponse(created);
  const pageUrl = publish.urls.appPage ?? `${origin}/p/${encodeURIComponent(publish.publishId)}`;

  return {
    id: publish.publishId,
    createdAt: publish.createdAt,
    updatedAt: publish.updatedAt,
    activeFileId: payload.activeFileId,
    fileCount: payload.files.length,
    files: payload.files,
    commentsByFileId: payload.commentsByFileId,
    urls: {
      page: pageUrl,
      llmsTxt: publish.urls.llmsTxt,
      llmsFullTxt: publish.urls.llmsFullTxt,
    },
    servicePageUrl: publish.urls.page,
    ownerToken: publish.ownerToken,
    llmsTxt: payload.llmsTxt,
    llmsFullTxt: payload.llmsFullTxt,
    markdownBundle: payload.markdownBundle,
    publishBundle: payload.publishBundle,
  };
};

export const savePublishedSnapshot = (snapshot: PublishedSnapshot) => {
  const snapshots = readSnapshotMap();
  writeSnapshotMap({
    ...snapshots,
    [snapshot.id]: snapshot,
  });
  window.localStorage.setItem(PUBLISH_LATEST_KEY, snapshot.id);
};

export const readPublishedSnapshot = (snapshotId: string) => readSnapshotMap()[snapshotId] ?? null;

export const readLatestPublishedSnapshot = () => {
  const latestSnapshotId = window.localStorage.getItem(PUBLISH_LATEST_KEY);
  return latestSnapshotId ? readPublishedSnapshot(latestSnapshotId) : null;
};

const createPublishPayload = ({
  files,
  activeFileId,
  commentsByFileId,
}: {
  files: MarkdownFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
}): PublishPayload => {
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const publishActiveFileId = activeFile?.id ?? activeFileId;
  const snapshotFiles = files.map(toPublishedFile);
  const snapshotComments = toPublishedComments(snapshotFiles, commentsByFileId);

  return {
    ...(activeFile?.title ? { title: activeFile.title } : {}),
    activeFileId: publishActiveFileId,
    files: snapshotFiles,
    commentsByFileId: snapshotComments,
    llmsTxt: buildLlmsTxt(files, publishActiveFileId),
    llmsFullTxt: buildLlmsFullTxt(files, publishActiveFileId, commentsByFileId),
    markdownBundle: buildMarkdownBundle(files),
    publishBundle: buildPublishBundle(files, publishActiveFileId, commentsByFileId),
  };
};

const toPublishedFile = (file: MarkdownFile): PublishedFile => ({
  id: file.id,
  title: file.title,
  text: file.text,
});

const toPublishedComments = (
  files: PublishedFile[],
  commentsByFileId: Record<string, FileComment[]>,
): Record<string, FileComment[]> => {
  const publishedFileIds = new Set(files.map((file) => file.id));
  const snapshotComments: Record<string, FileComment[]> = {};

  for (const [fileId, comments] of Object.entries(commentsByFileId)) {
    if (!publishedFileIds.has(fileId) || comments.length === 0) {
      continue;
    }
    snapshotComments[fileId] = comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      ...(comment.authorName ? { authorName: comment.authorName } : {}),
      ...(comment.authorColor ? { authorColor: comment.authorColor } : {}),
      ...(comment.quote ? { quote: comment.quote } : {}),
      ...(comment.sourceQuote ? { sourceQuote: comment.sourceQuote } : {}),
      ...(comment.prefix ? { prefix: comment.prefix } : {}),
      ...(comment.suffix ? { suffix: comment.suffix } : {}),
      ...(typeof comment.selectionStart === "number" ? { selectionStart: comment.selectionStart } : {}),
      ...(typeof comment.selectionEnd === "number" ? { selectionEnd: comment.selectionEnd } : {}),
      ...(typeof comment.resolved === "boolean" ? { resolved: comment.resolved } : {}),
      ...(comment.replies
        ? {
            replies: comment.replies.map((reply) => ({
              id: reply.id,
              body: reply.body,
              ...(reply.authorName ? { authorName: reply.authorName } : {}),
              ...(reply.authorColor ? { authorColor: reply.authorColor } : {}),
              createdAt: reply.createdAt,
            })),
          }
        : {}),
      createdAt: comment.createdAt,
    }));
  }

  return snapshotComments;
};

const readPublishError = async (response: Response) => {
  try {
    const parsed = (await response.json()) as unknown;
    if (isRecord(parsed) && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Fall through to the status text below.
  }
  return response.statusText || `HTTP ${response.status}`;
};

const validatePublishCreateResponse = (value: unknown): PublishCreateResponse => {
  if (!isRecord(value) || !isRecord(value.urls)) {
    throw new Error("Publish failed: invalid service response");
  }
  const publishId = requireString(value.publishId, "publishId");
  return {
    publishId,
    createdAt: requireString(value.createdAt, "createdAt"),
    updatedAt: requireString(value.updatedAt, "updatedAt"),
    ownerToken: requireString(value.ownerToken, "ownerToken"),
    urls: {
      page: requireString(value.urls.page, "urls.page"),
      llmsTxt: requireString(value.urls.llmsTxt, "urls.llmsTxt"),
      llmsFullTxt: requireString(value.urls.llmsFullTxt, "urls.llmsFullTxt"),
      ...(typeof value.urls.appPage === "string" ? { appPage: value.urls.appPage } : {}),
    },
  };
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string" || !value) {
    throw new Error(`Publish failed: missing ${fieldName}`);
  }
  return value;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
