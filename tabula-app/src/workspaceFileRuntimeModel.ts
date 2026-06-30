import {
  normalizeWorkspaceFileTitleForLookup,
  removeRecordKey,
  restoreFileToList,
  restoreOpenFileId,
} from "@tabula-md/tabula";
import {
  README_FILE_ID,
  STARTER_README_MARKDOWN,
  type WorkspaceFile,
} from "./workspaceStorage";

export {
  normalizeWorkspaceFileTitleForLookup,
  removeRecordKey,
  restoreFileToList,
  restoreOpenFileId,
};

export type WorkspaceFileCreationDraft = {
  title: string;
  text: string;
  viewMode: WorkspaceFile["viewMode"];
  overrides: Partial<WorkspaceFile>;
};

export const findWorkspaceAboutFile = (files: WorkspaceFile[]) =>
  files.find((file) => file.id === README_FILE_ID) ??
  files.find((file) => normalizeWorkspaceFileTitleForLookup(file) === "readme");

export const getWorkspaceAboutFileDraft = (): WorkspaceFileCreationDraft => ({
  title: "README.md",
  text: STARTER_README_MARKDOWN,
  viewMode: "preview",
  overrides: {
    id: README_FILE_ID,
    lineNumbers: true,
    lineWrapping: true,
    readingWidth: "wide",
  },
});
