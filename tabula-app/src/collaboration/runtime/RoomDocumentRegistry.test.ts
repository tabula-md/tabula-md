import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createRoomDocumentRegistry } from "./RoomDocumentRegistry";

const createDocuments = (count: number) => {
  const doc = new Y.Doc();
  const documents = doc.getMap<Y.Text>("documents");
  for (let index = 0; index < count; index += 1) {
    const text = new Y.Text();
    text.insert(0, `Document ${index}`);
    documents.set(`doc-${index}`, text);
  }
  return { doc, documents };
};

describe("room document registry", () => {
  it("shares one document resource and releases leases idempotently", () => {
    const { doc, documents } = createDocuments(1);
    const awareness = new Awareness(doc);
    const registry = createRoomDocumentRegistry({ awareness, documents });

    const first = registry.acquire("doc-0");
    const second = registry.acquire("doc-0");

    expect(first?.handle).toBe(second?.handle);
    expect(registry.getResourceCounts()).toEqual({
      activeLeases: 2,
      documentHandles: 1,
      undoManagers: 1,
    });
    first?.release();
    first?.release();
    second?.release();
    expect(registry.getResourceCounts().activeLeases).toBe(0);

    registry.dispose();
    awareness.destroy();
    doc.destroy();
  });

  it("retains only the most recently used undo resources", () => {
    const { doc, documents } = createDocuments(12);
    const awareness = new Awareness(doc);
    const registry = createRoomDocumentRegistry({ awareness, documents, maxUndoManagers: 8 });

    for (let index = 0; index < 12; index += 1) {
      registry.acquire(`doc-${index}`)?.release();
    }

    expect(registry.getResourceCounts()).toEqual({
      activeLeases: 0,
      documentHandles: 8,
      undoManagers: 8,
    });

    registry.dispose();
    awareness.destroy();
    doc.destroy();
  });

  it("keeps heavy editor resources bounded across a 500-document workspace", () => {
    const { doc, documents } = createDocuments(500);
    const awareness = new Awareness(doc);
    const registry = createRoomDocumentRegistry({ awareness, documents, maxUndoManagers: 8 });

    for (let index = 0; index < 500; index += 1) {
      registry.acquire(`doc-${index}`)?.release();
    }

    expect(registry.getResourceCounts()).toEqual({
      activeLeases: 0,
      documentHandles: 8,
      undoManagers: 8,
    });

    registry.dispose();
    expect(registry.getResourceCounts()).toEqual({
      activeLeases: 0,
      documentHandles: 0,
      undoManagers: 0,
    });
    awareness.destroy();
    doc.destroy();
  });

  it("invalidates a resource when its Y.Text identity changes", () => {
    const { doc, documents } = createDocuments(1);
    const awareness = new Awareness(doc);
    const registry = createRoomDocumentRegistry({ awareness, documents });
    const first = registry.acquire("doc-0");
    const replacement = new Y.Text();
    replacement.insert(0, "Replacement");
    documents.set("doc-0", replacement);

    registry.sync();
    const second = registry.acquire("doc-0");

    expect(second?.handle).not.toBe(first?.handle);
    expect(second?.handle.yText).toBe(replacement);
    first?.release();
    second?.release();
    registry.dispose();
    awareness.destroy();
    doc.destroy();
  });
});
