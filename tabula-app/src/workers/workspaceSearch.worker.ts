/// <reference lib="webworker" />

import type { SearchOptions } from "../editor/editorSearchModel";
import { searchWorkspaceFiles } from "../editor/workspaceSearchModel";

type WorkspaceSearchFile = { id: string; text: string; title: string };

type WorkspaceSearchRequest =
  | {
      type: "search";
      options: SearchOptions;
      query: string;
      requestId: number;
    }
  | {
      type: "sync-files";
      fileIds: string[];
      files: WorkspaceSearchFile[];
      removedFileIds: string[];
    };

const filesById = new Map<string, WorkspaceSearchFile>();
let fileIds: string[] = [];

self.onmessage = (event: MessageEvent<WorkspaceSearchRequest>) => {
  const request = event.data;
  if (request.type === "sync-files") {
    fileIds = request.fileIds;
    for (const fileId of request.removedFileIds) filesById.delete(fileId);
    for (const file of request.files) filesById.set(file.id, file);
    return;
  }

  self.postMessage({
    requestId: request.requestId,
    result: searchWorkspaceFiles(
      fileIds.flatMap((fileId) => filesById.get(fileId) ?? []),
      request.query,
      request.options,
    ),
  });
};
