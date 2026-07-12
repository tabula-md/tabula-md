import type { TextPatch } from "@tabula-md/tabula";
import { mapCommentAnchorThroughPatches } from "./commentAnchors";
import type { FileComment } from "./workspaceStorage";

export const mapSessionCommentAnchors = ({
  comments,
  isRoomSession,
  oldDocumentLength,
  patches,
}: {
  comments: readonly FileComment[];
  isRoomSession: boolean;
  oldDocumentLength: number;
  patches: readonly TextPatch[];
}) => {
  if (isRoomSession || patches.length === 0) return comments;
  let changed = false;
  const next = comments.map((comment) => {
    const mapped = mapCommentAnchorThroughPatches(comment, patches, oldDocumentLength);
    changed = changed || mapped !== comment;
    return mapped;
  });
  return changed ? next : comments;
};
