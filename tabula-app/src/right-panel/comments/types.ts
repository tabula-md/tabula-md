import type { RightPanelCommentGroup as CoreRightPanelCommentGroup } from "@tabula-md/tabula";
import type { FileComment, WorkspaceFile } from "../../workspaceStorage";
import type { WorkspaceInterfaceCopy } from "../../workspaceInterfaceLocale";

export type RightPanelCommentGroup = CoreRightPanelCommentGroup<WorkspaceFile, FileComment>;

export type FormatCommentDate = (isoDate: string) => string;

export type RightPanelCommentsCopy = WorkspaceInterfaceCopy["sidePanel"]["comments"];
