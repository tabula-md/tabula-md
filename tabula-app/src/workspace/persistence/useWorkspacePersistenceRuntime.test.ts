import { describe, expect, it } from "vitest";
import { isQueuedWorkspacePersistenceEnabled } from "./useWorkspacePersistenceRuntime";

describe("isQueuedWorkspacePersistenceEnabled", () => {
  it("keeps browser persistence suspended outside the local workspace", () => {
    expect(isQueuedWorkspacePersistenceEnabled({
      enabled: false,
      deferPersistence: false,
    })).toBe(false);
  });

  it("waits for local workspace hydration before persisting", () => {
    expect(isQueuedWorkspacePersistenceEnabled({
      enabled: true,
      deferPersistence: true,
    })).toBe(false);
  });

  it("persists after local workspace hydration is ready", () => {
    expect(isQueuedWorkspacePersistenceEnabled({
      enabled: true,
      deferPersistence: false,
    })).toBe(true);
  });
});
