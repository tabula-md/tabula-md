import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createRoomDocumentProjectionStore } from "./RoomDocumentProjectionStore";

describe("RoomDocumentProjectionStore", () => {
  it("retains projections only while a document has subscribers", () => {
    const doc = new Y.Doc();
    doc.getMap<Y.Text>("documents").set("a", new Y.Text("Alpha"));
    const sharedDocuments = doc.getMap<Y.Text>("documents");
    const store = createRoomDocumentProjectionStore(sharedDocuments);
    const listener = vi.fn();

    const unsubscribe = store.subscribe("a", listener);
    expect(store.getSnapshot("a")).toBe("Alpha");
    expect(store.getResourceCounts()).toEqual({
      documentProjectionListeners: 1,
      documentProjectionSnapshots: 1,
    });

    sharedDocuments.get("a")!.insert(5, " updated");
    store.refresh("a");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot("a")).toBe("Alpha updated");

    unsubscribe();
    expect(store.getResourceCounts()).toEqual({
      documentProjectionListeners: 0,
      documentProjectionSnapshots: 0,
    });
    store.clear();
    doc.destroy();
  });

  it("does not retain or refresh background documents", () => {
    const doc = new Y.Doc();
    const documents = doc.getMap<Y.Text>("documents");
    documents.set("a", new Y.Text("Alpha"));
    documents.set("b", new Y.Text("Beta"));
    const store = createRoomDocumentProjectionStore(documents);
    const listener = vi.fn();
    const unsubscribe = store.subscribe("a", listener);

    documents.get("b")!.insert(4, " updated");
    store.refresh("b");

    expect(listener).not.toHaveBeenCalled();
    expect(store.getResourceCounts().documentProjectionSnapshots).toBe(1);
    unsubscribe();
    doc.destroy();
  });
});
