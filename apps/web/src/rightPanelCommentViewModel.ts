import type { FileComment, MarkdownFile } from "./workspaceStorage";

export type CommentScope = "current" | "all";

export type RightPanelCommentGroup = {
  file: MarkdownFile;
  comments: FileComment[];
};

type RightPanelCommentGroups = {
  openCommentGroups: RightPanelCommentGroup[];
  resolvedCommentGroups: RightPanelCommentGroup[];
  openCommentCount: number;
};

type RightPanelCommentScopeModelArgs = {
  activeFile?: MarkdownFile;
  activeFileId: string;
  activeFileTitle: string;
  openCommentGroups: RightPanelCommentGroup[];
  resolvedCommentGroups: RightPanelCommentGroup[];
  commentScope: CommentScope;
};

export const stripMarkdownExtension = (title: string) => title.replace(/\.md$/i, "");

const getFileComments = (commentsByFileId: Record<string, FileComment[]>, fileId: string) =>
  commentsByFileId[fileId] ?? [];

const getCommentActivityTime = (comment: FileComment) => {
  const replyTimes = (comment.replies ?? []).map((reply) => Date.parse(reply.createdAt)).filter(Number.isFinite);
  return Math.max(Date.parse(comment.createdAt) || 0, ...replyTimes);
};

const getGroupActivityTime = (group: RightPanelCommentGroup) =>
  Math.max(0, ...group.comments.map((comment) => getCommentActivityTime(comment)));

const sortCommentGroupsByActivity = (groups: RightPanelCommentGroup[]) =>
  groups
    .map((group) => ({
      ...group,
      comments: [...group.comments].sort((first, second) => getCommentActivityTime(second) - getCommentActivityTime(first)),
    }))
    .sort((first, second) => getGroupActivityTime(second) - getGroupActivityTime(first));

export const getRightPanelCommentGroups = (
  files: MarkdownFile[],
  commentsByFileId: Record<string, FileComment[]>,
): RightPanelCommentGroups => {
  const openCommentGroups = files
    .map((file) => ({
      file,
      comments: getFileComments(commentsByFileId, file.id).filter((comment) => !comment.resolved),
    }))
    .filter((group) => group.comments.length > 0);
  const resolvedCommentGroups = files
    .map((file) => ({
      file,
      comments: getFileComments(commentsByFileId, file.id).filter((comment) => comment.resolved),
    }))
    .filter((group) => group.comments.length > 0);

  return {
    openCommentGroups,
    resolvedCommentGroups,
    openCommentCount: openCommentGroups.reduce((total, group) => total + group.comments.length, 0),
  };
};

export const getRightPanelCommentScopeModel = ({
  activeFile,
  activeFileId,
  activeFileTitle,
  openCommentGroups,
  resolvedCommentGroups,
  commentScope,
}: RightPanelCommentScopeModelArgs) => {
  const activeOpenCommentGroup = openCommentGroups.find((group) => group.file.id === activeFileId);
  const activeResolvedCommentGroup = resolvedCommentGroups.find((group) => group.file.id === activeFileId);
  const scopedOpenCommentGroups =
    commentScope === "current"
      ? activeOpenCommentGroup
        ? [activeOpenCommentGroup]
        : []
      : sortCommentGroupsByActivity(openCommentGroups);
  const scopedResolvedCommentGroups =
    commentScope === "current"
      ? activeResolvedCommentGroup
        ? [activeResolvedCommentGroup]
        : []
      : sortCommentGroupsByActivity(resolvedCommentGroups);
  const allCommentCount =
    openCommentGroups.reduce((total, group) => total + group.comments.length, 0) +
    resolvedCommentGroups.reduce((total, group) => total + group.comments.length, 0);
  const currentCommentCount =
    (activeOpenCommentGroup?.comments.length ?? 0) + (activeResolvedCommentGroup?.comments.length ?? 0);
  const activeCommentFileTitle = activeFile ? stripMarkdownExtension(activeFileTitle) : "No file open";

  return {
    scopedOpenCommentGroups,
    scopedResolvedCommentGroups,
    hasAnyComments: scopedOpenCommentGroups.length > 0 || scopedResolvedCommentGroups.length > 0,
    hideSingleActiveFileHeader: commentScope === "current",
    commentsTitle: commentScope === "all" ? "All comments" : activeCommentFileTitle,
    switchLabel: commentScope === "all" ? "Current file" : "All comments",
    switchCount: commentScope === "all" ? currentCommentCount : allCommentCount,
  };
};
