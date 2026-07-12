export type CommentScope = "current" | "all";

export type RightPanelCommentFile = {
  id: string;
  title: string;
};

export type RightPanelComment = {
  id: string;
  createdAt: string;
  resolved?: boolean;
  replies?: {
    id?: string;
    body?: string;
    createdAt: string;
  }[];
};

export type RightPanelCommentGroup<
  TFile extends RightPanelCommentFile = RightPanelCommentFile,
  TComment extends RightPanelComment = RightPanelComment,
> = {
  file: TFile;
  comments: TComment[];
};

type RightPanelCommentGroups<
  TFile extends RightPanelCommentFile,
  TComment extends RightPanelComment,
> = {
  openCommentGroups: RightPanelCommentGroup<TFile, TComment>[];
  resolvedCommentGroups: RightPanelCommentGroup<TFile, TComment>[];
};

type RightPanelCommentScopeModelArgs<
  TFile extends RightPanelCommentFile,
  TComment extends RightPanelComment,
> = {
  activeFileId: string;
  openCommentGroups: RightPanelCommentGroup<TFile, TComment>[];
  resolvedCommentGroups: RightPanelCommentGroup<TFile, TComment>[];
  commentScope: CommentScope;
};

export const stripMarkdownExtension = (title: string) => title.replace(/\.md$/i, "");

const getFileComments = <TComment extends RightPanelComment>(
  commentsByFileId: Record<string, TComment[]>,
  fileId: string,
) =>
  commentsByFileId[fileId] ?? [];

const getCommentActivityTime = (comment: RightPanelComment) => {
  const replyTimes = (comment.replies ?? []).map((reply) => Date.parse(reply.createdAt)).filter(Number.isFinite);
  return Math.max(Date.parse(comment.createdAt) || 0, ...replyTimes);
};

const getGroupActivityTime = (group: RightPanelCommentGroup) =>
  Math.max(0, ...group.comments.map((comment) => getCommentActivityTime(comment)));

const sortCommentGroupsByActivity = <
  TFile extends RightPanelCommentFile,
  TComment extends RightPanelComment,
>(
  groups: RightPanelCommentGroup<TFile, TComment>[],
) =>
  groups
    .map((group) => ({
      ...group,
      comments: [...group.comments].sort((first, second) => getCommentActivityTime(second) - getCommentActivityTime(first)),
    }))
    .sort((first, second) => getGroupActivityTime(second) - getGroupActivityTime(first));

export const getRightPanelCommentGroups = <
  TFile extends RightPanelCommentFile,
  TComment extends RightPanelComment,
>(
  files: TFile[],
  commentsByFileId: Record<string, TComment[]>,
): RightPanelCommentGroups<TFile, TComment> => {
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
  };
};

export const getRightPanelCommentScopeModel = <
  TFile extends RightPanelCommentFile,
  TComment extends RightPanelComment,
>({
  activeFileId,
  openCommentGroups,
  resolvedCommentGroups,
  commentScope,
}: RightPanelCommentScopeModelArgs<TFile, TComment>) => {
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
  return {
    scopedOpenCommentGroups,
    scopedResolvedCommentGroups,
    hasAnyComments: scopedOpenCommentGroups.length > 0 || scopedResolvedCommentGroups.length > 0,
    hideSingleActiveFileHeader: commentScope === "current",
  };
};
