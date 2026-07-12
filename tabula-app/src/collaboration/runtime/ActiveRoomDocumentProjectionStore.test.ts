import { describe, expect, it } from "vitest";
import { createActiveRoomDocumentProjectionStore } from "./ActiveRoomDocumentProjectionStore";

describe("ActiveRoomDocumentProjectionStore", () => {
  it("retains at most the active Room document projection", () => {
    const store = createActiveRoomDocumentProjectionStore();

    expect(store.set("doc-a", "Alpha")).toBe(true);
    expect(store.getText("doc-a")).toBe("Alpha");
    expect(store.set("doc-b", "Beta")).toBe(true);
    expect(store.getText("doc-a")).toBeNull();
    expect(store.getText("doc-b")).toBe("Beta");
    expect(store.clear("doc-b")).toBe(true);
    expect(store.getText("doc-b")).toBeNull();
  });
});
