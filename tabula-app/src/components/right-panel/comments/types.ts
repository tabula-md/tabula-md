import type { RightPanelCommentGroup as CoreRightPanelCommentGroup } from "@tabula-md/tabula";
import type { FileComment, WorkspaceFile } from "../../../workspaceStorage";

export type RightPanelCommentGroup = CoreRightPanelCommentGroup<WorkspaceFile, FileComment>;

export type FormatCommentDate = (isoDate: string) => string;
