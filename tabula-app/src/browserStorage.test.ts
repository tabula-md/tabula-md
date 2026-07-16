import { describe, expect, it, vi } from "vitest";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "./browserStorage";

describe("browser storage", () => {
  it("keeps reads and writes optional when browser storage is unavailable", () => {
    expect(readBrowserStorage(null, "key")).toBeNull();
    expect(writeBrowserStorage(null, "key", "value")).toBe(false);
    expect(removeBrowserStorage(null, "key")).toBe(false);
  });

  it("contains storage access failures", () => {
    const storage = {
      getItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
      setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }),
      removeItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
    };

    expect(readBrowserStorage(storage, "key")).toBeNull();
    expect(writeBrowserStorage(storage, "key", "value")).toBe(false);
    expect(removeBrowserStorage(storage, "key")).toBe(false);
  });
});
