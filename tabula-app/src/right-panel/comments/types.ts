import type { RightPanelCommentGroup as CoreRightPanelCommentGroup } from "@tabula-md/tabula";
import type { FileComment, WorkspaceFile } from "../../workspace/workspaceStorage";
import type { WorkspaceInterfaceCopy } from "../../workspace/workspaceInterfaceLocale";

export type RightPanelCommentGroup = CoreRightPanelCommentGroup<WorkspaceFile, FileComment>;

export type FormatCommentDate = (isoDate: string) => string;

export type RightPanelCommentsCopy = WorkspaceInterfaceCopy["sidePanel"]["comments"];
