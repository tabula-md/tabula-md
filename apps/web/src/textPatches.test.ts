import { describe, expect, it } from "vitest";
import {
  applyTextPatches,
  areTextPatchesApplicable,
  diffTextPatch,
  getTextPatchesForChange,
} from "./textPatches";

describe("text patches", () => {
  it("diffs inserted newlines without flattening lines", () => {
    const patch = diffTextPatch("alpha beta", "alpha\nbeta");

    expect(patch).toEqual({ from: 5, to: 6, insert: "\n" });
    expect(applyTextPatches("alpha beta", [patch])).toBe("alpha\nbeta");
  });

  it("applies multiple CodeMirror-style changes in old-document coordinates", () => {
    const nextText = applyTextPatches("alpha\nbeta\ngamma", [
      { from: 0, to: 5, insert: "ALPHA" },
      { from: 11, to: 16, insert: "GAMMA" },
    ]);

    expect(nextText).toBe("ALPHA\nbeta\nGAMMA");
  });

  it("rejects overlapping or out-of-range patches", () => {
    expect(areTextPatchesApplicable("abc", [{ from: 2, to: 4, insert: "" }])).toBe(false);
    expect(
      areTextPatchesApplicable("abc", [
        { from: 0, to: 2, insert: "x" },
        { from: 1, to: 3, insert: "y" },
      ]),
    ).toBe(false);
  });

  it("uses preferred patches only when they recreate the requested text", () => {
    expect(
      getTextPatchesForChange("abc", "abXc", [{ from: 2, to: 2, insert: "X" }]),
    ).toEqual([{ from: 2, to: 2, insert: "X" }]);

    expect(
      getTextPatchesForChange("abc", "abXc", [{ from: 0, to: 1, insert: "X" }]),
    ).toEqual([{ from: 2, to: 2, insert: "X" }]);
  });
});
