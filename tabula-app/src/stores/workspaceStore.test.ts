import { beforeEach, describe, expect, it } from "vitest";
import {
  resetWorkspaceStoreForTests,
  useWorkspaceStore,
} from "./workspaceStore";
import { createWorkspaceRootFolder, type WorkspaceFile } from "../workspaceStorage";

const createTestFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
  id: overrides.id ?? `file-${index}`,
  title: overrides.title ?? `Untitled ${index}.md`,
  text: overrides.text ?? "",
  viewMode: overrides.viewMode ?? "edit",
  readingWidth: overrides.readingWidth ?? "wide",
  splitRatio: overrides.splitRatio,
  lineWrapping: overrides.lineWrapping ?? true,
  lineNumbers: overrides.lineNumbers ?? true,
  bookmarks: overrides.bookmarks ?? [],
  ...overrides,
});

const initializeWorkspaceStore = () => {
  const readme = createTestFile(0, {
    id: "readme",
    title: "README.md",
    text: "# README",
    viewMode: "preview",
  });
  const draft = createTestFile(1, {
    id: "draft",
    title: "Draft.md",
    text: "Draft body",
    viewMode: "edit",
  });

  useWorkspaceStore.getState().initializeWorkspace({
    folders: [createWorkspaceRootFolder()],
    files: [readme, draft],
    openFileIds: [readme.id, draft.id],
    activeFileId: draft.id,
    readmeFileId: readme.id,
    createFile: createTestFile,
  });

  return { readme, draft };
};

describe("workspace store", () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it("keeps the v7 folder tree when the workspace is initialized", () => {
    initializeWorkspaceStore();

    expect(useWorkspaceStore.getState().folders).toEqual([createWorkspaceRootFolder()]);
  });

  it("updates active file text and layout through explicit actions", () => {
    const { draft } = initializeWorkspaceStore();

    useWorkspaceStore.getState().setActiveFileText("Updated body");
    useWorkspaceStore.getState().setActiveFileViewMode("split");
    useWorkspaceStore.getState().setActiveFileReadingWidth("narrow");
    useWorkspaceStore.getState().setActiveFileLineWrapping(false);
    useWorkspaceStore.getState().setActiveFileLineNumbers(false);
    useWorkspaceStore.getState().commitActiveFileSplitRatio(0.9);

    const activeFile = useWorkspaceStore.getState().files.find((file) => file.id === draft.id);

    expect(activeFile).toMatchObject({
      text: "Updated body",
      viewMode: "split",
      readingWidth: "narrow",
      lineWrapping: false,
      lineNumbers: false,
      splitRatio: 0.72,
    });
  });

  it("adds, opens, and activates new files in one store action", () => {
    initializeWorkspaceStore();

    const file = useWorkspaceStore.getState().addFile({ title: "Plan.md", text: "# Plan" });

    expect(useWorkspaceStore.getState().activeFileId).toBe(file.id);
    expect(useWorkspaceStore.getState().openFileIds).toContain(file.id);
    expect(useWorkspaceStore.getState().files.find((candidate) => candidate.id === file.id)).toMatchObject({
      title: "Plan.md",
      text: "# Plan",
    });
  });

  it("creates folders without session-specific metadata", () => {
    initializeWorkspaceStore();
    const folder = useWorkspaceStore.getState().addFolder("Notes");

    expect(folder).toMatchObject({ title: "Notes", parentId: "workspace-root" });
    expect(Object.keys(folder ?? {})).not.toContain("roomId");
  });

  it("uses the lowest available temporary title in the current folder", () => {
    initializeWorkspaceStore();

    const file = useWorkspaceStore.getState().addFile();

    expect(file.title).toBe("Untitled.md");
    expect(useWorkspaceStore.getState().files.find((candidate) => candidate.id === file.id)?.title).toBe(
      "Untitled.md",
    );

    const secondFile = useWorkspaceStore.getState().addFile();
    expect(secondFile.title).toBe("Untitled 2.md");
  });

  it("allows the same temporary title in different folders", () => {
    initializeWorkspaceStore();
    const firstFolder = useWorkspaceStore.getState().addFolder("First");
    const secondFolder = useWorkspaceStore.getState().addFolder("Second");

    const first = useWorkspaceStore.getState().addFile({ parentId: firstFolder?.id });
    const second = useWorkspaceStore.getState().addFile({ parentId: secondFolder?.id });

    expect(first.title).toBe("Untitled.md");
    expect(second.title).toBe("Untitled.md");
  });

  it("keeps tab state coherent when closing and deleting active files", () => {
    const { draft } = initializeWorkspaceStore();
    const plan = useWorkspaceStore.getState().addFile({ title: "Plan.md" });

    expect(useWorkspaceStore.getState().closeFile(plan.id)).toEqual({
      closedActiveFile: true,
      nextActiveFile: draft,
    });
    expect(useWorkspaceStore.getState().activeFileId).toBe(draft.id);
    expect(useWorkspaceStore.getState().openFileIds).not.toContain(plan.id);

    expect(useWorkspaceStore.getState().deleteFile(draft.id)?.closedActiveFile).toBe(true);
    expect(useWorkspaceStore.getState().files).not.toContainEqual(expect.objectContaining({ id: draft.id }));
    expect(useWorkspaceStore.getState().openFileIds).not.toContain(draft.id);
  });

  it("normalizes rename requests and rejects duplicate titles", () => {
    const { draft } = initializeWorkspaceStore();
    const plan = useWorkspaceStore.getState().addFile({ title: "Plan.md" });

    expect(useWorkspaceStore.getState().renameFile(plan.id, "Roadmap")).toEqual({
      ok: true,
      title: "Roadmap.md",
    });
    expect(useWorkspaceStore.getState().renameFile(draft.id, "Roadmap.md")).toMatchObject({
      ok: false,
      reason: "duplicate",
    });
  });

  it("duplicates document content and local display preferences", () => {
    const { draft } = initializeWorkspaceStore();

    const duplicate = useWorkspaceStore.getState().duplicateFile(draft.id);

    expect(duplicate).toMatchObject({
      text: draft.text,
      viewMode: draft.viewMode,
      readingWidth: draft.readingWidth,
    });
  });

  it("does not derive document titles from text changes", () => {
    const { draft } = initializeWorkspaceStore();

    useWorkspaceStore.getState().setFileText(
      draft.id,
      `---
title: Product Requirements
---

# PRD
`,
    );

    expect(useWorkspaceStore.getState().files.find((file) => file.id === draft.id)?.title).toBe("Draft.md");
  });

  it("replaces an imported workspace and returns the next active file", () => {
    initializeWorkspaceStore();
    const imported = createTestFile(2, {
      id: "imported",
      title: "Imported.md",
      text: "# Imported",
      viewMode: "preview",
    });

    const activeFile = useWorkspaceStore.getState().replaceWorkspace({
      files: [imported],
      openFileIds: [imported.id],
      activeFileId: imported.id,
    });

    expect(activeFile).toEqual(imported);
    expect(useWorkspaceStore.getState()).toMatchObject({
      files: [imported],
      openFileIds: [imported.id],
      activeFileId: imported.id,
    });
  });

  it("restores a deleted file at its previous position and open tab slot", () => {
    const { readme, draft } = initializeWorkspaceStore();
    const plan = useWorkspaceStore.getState().addFile({ id: "plan", title: "Plan.md" });
    const previousOpenFileIds = useWorkspaceStore.getState().openFileIds;

    useWorkspaceStore.getState().deleteFile(draft.id);
    useWorkspaceStore.getState().restoreFile({
      file: draft,
      fileIndex: 1,
      previousOpenFileIds,
      activate: true,
    });

    expect(useWorkspaceStore.getState().files.map((file) => file.id)).toEqual([readme.id, draft.id, plan.id]);
    expect(useWorkspaceStore.getState().openFileIds).toEqual(previousOpenFileIds);
    expect(useWorkspaceStore.getState().activeFileId).toBe(draft.id);
  });

  it("restores a deleted folder subtree, files, tabs, and active document as one bundle", () => {
    initializeWorkspaceStore();
    const planning = useWorkspaceStore.getState().addFolder("Planning");
    const archive = useWorkspaceStore.getState().addFolder("Archive", planning?.id);
    const plan = useWorkspaceStore.getState().addFile({
      id: "plan",
      title: "Plan.md",
      parentId: planning?.id,
    });
    const notes = useWorkspaceStore.getState().addFile({
      id: "notes",
      title: "Notes.md",
      parentId: archive?.id,
    });
    useWorkspaceStore.getState().selectFile(notes.id);
    const previousFiles = useWorkspaceStore.getState().files.map((file) => file.id);
    const previousFolders = useWorkspaceStore.getState().folders.map((folder) => folder.id);
    const previousOpenFileIds = useWorkspaceStore.getState().openFileIds;

    const bundle = useWorkspaceStore.getState().deleteFolder(planning!.id);

    expect(bundle?.files.map(({ item }) => item.id)).toEqual([plan.id, notes.id]);
    expect(useWorkspaceStore.getState().files).not.toContainEqual(expect.objectContaining({ id: plan.id }));
    expect(useWorkspaceStore.getState().folders).not.toContainEqual(expect.objectContaining({ id: archive?.id }));

    const createdAfterDelete = useWorkspaceStore.getState().addFile({ id: "after-delete", title: "After.md" });
    const restoredActiveFile = useWorkspaceStore.getState().restoreFolder(bundle!);

    expect(restoredActiveFile?.id).toBe(notes.id);
    expect(useWorkspaceStore.getState().files.map((file) => file.id)).toEqual([
      ...previousFiles,
      createdAfterDelete.id,
    ]);
    expect(useWorkspaceStore.getState().folders.map((folder) => folder.id)).toEqual(previousFolders);
    expect(useWorkspaceStore.getState().openFileIds).toEqual([
      ...previousOpenFileIds,
      createdAfterDelete.id,
    ]);
    expect(useWorkspaceStore.getState().activeFileId).toBe(notes.id);
  });

  it("upserts HELP.md without creating duplicate help surfaces", () => {
    initializeWorkspaceStore();

    const helpFile = useWorkspaceStore.getState().upsertHelpFile("# Help");
    const updatedHelpFile = useWorkspaceStore.getState().upsertHelpFile("# Updated Help");

    expect(updatedHelpFile.id).toBe(helpFile.id);
    expect(useWorkspaceStore.getState().files.filter((file) => file.title === "HELP.md")).toHaveLength(1);
    expect(useWorkspaceStore.getState().files.find((file) => file.id === helpFile.id)).toMatchObject({
      title: "HELP.md",
      text: "# Updated Help",
      viewMode: "preview",
    });
    expect(useWorkspaceStore.getState().activeFileId).toBe(helpFile.id);
  });

  it("keeps the workspace store free of room session state", () => {
    const { draft } = initializeWorkspaceStore();

    useWorkspaceStore.getState().setFileText(draft.id, "Remote text");
    const storedFile = useWorkspaceStore.getState().files.find((file) => file.id === draft.id);

    expect(storedFile?.text).toBe("Remote text");
    expect(Object.keys(storedFile ?? {})).not.toContain("roomId");
    expect(Object.keys(storedFile ?? {})).not.toContain("connectionStatus");
  });
});
