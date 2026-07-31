import {
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isMdxImportFileName,
  isSupportedImportFileDescriptor,
  type ImportedWorkspaceFileDraft as CoreImportedWorkspaceFileDraft,
  type TextFileDownloadDraft,
  type WorkspaceFilePreferenceDefaults as CoreWorkspaceFilePreferenceDefaults,
} from "@tabula-md/tabula";

export {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isMdxImportFileName,
  isSupportedImportFileDescriptor,
};

export type WorkspaceFilePreferenceDefaults = CoreWorkspaceFilePreferenceDefaults<
  WorkspaceFile["viewMode"],
  WorkspaceFile["readingWidth"]
>;

export type ImportedWorkspaceFileDraft = CoreImportedWorkspaceFileDraft<
  WorkspaceFile["viewMode"],
  WorkspaceFile["readingWidth"]
>;
export type { TextFileDownloadDraft };
