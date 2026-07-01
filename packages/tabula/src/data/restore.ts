import { validateShareSnapshotPayload, type ShareSnapshotPayload } from "../shareSnapshotPayload";

export const restoreShareSnapshotPayload = (value: unknown): ShareSnapshotPayload =>
  validateShareSnapshotPayload(value);
