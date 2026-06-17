import { buildLlmsFullTxt, buildLlmsTxt, buildMarkdownBundle, buildPublishBundle } from "./agentExports";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

const PUBLISH_STORAGE_KEY = "tabula.published-snapshots.v1";
const PUBLISH_LATEST_KEY = "tabula.latest-published-snapshot.v1";

export type PublishedSnapshot = {
  id: string;
  createdAt: string;
  activeFileId: string;
  fileCount: number;
  files: MarkdownFile[];
  commentsByFileId: Record<string, FileComment[]>;
  urls: {
    page: string;
    llmsTxt: string;
    llmsFullTxt: string;
  };
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
  const snapshotFiles = files.map((file) => ({ ...file }));
  const snapshotComments = JSON.parse(JSON.stringify(commentsByFileId)) as Record<string, FileComment[]>;
  const baseUrl = `${origin}/p/${encodeURIComponent(id)}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    activeFileId,
    fileCount: snapshotFiles.length,
    files: snapshotFiles,
    commentsByFileId: snapshotComments,
    urls: {
      page: baseUrl,
      llmsTxt: `${baseUrl}/llms.txt`,
      llmsFullTxt: `${baseUrl}/llms-full.txt`,
    },
    llmsTxt: buildLlmsTxt(snapshotFiles, activeFileId),
    llmsFullTxt: buildLlmsFullTxt(snapshotFiles, activeFileId, snapshotComments),
    markdownBundle: buildMarkdownBundle(snapshotFiles),
    publishBundle: buildPublishBundle(snapshotFiles, activeFileId, snapshotComments),
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
