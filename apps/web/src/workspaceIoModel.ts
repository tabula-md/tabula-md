import { PRODUCT_NAME, WORKSPACE_EXPORT_FILE_PREFIX } from "./product";
import {
  createStoredWorkspace,
  PROJECT_STORAGE_VERSION,
  type FileComment,
  type WorkspaceFile,
} from "./workspaceStorage";
import { normalizeWorkspaceFileTitle } from "./workspaceModel";

export type WorkspaceFilePreferenceDefaults = {
  newFileViewMode: WorkspaceFile["viewMode"];
  readingWidth: WorkspaceFile["readingWidth"];
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export type TextFileDownloadDraft = {
  fileName: string;
  content: string;
  type: string;
};

export type ImportedWorkspaceFileDraft = {
  title: string;
  text: string;
  viewMode: WorkspaceFile["viewMode"];
  overrides: Partial<WorkspaceFile>;
};

export function getNewFilePreferenceOverrides(
  preferences: WorkspaceFilePreferenceDefaults,
): Partial<WorkspaceFile> {
  return {
    viewMode: preferences.newFileViewMode,
    readingWidth: preferences.readingWidth,
    lineWrapping: preferences.lineWrapping,
    lineNumbers: preferences.lineNumbers,
  };
}

export const isSupportedImportFileDescriptor = (
  file: Pick<File, "name" | "type">,
) => {
  const fileName = file.name.toLowerCase();
  return (
    fileName.endsWith(".md") ||
    fileName.endsWith(".markdown") ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
};

export const createCurrentFileDownloadDraft = (
  file: WorkspaceFile,
): TextFileDownloadDraft => ({
  fileName: file.title,
  content: file.text,
  type: "text/markdown;charset=utf-8",
});

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

export const createImportedWorkspaceFileDraft = (
  fileName: string,
  text: string,
  preferences: WorkspaceFilePreferenceDefaults,
): ImportedWorkspaceFileDraft => ({
  title: normalizeWorkspaceFileTitle(fileName || "Imported.md"),
  text,
  viewMode: preferences.newFileViewMode,
  overrides: getNewFilePreferenceOverrides(preferences),
});

export const getUnreadableProjectJsonMessage = () =>
  "This file is not readable JSON.";

export const getUnsupportedProjectSchemaMessage = () =>
  `This JSON does not match the ${PRODUCT_NAME} project v${PROJECT_STORAGE_VERSION} files schema.`;
