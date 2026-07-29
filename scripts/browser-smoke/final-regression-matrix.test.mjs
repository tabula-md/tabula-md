import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  FINAL_REGRESSION_COVERAGE,
  FINAL_REGRESSION_REQUIREMENTS,
} from "../../tests/browser/support/finalRegressionMatrix.mjs";

const collectCoverage = (axis) =>
  new Set(FINAL_REGRESSION_COVERAGE.flatMap((entry) => entry[axis]));

test("final regression matrix covers every required product axis", () => {
  for (const [axis, requirements] of Object.entries(FINAL_REGRESSION_REQUIREMENTS)) {
    const coverage = collectCoverage(axis);
    assert.deepEqual(
      [...requirements].sort(),
      [...coverage].sort(),
      `${axis} coverage should stay explicit and complete`,
    );
  }
});

test("final regression matrix only names executable Playwright specs", () => {
  for (const entry of FINAL_REGRESSION_COVERAGE) {
    const specPath = path.resolve("tests/browser", entry.spec);
    assert.equal(fs.existsSync(specPath), true, `${entry.spec} should exist`);
  }
});
