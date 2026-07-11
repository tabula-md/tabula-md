import type { FileComment, WorkspaceFile } from "../../../workspaceStorage";
import type { RightPanelCommentGroup } from "./types";

export type CommentVirtualRow =
  | {
      key: string;
      type: "group-header";
      group: RightPanelCommentGroup;
      variant: "open" | "resolved";
    }
  | {
      key: string;
      type: "comment";
      file: WorkspaceFile;
      comment: FileComment;
      variant: "open" | "resolved";
    }
  | {
      key: "resolved-header";
      type: "resolved-header";
      count: number;
    };

type GetCommentVirtualRowsOptions = {
  activeFileId: string;
  openCommentGroups: RightPanelCommentGroup[];
  resolvedCommentGroups: RightPanelCommentGroup[];
  hideSingleActiveFileHeader: boolean;
  collapsedCommentFileIds: Set<string>;
  showResolved: boolean;
};

const appendGroupRows = (
  rows: CommentVirtualRow[],
  group: RightPanelCommentGroup,
  variant: "open" | "resolved",
  hideFileHeader: boolean,
  collapsedCommentFileIds: Set<string>,
) => {
  if (!hideFileHeader) {
    rows.push({
      key: `${variant}:group:${group.file.id}`,
      type: "group-header",
      group,
      variant,
    });
  }

  if (!hideFileHeader && collapsedCommentFileIds.has(group.file.id)) return;
  for (const comment of group.comments) {
    rows.push({
      key: `${variant}:comment:${comment.id}`,
      type: "comment",
      file: group.file,
      comment,
      variant,
    });
  }
};

export const getCommentVirtualRows = ({
  activeFileId,
  openCommentGroups,
  resolvedCommentGroups,
  hideSingleActiveFileHeader,
  collapsedCommentFileIds,
  showResolved,
}: GetCommentVirtualRowsOptions) => {
  const rows: CommentVirtualRow[] = [];
  for (const group of openCommentGroups) {
    appendGroupRows(rows, group, "open", hideSingleActiveFileHeader, collapsedCommentFileIds);
  }

  if (resolvedCommentGroups.length === 0) return rows;
  rows.push({
    key: "resolved-header",
    type: "resolved-header",
    count: resolvedCommentGroups.reduce((total, group) => total + group.comments.length, 0),
  });
  if (!showResolved) return rows;

  const hideResolvedFileHeader =
    hideSingleActiveFileHeader &&
    resolvedCommentGroups.length === 1 &&
    resolvedCommentGroups[0]?.file.id === activeFileId;
  for (const group of resolvedCommentGroups) {
    appendGroupRows(rows, group, "resolved", hideResolvedFileHeader, collapsedCommentFileIds);
  }
  return rows;
};
