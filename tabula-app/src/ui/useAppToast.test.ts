import { describe, expect, it } from "vitest";
import { getAppToastDuration } from "./useAppToast";

describe("app toast duration", () => {
  it("keeps actionable and error feedback available long enough to respond", () => {
    expect(getAppToastDuration("error", false)).toBeNull();
    expect(getAppToastDuration("error", true)).toBeNull();
    expect(getAppToastDuration("neutral", true)).toBe(10_000);
  });

  it("dismisses routine success feedback quickly", () => {
    expect(getAppToastDuration("neutral", false)).toBe(3_200);
  });
});
