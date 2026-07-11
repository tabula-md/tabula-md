import {
  createShareSnapshot,
  createShareSnapshotPayload,
  validateShareSnapshotPayload,
  type ShareSnapshot,
  type ShareSnapshotPayload,
  type ShareSnapshotSourceFile,
  type ShareSnapshotSourceFolder,
  type ShareSnapshotComment,
} from "../shareSnapshotPayload";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type SerializeShareSnapshotInput = {
  files: ShareSnapshotSourceFile[];
  folders: ShareSnapshotSourceFolder[];
  rootFolderId: string;
  activeFileId: string;
  commentsByFileId: Record<string, ShareSnapshotComment[]>;
};

export const serializeShareSnapshot = (payload: ShareSnapshotPayload) =>
  textEncoder.encode(JSON.stringify(validateShareSnapshotPayload(payload)));

export const parseShareSnapshot = (bytes: Uint8Array): ShareSnapshotPayload =>
  validateShareSnapshotPayload(JSON.parse(textDecoder.decode(bytes)) as unknown);

export const restoreShareSnapshot = ({
  id,
  url,
  payload,
}: {
  id: string;
  url: string;
  payload: ShareSnapshotPayload;
}): ShareSnapshot =>
  createShareSnapshot({
    id,
    url,
    payload: validateShareSnapshotPayload(payload),
  });

export { createShareSnapshotPayload };
export type { ShareSnapshot, ShareSnapshotPayload };
