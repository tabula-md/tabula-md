import { describe, expect, it } from "vitest";
import {
  addWorkspaceFile,
  closeWorkspaceFile,
  createWorkspaceModelState,
  deleteWorkspaceFile,
  renameWorkspaceFile,
  selectAdjacentWorkspaceFile,
  workspaceReducer,
  type WorkspaceModelState,
} from "./workspaceModel";
import type { WorkspaceFile } from "./workspaceStorage";

const createFile = (id: string, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
  id,
  title: `${id}.md`,
  text: "",
  viewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
  bookmarks: [],
  connectionStatus: "idle",
  ...overrides,
});

const createState = (overrides: Partial<WorkspaceModelState> = {}): WorkspaceModelState => {
  const files = overrides.files ?? [createFile("readme"), createFile("one"), createFile("two")];
  return createWorkspaceModelState({
    files,
    openFileIds: overrides.openFileIds ?? ["readme", "one"],
    activeFileId: overrides.activeFileId ?? "readme",
  });
};

describe("workspace model", () => {
  it("selects a file and opens it when the tab is not already open", () => {
    const state = workspaceReducer(createState(), { type: "selectFile", fileId: "two" });

    expect(state.activeFileId).toBe("two");
    expect(state.openFileIds).toEqual(["readme", "one", "two"]);
  });

  it("allows active file to be cleared by the state setter action", () => {
    const state = workspaceReducer(createState(), { type: "setActiveFileId", fileId: "" });

    expect(state.activeFileId).toBe("");
    expect(state.openFileIds).toEqual(["readme", "one"]);
  });

  it("adds a created file as the active open file", () => {
    const nextFile = createFile("three", { title: "Three.md", viewMode: "preview" });
    const state = addWorkspaceFile(createState(), nextFile);

    expect(state.files.map((file) => file.id)).toEqual(["readme", "one", "two", "three"]);
    expect(state.openFileIds).toEqual(["readme", "one", "three"]);
    expect(state.activeFileId).toBe("three");
  });

  it("closes the active tab and selects the next neighbor", () => {
    const result = closeWorkspaceFile(createState({ openFileIds: ["readme", "one", "two"], activeFileId: "one" }), "one");

    expect(result?.result).toEqual({
      closedActiveFile: true,
      nextActiveFile: createFile("two"),
    });
    expect(result?.state.openFileIds).toEqual(["readme", "two"]);
    expect(result?.state.activeFileId).toBe("two");
  });

  it("deletes the active file and removes it from tabs", () => {
    const result = deleteWorkspaceFile(createState({ openFileIds: ["readme", "one", "two"], activeFileId: "one" }), "one");

    expect(result?.state.files.map((file) => file.id)).toEqual(["readme", "two"]);
    expect(result?.state.openFileIds).toEqual(["readme", "two"]);
    expect(result?.state.activeFileId).toBe("two");
    expect(result?.result.closedActiveFile).toBe(true);
    expect(result?.result.nextActiveFile?.id).toBe("two");
  });

  it("preserves active file when deleting another file", () => {
    const result = deleteWorkspaceFile(createState({ openFileIds: ["readme", "one", "two"], activeFileId: "readme" }), "one");

    expect(result?.state.files.map((file) => file.id)).toEqual(["readme", "two"]);
    expect(result?.state.openFileIds).toEqual(["readme", "two"]);
    expect(result?.state.activeFileId).toBe("readme");
    expect(result?.result.closedActiveFile).toBe(false);
  });

  it("updates the active file view mode without touching other files", () => {
    const state = workspaceReducer(createState({ activeFileId: "one" }), {
      type: "setActiveFileViewMode",
      viewMode: "split",
    });

    expect(state.files.find((file) => file.id === "one")?.viewMode).toBe("split");
    expect(state.files.find((file) => file.id === "readme")?.viewMode).toBe("edit");
  });

  it("cycles active file through open tabs", () => {
    const result = selectAdjacentWorkspaceFile(
      createState({ openFileIds: ["readme", "one", "two"], activeFileId: "two" }),
      1,
    );

    expect(result.file?.id).toBe("readme");
    expect(result.state.activeFileId).toBe("readme");
  });

  it("validates rename collisions before changing state", () => {
    const state = createState();
    const duplicateResult = renameWorkspaceFile(state, "one", "README.md");
    const renamedResult = renameWorkspaceFile(state, "one", "Decision");

    expect(duplicateResult.result).toMatchObject({ ok: false, reason: "duplicate" });
    expect(duplicateResult.state).toBe(state);
    expect(renamedResult.result).toEqual({ ok: true, title: "Decision.md" });
    expect(renamedResult.state.files.find((file) => file.id === "one")?.title).toBe("Decision.md");
  });
});
