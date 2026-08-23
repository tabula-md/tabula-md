import { describe, expect, it } from "vitest";
import { getPropertyScalarKind } from "./RightPanelProperties";

describe("getPropertyScalarKind", () => {
  it("recognizes safe web links", () => {
    expect(getPropertyScalarKind("https://example.com/source")).toBe("url");
    expect(getPropertyScalarKind("javascript:alert(1)")).toBe("text");
  });

  it("recognizes ISO dates without treating arbitrary numbers as dates", () => {
    expect(getPropertyScalarKind("2026-08-17")).toBe("date");
    expect(getPropertyScalarKind("2026-08-17T09:30:00Z")).toBe("date");
    expect(getPropertyScalarKind("17")).toBe("text");
  });
});
