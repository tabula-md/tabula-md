import { beforeEach, describe, expect, it } from "vitest";
import {
  resetWorkspaceStoreForTests,
  useWorkspaceStore,
} from "./workspaceStore";
import type { MarkdownFile } from "../workspaceStorage";

const VALID_ROOM_KEY = "A".repeat(43);

const createTestFile = (index: number, overrides: Partial<MarkdownFile> = {}): MarkdownFile => ({
  id: overrides.id ?? `file-${index}`,
  title: overrides.title ?? `Untitled ${index}.md`,
  text: overrides.text ?? "",
  viewMode: overrides.viewMode ?? "edit",
  readingWidth: overrides.readingWidth ?? "wide",
  splitRatio: overrides.splitRatio,
  lineWrapping: overrides.lineWrapping ?? true,
  lineNumbers: overrides.lineNumbers ?? true,
  bookmarks: overrides.bookmarks ?? [],
  connectionStatus: overrides.connectionStatus ?? "idle",
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

  it("creates and activates a live room file as a single workspace action", () => {
    initializeWorkspaceStore();

    const liveFile = useWorkspaceStore.getState().activateRoomFile({
      roomId: "room-123456",
      shareUrl: `https://tabula.test/r/room-123456#key=${VALID_ROOM_KEY}`,
    });

    expect(liveFile).toMatchObject({
      id: "live-room-123456",
      roomId: "room-123456",
      shareUrl: `https://tabula.test/r/room-123456#key=${VALID_ROOM_KEY}`,
      connectionStatus: "connecting",
    });
    expect(useWorkspaceStore.getState().activeFileId).toBe(liveFile?.id);
    expect(useWorkspaceStore.getState().openFileIds).toContain(liveFile?.id);
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

  it("keeps collaboration updates behind explicit store actions", () => {
    const { draft } = initializeWorkspaceStore();

    const liveFile = useWorkspaceStore
      .getState()
      .startFileCollaborationSession(draft.id, "room-123", `https://tabula.test/r/room-123#key=${VALID_ROOM_KEY}`);
    useWorkspaceStore.getState().setFileText(draft.id, "Remote text");
    useWorkspaceStore.getState().setFileCollaborationStatus(draft.id, "connected", { collaboratorCount: 2 });
    useWorkspaceStore.getState().setFileRoomMeta(draft.id, {
      snapshotCount: 3,
      lastSnapshotAt: "2026-06-23T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setFileRecoveryEvent(draft.id, {
      type: "snapshot-recovered",
      message: "Recovered",
      createdAt: "2026-06-23T00:00:01.000Z",
    });

    expect(liveFile).toMatchObject({
      roomId: "room-123",
      shareUrl: `https://tabula.test/r/room-123#key=${VALID_ROOM_KEY}`,
      connectionStatus: "connecting",
    });
    expect(useWorkspaceStore.getState().files.find((file) => file.id === draft.id)).toMatchObject({
      text: "Remote text",
      connectionStatus: "connected",
      collaboratorCount: 2,
      snapshotCount: 3,
      lastSnapshotAt: "2026-06-23T00:00:00.000Z",
      lastRecoveryType: "snapshot-recovered",
      lastRecoveryMessage: "Recovered",
      lastRecoveryAt: "2026-06-23T00:00:01.000Z",
    });

    useWorkspaceStore.getState().stopFileCollaborationSession(draft.id);

    expect(useWorkspaceStore.getState().files.find((file) => file.id === draft.id)).toMatchObject({
      roomId: undefined,
      shareUrl: undefined,
      connectionStatus: "idle",
      collaboratorCount: 0,
      snapshotCount: 0,
    });
  });
});
