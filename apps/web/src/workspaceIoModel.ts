import { PRODUCT_NAME, WORKSPACE_EXPORT_FILE_PREFIX } from "./product";
import {
  createStoredWorkspace,
  PROJECT_STORAGE_VERSION,
  type FileComment,
  type WorkspaceFile,
} from "./workspaceStorage";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isSupportedImportFileDescriptor,
  type ImportedWorkspaceFileDraft as CoreImportedWorkspaceFileDraft,
  type TextFileDownloadDraft,
  type WorkspaceFilePreferenceDefaults as CoreWorkspaceFilePreferenceDefaults,
} from "@tabula-md/tabula";

export {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
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

export const createWorkspaceProjectDownloadDraft = ({
  activeFileId,
  commentsByFileId,
  files,
  openFileIds,
}: {
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  openFileIds: string[];
}): TextFileDownloadDraft => ({
  fileName: `${WORKSPACE_EXPORT_FILE_PREFIX}-v${PROJECT_STORAGE_VERSION}.json`,
  content: JSON.stringify(
    createStoredWorkspace({
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
    }),
    null,
    2,
  ),
  type: "application/json",
});

export const getUnreadableProjectJsonMessage = () =>
  "This file is not readable JSON.";

export const getUnsupportedProjectSchemaMessage = () =>
  `This JSON does not match the ${PRODUCT_NAME} project v${PROJECT_STORAGE_VERSION} files schema.`;
