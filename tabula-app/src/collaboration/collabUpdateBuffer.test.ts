import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import { createCollabUpdateBuffer } from "./collabUpdateBuffer";

describe("collaboration update buffer", () => {
  it("flushes a single queued update", () => {
    const update = new Uint8Array([1, 2, 3]);
    const onFlush = vi.fn();
    const buffer = createCollabUpdateBuffer({
      delayMs: 25,
      onFlush,
      mergeUpdates: (updates) => Y.mergeUpdates([...updates]),
      setTimeoutFn: vi.fn(),
      clearTimeoutFn: vi.fn(),
    });

    buffer.push(update);
    buffer.flush();

    expect(onFlush).toHaveBeenCalledWith(update);
    expect(buffer.getPendingCount()).toBe(0);
  });

  it("schedules once until pending updates flush", () => {
    let scheduled: (() => void) | undefined;
    const setTimeoutFn = vi.fn((callback: () => void) => {
      scheduled = callback;
      return 1;
    });
    const onFlush = vi.fn();
    const source = new Y.Doc();
    const sourceText = source.getText("markdown");
    sourceText.insert(0, "a");
    const firstUpdate = Y.encodeStateAsUpdate(source);
    sourceText.insert(1, "b");
    const secondUpdate = Y.encodeStateAsUpdate(source);
    const buffer = createCollabUpdateBuffer({
      delayMs: 25,
      onFlush,
      mergeUpdates: (updates) => Y.mergeUpdates([...updates]),
      setTimeoutFn,
      clearTimeoutFn: vi.fn(),
    });

    buffer.push(firstUpdate);
    buffer.push(secondUpdate);

    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
    scheduled?.();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it("merges pending Yjs updates", () => {
    let scheduled: (() => void) | undefined;
    const flushedUpdates: Uint8Array[] = [];
    const source = new Y.Doc();
    const sourceText = source.getText("markdown");
    sourceText.insert(0, "a");
    const firstUpdate = Y.encodeStateAsUpdate(source);
    sourceText.insert(1, "b");
    const secondUpdate = Y.encodeStateAsUpdate(source);
    const target = new Y.Doc();
    const buffer = createCollabUpdateBuffer({
      delayMs: 25,
      onFlush: (update) => flushedUpdates.push(update),
      mergeUpdates: (updates) => Y.mergeUpdates([...updates]),
      setTimeoutFn: (callback) => {
        scheduled = callback;
        return 1;
      },
      clearTimeoutFn: vi.fn(),
    });

    buffer.push(firstUpdate);
    buffer.push(secondUpdate);
    scheduled?.();
    Y.applyUpdate(target, flushedUpdates[0]);

    expect(target.getText("markdown").toString()).toBe("ab");
  });

  it("clears pending updates without flushing", () => {
    const onFlush = vi.fn();
    const clearTimeoutFn = vi.fn();
    const buffer = createCollabUpdateBuffer({
      delayMs: 25,
      onFlush,
      mergeUpdates: (updates) => Y.mergeUpdates([...updates]),
      setTimeoutFn: vi.fn(() => 1),
      clearTimeoutFn,
    });

    buffer.push(new Uint8Array([1]));
    buffer.clear();
    buffer.flush();

    expect(clearTimeoutFn).toHaveBeenCalledWith(1);
    expect(onFlush).not.toHaveBeenCalled();
  });
});
