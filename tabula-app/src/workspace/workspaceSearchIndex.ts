import { inspectFrontmatterData } from "@tabula-md/tabula";
import type { WorkspaceFileSearchEntry } from "../editor/workspaceFileSearchModel";
import { getWorkspaceFileTabLabels } from "./workspaceDisplayTitles";
import {
  getWorkspaceFilePresentation,
  type WorkspaceFileIconKind,
} from "./workspaceFilePresentation";
import type { WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";

export type WorkspaceSearchIndexEntry = WorkspaceFileSearchEntry & {
  file: WorkspaceFile;
  metadata: Record<string, unknown>;
  body: string;
  preview?: string;
  iconKind: WorkspaceFileIconKind;
};

const asString = (value: unknown) => typeof value === "string" ? value : undefined;
const asStringList = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : undefined;

const getPreview = (value: string) => value
  .replace(/^\s*#{1,6}\s+/gm, "")
  .replace(/[`*_>[\]()]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 120) || undefined;

export const buildWorkspaceSearchIndex = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
): WorkspaceSearchIndexEntry[] => {
  const labels = getWorkspaceFileTabLabels(files, folders);
  return files.map((file) => {
    const label = labels.get(file.id);
    const presentation = getWorkspaceFilePresentation(file);
    const displayPath = label?.fullPath ?? file.title;
    const fallbackTitle = label?.displayTitle ?? file.title;

    if (presentation.kind === "markdown") {
      const inspection = inspectFrontmatterData(file.text);
      const metadata = inspection.metadata;
      return {
        file,
        fileId: file.id,
        displayPath,
        title: asString(metadata.title) ?? fallbackTitle,
        description: asString(metadata.description),
        type: asString(metadata.type),
        tags: asStringList(metadata.tags),
        resource: asString(metadata.resource),
        markdown: file.text,
        metadata,
        body: inspection.body,
        preview: getPreview(inspection.body),
        iconKind: presentation.icon,
      };
    }

    if (presentation.viewer === "text") {
      const body = presentation.text ?? "";
      return {
        file,
        fileId: file.id,
        displayPath,
        title: fallbackTitle,
        markdown: body,
        metadata: {},
        body,
        preview: getPreview(body),
        iconKind: presentation.icon,
      };
    }

    return {
      file,
      fileId: file.id,
      displayPath,
      title: fallbackTitle,
      metadata: {},
      body: "",
      iconKind: presentation.icon,
    };
  });
};
