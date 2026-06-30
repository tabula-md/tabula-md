import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceFileTitleForLookup,
  removeRecordKey,
  restoreFileToList,
  restoreOpenFileId,
} from "./workspaceFileRuntimeModel";

describe("workspace file runtime model", () => {
  it("removes a record key without touching unrelated records", () => {
    const record = { a: 1, b: 2 };

    expect(removeRecordKey(record, "a")).toEqual({ b: 2 });
    expect(removeRecordKey(record, "missing")).toBe(record);
  });

  it("restores a deleted file at the previous index once", () => {
    const files = [{ id: "a" }, { id: "c" }];
    const restored = { id: "b" };

    expect(restoreFileToList(files, restored, 1)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(restoreFileToList(files, { id: "a" }, 1)).toBe(files);
  });

  it("restores an open file id only when it used to be open", () => {
    expect(restoreOpenFileId(["a", "c"], "b", ["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(restoreOpenFileId(["a"], "b", ["a"])).toEqual(["a"]);
  });

  it("normalizes titles for lookup", () => {
    expect(normalizeWorkspaceFileTitleForLookup({ title: " README.md " })).toBe("readme");
  });
});
