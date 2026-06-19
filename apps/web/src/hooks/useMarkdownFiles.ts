import { useEffect, useMemo, useState } from "react";
import type { FileViewMode, MarkdownFile, ReadingWidth } from "../workspaceStorage";

type UseMarkdownFilesOptions = {
  initialFiles: MarkdownFile[];
  initialOpenFileIds: string[];
  initialActiveFileId: string;
  readmeFileId: string;
  createFile: (index: number, overrides?: Partial<MarkdownFile>) => MarkdownFile;
};

type CloseFileResult = {
  closedActiveFile: boolean;
  nextActiveFile?: MarkdownFile;
};

export type RenameFileResult =
  | {
      ok: true;
      title: string;
    }
  | {
      ok: false;
      reason: "empty" | "duplicate";
      title: string;
      message: string;
    };

export const normalizeMarkdownFileTitle = (title: string) => {
  const trimmedTitle = title.trim().replace(/\s+/g, " ");
  if (!trimmedTitle) {
    return "Untitled.md";
  }

  return /\.[A-Za-z0-9]+$/.test(trimmedTitle) ? trimmedTitle : `${trimmedTitle}.md`;
};

export function useMarkdownFiles({
  initialFiles,
  initialOpenFileIds,
  initialActiveFileId,
  readmeFileId,
  createFile,
}: UseMarkdownFilesOptions) {
  const [files, setFiles] = useState<MarkdownFile[]>(() => initialFiles);
  const [openFileIds, setOpenFileIds] = useState<string[]>(() =>
    initialOpenFileIds.filter((fileId) => initialFiles.some((file) => file.id === fileId)),
  );
  const [activeFileId, setActiveFileId] = useState(() => initialActiveFileId);
  const openFiles = useMemo(
    () =>
      openFileIds
        .map((fileId) => files.find((file) => file.id === fileId))
        .filter((file): file is MarkdownFile => Boolean(file)),
    [files, openFileIds],
  );
  const activeFile = useMemo(
    () => openFiles.find((file) => file.id === activeFileId),
    [activeFileId, openFiles],
  );

  const getAvailableFileTitle = (baseTitle: string) => {
    const normalizedTitle = normalizeMarkdownFileTitle(baseTitle);
    const existingTitles = new Set(files.map((file) => file.title.toLowerCase()));
    if (!existingTitles.has(normalizedTitle.toLowerCase())) {
      return normalizedTitle;
    }

    const extensionMatch = normalizedTitle.match(/(\.[A-Za-z0-9]+)$/);
    const extension = extensionMatch?.[1] ?? "";
    const titleWithoutExtension = extension ? normalizedTitle.slice(0, -extension.length) : normalizedTitle;
    let index = 2;
    let candidateTitle = `${titleWithoutExtension} ${index}${extension}`;

    while (existingTitles.has(candidateTitle.toLowerCase())) {
      index += 1;
      candidateTitle = `${titleWithoutExtension} ${index}${extension}`;
    }

    return candidateTitle;
  };

  const getNextUserFileIndex = () => files.filter((file) => file.id !== readmeFileId).length + 1;

  useEffect(() => {
    const fileIds = new Set(files.map((file) => file.id));

    setOpenFileIds((currentFileIds) => {
      const nextFileIds = currentFileIds.filter((fileId) => fileIds.has(fileId));
      return nextFileIds.length === currentFileIds.length ? currentFileIds : nextFileIds;
    });
    if (activeFileId && !fileIds.has(activeFileId)) {
      setActiveFileId(openFiles[0]?.id ?? "");
    }
  }, [activeFileId, files, openFiles]);

  useEffect(() => {
    if (!activeFileId || !files.some((file) => file.id === activeFileId)) {
      return;
    }

    setOpenFileIds((currentFileIds) =>
      currentFileIds.includes(activeFileId) ? currentFileIds : [...currentFileIds, activeFileId],
    );
  }, [activeFileId, files]);

  const selectFile = (fileId: string) => {
    const nextFile = files.find((file) => file.id === fileId);
    if (!nextFile) {
      return undefined;
    }

    setOpenFileIds((currentFileIds) =>
      currentFileIds.includes(fileId) ? currentFileIds : [...currentFileIds, fileId],
    );
    setActiveFileId(fileId);
    return nextFile;
  };

  const addFile = () => {
    const nextFile = createFile(getNextUserFileIndex());
    setFiles((currentFiles) => [...currentFiles, nextFile]);
    setOpenFileIds((currentFileIds) => [...currentFileIds, nextFile.id]);
    setActiveFileId(nextFile.id);
    return nextFile;
  };

  const addFileFromContent = (title: string, text: string, viewMode: FileViewMode = "edit") => {
    const nextFile = createFile(getNextUserFileIndex(), {
      title: getAvailableFileTitle(title),
      text,
      viewMode,
    });
    setFiles((currentFiles) => [...currentFiles, nextFile]);
    setOpenFileIds((currentFileIds) => [...currentFileIds, nextFile.id]);
    setActiveFileId(nextFile.id);
    return nextFile;
  };

  const addTemplateFile = (template: { title: string; content: string }) => {
    return addFileFromContent(template.title, template.content, "edit");
  };

  const duplicateFile = (fileId: string) => {
    const sourceFile = files.find((file) => file.id === fileId);
    if (!sourceFile) {
      return undefined;
    }

    const nextFile = createFile(getNextUserFileIndex(), {
      title: getAvailableFileTitle(sourceFile.title),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      connectionStatus: "idle",
    });

    setFiles((currentFiles) => {
      const sourceIndex = currentFiles.findIndex((file) => file.id === fileId);
      if (sourceIndex === -1) {
        return [...currentFiles, nextFile];
      }

      const nextFiles = [...currentFiles];
      nextFiles.splice(sourceIndex + 1, 0, nextFile);
      return nextFiles;
    });
    setOpenFileIds((currentFileIds) => [...currentFileIds, nextFile.id]);
    setActiveFileId(nextFile.id);
    return nextFile;
  };

  const renameFile = (fileId: string, nextRawTitle: string): RenameFileResult => {
    const trimmedTitle = nextRawTitle.trim().replace(/\s+/g, " ");
    if (!trimmedTitle) {
      return {
        ok: false,
        reason: "empty",
        title: "",
        message: "File name cannot be empty.",
      };
    }

    const nextTitle = normalizeMarkdownFileTitle(trimmedTitle);
    const duplicateFile = files.find((file) => file.id !== fileId && file.title.toLowerCase() === nextTitle.toLowerCase());

    if (duplicateFile) {
      return {
        ok: false,
        reason: "duplicate",
        title: nextTitle,
        message: "File name already exists.",
      };
    }

    setFiles((currentFiles) => currentFiles.map((file) => (file.id === fileId ? { ...file, title: nextTitle } : file)));
    return { ok: true, title: nextTitle };
  };

  const closeFile = (fileId: string): CloseFileResult | undefined => {
    const closingIndex = openFileIds.findIndex((openFileId) => openFileId === fileId);
    if (closingIndex === -1) {
      return undefined;
    }

    const remainingOpenFileIds = openFileIds.filter((openFileId) => openFileId !== fileId);
    const closedActiveFile = fileId === activeFile?.id;
    const nextActiveFileId = closedActiveFile
      ? (remainingOpenFileIds[closingIndex] ?? remainingOpenFileIds[closingIndex - 1] ?? remainingOpenFileIds[0])
      : activeFile?.id;
    const nextActiveFile = closedActiveFile
      ? files.find((file) => file.id === nextActiveFileId)
      : activeFile;

    setOpenFileIds(remainingOpenFileIds);

    if (closedActiveFile) {
      setActiveFileId(nextActiveFile?.id ?? "");
    }

    return { closedActiveFile, nextActiveFile };
  };

  const deleteFile = (fileId: string): CloseFileResult | undefined => {
    const deletingFile = files.find((file) => file.id === fileId);
    if (!deletingFile) {
      return undefined;
    }

    const deletedOpenIndex = openFileIds.findIndex((openFileId) => openFileId === fileId);
    const remainingOpenFileIds = openFileIds.filter((openFileId) => openFileId !== fileId);
    const deletedActiveFile = fileId === activeFile?.id;
    const nextActiveFileId = deletedActiveFile
      ? (remainingOpenFileIds[deletedOpenIndex] ?? remainingOpenFileIds[deletedOpenIndex - 1] ?? remainingOpenFileIds[0])
      : activeFile?.id;
    const nextActiveFile = deletedActiveFile
      ? files.find((file) => file.id === nextActiveFileId)
      : activeFile;

    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
    setOpenFileIds(remainingOpenFileIds);

    if (deletedActiveFile) {
      setActiveFileId(nextActiveFile?.id ?? "");
    }

    return { closedActiveFile: deletedActiveFile, nextActiveFile };
  };

  const reorderFiles = (sourceFileId: string, targetFileId: string) => {
    if (sourceFileId === targetFileId) {
      return;
    }

    setOpenFileIds((currentFileIds) => {
      const sourceIndex = currentFileIds.indexOf(sourceFileId);
      const targetIndex = currentFileIds.indexOf(targetFileId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return currentFileIds;
      }

      const nextFileIds = [...currentFileIds];
      const [movedFileId] = nextFileIds.splice(sourceIndex, 1);
      nextFileIds.splice(targetIndex, 0, movedFileId);
      return nextFileIds;
    });
  };

  const moveFile = (fileId: string, direction: -1 | 1) => {
    const currentIndex = openFileIds.indexOf(fileId);
    const targetFileId = openFileIds[currentIndex + direction];

    if (!targetFileId) {
      return;
    }

    reorderFiles(fileId, targetFileId);
  };

  const selectAdjacentFile = (direction: -1 | 1) => {
    if (openFiles.length < 2) {
      return undefined;
    }

    const currentIndex = Math.max(
      0,
      openFiles.findIndex((file) => file.id === activeFile?.id),
    );
    const nextIndex = (currentIndex + direction + openFiles.length) % openFiles.length;
    const nextFile = openFiles[nextIndex];
    setActiveFileId(nextFile.id);
    return nextFile;
  };

  const setActiveFileViewMode = (nextViewMode: FileViewMode) => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, viewMode: nextViewMode } : file)),
    );
  };

  const setActiveFileReadingWidth = (nextReadingWidth: ReadingWidth) => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, readingWidth: nextReadingWidth } : file)),
    );
  };

  const setActiveFileLineWrapping = (nextLineWrapping: boolean) => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, lineWrapping: nextLineWrapping } : file)),
    );
  };

  const setActiveFileLineNumbers = (nextLineNumbers: boolean) => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, lineNumbers: nextLineNumbers } : file)),
    );
  };

  return {
    files,
    openFiles,
    openFileIds,
    setOpenFileIds,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    selectFile,
    addFile,
    addFileFromContent,
    addTemplateFile,
    duplicateFile,
    renameFile,
    closeFile,
    deleteFile,
    reorderFiles,
    moveFile,
    selectAdjacentFile,
    setActiveFileViewMode,
    setActiveFileReadingWidth,
    setActiveFileLineWrapping,
    setActiveFileLineNumbers,
    getAvailableFileTitle,
  };
}
