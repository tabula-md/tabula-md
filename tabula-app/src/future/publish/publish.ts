import { buildLlmsFullTxt, buildLlmsTxt, buildMarkdownBundle, buildPublishBundle } from "../../agentExports";
import type { FileComment, WorkspaceFile } from "../../workspaceStorage";

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
  scope?: PublishScope;
  ownerName?: string;
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
  fileId?: string;
};

export type PublishScope = "file" | "project";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getFileDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

export const getEmptyPublishFiles = (files: WorkspaceFile[]) => files.filter((file) => file.text.trim().length === 0);

export const getEmptyPublishFilesMessage = (files: WorkspaceFile[], scope: PublishScope) => {
  const emptyFiles = getEmptyPublishFiles(files);
  const firstEmptyFile = emptyFiles[0];

  if (!firstEmptyFile) {
    return "";
  }

  const firstTitle = getFileDisplayTitle(firstEmptyFile.title);
  if (scope === "file" || emptyFiles.length === 1) {
    return `Add content to ${firstTitle} before publishing.`;
  }

  const remainingEmptyFileCount = emptyFiles.length - 1;
  const remainingFileLabel = remainingEmptyFileCount === 1 ? "file" : "files";
  return `Add content to ${firstTitle} and ${remainingEmptyFileCount} other empty project ${remainingFileLabel} before publishing.`;
};

export type PublishPayload = {
  title?: string;
  ownerName?: string;
  activeFileId: string;
  files: PublishedFile[];
  commentsByFileId: Record<string, FileComment[]>;
  llmsTxt: string;
  llmsFullTxt: string;
  markdownBundle: string;
  publishBundle: string;
};

type PublishServiceUrls = {
  page: string;
  llmsTxt: string;
  llmsFullTxt: string;
  appPage?: string;
};

type PublishCreateResponse = {
  publishId: string;
  createdAt: string;
  updatedAt: string;
  urls: PublishServiceUrls;
  ownerToken: string;
};

type PublishUpdateResponse = {
  publishId: string;
  createdAt: string;
  updatedAt: string;
  urls: PublishServiceUrls;
};

type PublicPublishResponse = Omit<PublishPayload, "markdownBundle" | "publishBundle"> & {
  publishId: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  urls: PublishServiceUrls;
  markdownBundle?: string;
  publishBundle?: string;
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

export const getPublishRoute = (pathname: string, search = ""): PublishRoute | null => {
  const match = pathname.match(/^\/p\/([^/]+)(?:\/(llms\.txt|llms-full\.txt))?\/?$/);
  if (!match) {
    return null;
  }

  const output = (match[2] as PublishRoute["output"] | undefined) ?? "page";
  const fileId = output === "page" ? new URLSearchParams(search).get("file")?.trim() : undefined;

  return {
    snapshotId: decodeURIComponent(match[1]),
    output,
    ...(fileId ? { fileId } : {}),
  };
};

export const getConfiguredPublishServiceUrl = () => {
  const configuredUrl = import.meta.env.VITE_TABULA_PUBLISH_URL as string | undefined;
  return configuredUrl ? trimTrailingSlash(configuredUrl) : null;
};

export const createPublishedSnapshot = ({
  id,
  origin,
  scope,
  ownerName,
  files,
  activeFileId,
  commentsByFileId,
}: {
  id: string;
  origin: string;
  scope?: PublishScope;
  ownerName?: string;
  files: WorkspaceFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
}): PublishedSnapshot => {
  const payload = createPublishPayload({ ownerName, files, activeFileId, commentsByFileId });
  const baseUrl = `${origin}/p/${encodeURIComponent(id)}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    ...(scope ? { scope } : {}),
    ...(payload.ownerName ? { ownerName: payload.ownerName } : {}),
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
  scope,
  ownerName,
  files,
  activeFileId,
  commentsByFileId,
  fetchImpl = fetch,
}: {
  serviceUrl: string;
  origin: string;
  scope?: PublishScope;
  ownerName?: string;
  files: WorkspaceFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  fetchImpl?: typeof fetch;
}): Promise<PublishedSnapshot> => {
  const publishServiceUrl = trimTrailingSlash(serviceUrl);
  const payload = createPublishPayload({ ownerName, files, activeFileId, commentsByFileId });
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

  return snapshotFromServicePublish({
    publish: {
      ...payload,
      publishId: publish.publishId,
      createdAt: publish.createdAt,
      updatedAt: publish.updatedAt,
      fileCount: payload.files.length,
      urls: publish.urls,
    },
    origin,
    scope,
    ownerToken: publish.ownerToken,
  });
};

export const republishServerPublishedSnapshot = async ({
  serviceUrl,
  origin,
  scope,
  ownerName,
  snapshot,
  files,
  activeFileId,
  commentsByFileId,
  fetchImpl = fetch,
}: {
  serviceUrl: string;
  origin: string;
  scope?: PublishScope;
  ownerName?: string;
  snapshot: PublishedSnapshot;
  files: WorkspaceFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  fetchImpl?: typeof fetch;
}): Promise<PublishedSnapshot> => {
  if (!snapshot.ownerToken) {
    throw new Error("Publish failed: missing owner token");
  }

  const publishServiceUrl = trimTrailingSlash(serviceUrl);
  const payload = createPublishPayload({ ownerName, files, activeFileId, commentsByFileId });
  const response = await fetchImpl(`${publishServiceUrl}/v1/publishes/${encodeURIComponent(snapshot.id)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${snapshot.ownerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Publish failed: ${await readPublishError(response)}`);
  }

  const updated = validatePublishUpdateResponse((await response.json()) as unknown);
  return snapshotFromServicePublish({
    publish: {
      ...payload,
      publishId: updated.publishId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      fileCount: payload.files.length,
      urls: updated.urls,
    },
    origin,
    scope,
    ownerToken: snapshot.ownerToken,
  });
};

export const unpublishServerPublishedSnapshot = async ({
  serviceUrl,
  snapshot,
  fetchImpl = fetch,
}: {
  serviceUrl: string;
  snapshot: PublishedSnapshot;
  fetchImpl?: typeof fetch;
}): Promise<void> => {
  if (!snapshot.ownerToken) {
    throw new Error("Publish failed: missing owner token");
  }

  const publishServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${publishServiceUrl}/v1/publishes/${encodeURIComponent(snapshot.id)}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${snapshot.ownerToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Publish failed: ${await readPublishError(response)}`);
  }
};

export const readServerPublishedSnapshot = async ({
  serviceUrl,
  origin,
  snapshotId,
  fetchImpl = fetch,
}: {
  serviceUrl: string;
  origin: string;
  snapshotId: string;
  fetchImpl?: typeof fetch;
}): Promise<PublishedSnapshot | null> => {
  const publishServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${publishServiceUrl}/v1/publishes/${encodeURIComponent(snapshotId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Publish failed: ${await readPublishError(response)}`);
  }

  const publish = validatePublicPublishResponse((await response.json()) as unknown);
  return snapshotFromServicePublish({ publish, origin });
};

const snapshotFromServicePublish = ({
  publish,
  origin,
  scope,
  ownerToken,
}: {
  publish: PublicPublishResponse;
  origin: string;
  scope?: PublishScope;
  ownerToken?: string;
}): PublishedSnapshot => {
  const pageUrl = publish.urls.appPage ?? `${origin}/p/${encodeURIComponent(publish.publishId)}`;
  return {
    id: publish.publishId,
    createdAt: publish.createdAt,
    updatedAt: publish.updatedAt,
    ...(scope ? { scope } : {}),
    ...(publish.ownerName ? { ownerName: publish.ownerName } : {}),
    activeFileId: publish.activeFileId,
    fileCount: publish.fileCount,
    files: publish.files,
    commentsByFileId: publish.commentsByFileId,
    urls: {
      page: pageUrl,
      llmsTxt: publish.urls.llmsTxt,
      llmsFullTxt: publish.urls.llmsFullTxt,
    },
    servicePageUrl: publish.urls.page,
    ...(ownerToken ? { ownerToken } : {}),
    llmsTxt: publish.llmsTxt,
    llmsFullTxt: publish.llmsFullTxt,
    markdownBundle: publish.markdownBundle ?? "",
    publishBundle: publish.publishBundle ?? "",
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

export const deletePublishedSnapshot = (snapshotId: string) => {
  const snapshots = readSnapshotMap();
  delete snapshots[snapshotId];
  writeSnapshotMap(snapshots);
  if (window.localStorage.getItem(PUBLISH_LATEST_KEY) === snapshotId) {
    window.localStorage.removeItem(PUBLISH_LATEST_KEY);
  }
};

export const createPublishPayload = ({
  ownerName,
  files,
  activeFileId,
  commentsByFileId,
}: {
  ownerName?: string;
  files: WorkspaceFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
}): PublishPayload => {
  const emptyPublishFiles = getEmptyPublishFiles(files);
  if (emptyPublishFiles.length > 0) {
    throw new Error(getEmptyPublishFilesMessage(files, "project"));
  }

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const publishActiveFileId = activeFile?.id ?? activeFileId;
  const snapshotFiles = files.map(toPublishedFile);
  const snapshotComments = toPublishedComments(snapshotFiles, commentsByFileId);
  const normalizedOwnerName = ownerName?.trim();

  return {
    ...(activeFile?.title ? { title: activeFile.title } : {}),
    ...(normalizedOwnerName ? { ownerName: normalizedOwnerName } : {}),
    activeFileId: publishActiveFileId,
    files: snapshotFiles,
    commentsByFileId: snapshotComments,
    llmsTxt: buildLlmsTxt(files, publishActiveFileId),
    llmsFullTxt: buildLlmsFullTxt(files, publishActiveFileId, commentsByFileId),
    markdownBundle: buildMarkdownBundle(files),
    publishBundle: buildPublishBundle(files, publishActiveFileId, commentsByFileId),
  };
};

const toPublishedFile = (file: WorkspaceFile): PublishedFile => ({
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
  return {
    publishId: requireNonEmptyString(value.publishId, "publishId"),
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    updatedAt: requireNonEmptyString(value.updatedAt, "updatedAt"),
    ownerToken: requireNonEmptyString(value.ownerToken, "ownerToken"),
    urls: validatePublishServiceUrls(value.urls),
  };
};

const validatePublishUpdateResponse = (value: unknown): PublishUpdateResponse => {
  if (!isRecord(value) || !isRecord(value.urls)) {
    throw new Error("Publish failed: invalid service response");
  }
  return {
    publishId: requireNonEmptyString(value.publishId, "publishId"),
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    updatedAt: requireNonEmptyString(value.updatedAt, "updatedAt"),
    urls: validatePublishServiceUrls(value.urls),
  };
};

const validatePublicPublishResponse = (value: unknown): PublicPublishResponse => {
  if (!isRecord(value) || !Array.isArray(value.files) || !isRecord(value.commentsByFileId) || !isRecord(value.urls)) {
    throw new Error("Publish failed: invalid service response");
  }

  const files = value.files.map((file) => {
    if (!isRecord(file)) {
      throw new Error("Publish failed: invalid service response");
    }
    return {
      id: requireString(file.id, "file.id"),
      title: requireString(file.title, "file.title"),
      text: requireString(file.text, "file.text"),
    };
  });

  return {
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.ownerName === "string" ? { ownerName: value.ownerName } : {}),
    publishId: requireNonEmptyString(value.publishId, "publishId"),
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    updatedAt: requireNonEmptyString(value.updatedAt, "updatedAt"),
    fileCount: typeof value.fileCount === "number" ? value.fileCount : files.length,
    activeFileId: requireNonEmptyString(value.activeFileId, "activeFileId"),
    files,
    commentsByFileId: value.commentsByFileId as Record<string, FileComment[]>,
    urls: validatePublishServiceUrls(value.urls),
    llmsTxt: requireString(value.llmsTxt, "llmsTxt"),
    llmsFullTxt: requireString(value.llmsFullTxt, "llmsFullTxt"),
    ...(typeof value.markdownBundle === "string" ? { markdownBundle: value.markdownBundle } : {}),
    ...(typeof value.publishBundle === "string" ? { publishBundle: value.publishBundle } : {}),
  };
};

const validatePublishServiceUrls = (value: Record<string, unknown>): PublishServiceUrls => ({
  page: requireNonEmptyString(value.page, "urls.page"),
  llmsTxt: requireNonEmptyString(value.llmsTxt, "urls.llmsTxt"),
  llmsFullTxt: requireNonEmptyString(value.llmsFullTxt, "urls.llmsFullTxt"),
  ...(typeof value.appPage === "string" ? { appPage: value.appPage } : {}),
});

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new Error(`Publish failed: missing ${fieldName}`);
  }
  return value;
};

const requireNonEmptyString = (value: unknown, fieldName: string) => {
  const text = requireString(value, fieldName);
  if (!text) {
    throw new Error(`Publish failed: missing ${fieldName}`);
  }
  return text;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
