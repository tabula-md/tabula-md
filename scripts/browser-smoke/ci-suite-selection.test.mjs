import assert from "node:assert/strict";
import test from "node:test";
import { selectBrowserSmokeSuites } from "./ci-suite-selection.mjs";

test("keeps only the harness for non-runtime and unit-test changes", () => {
  const selection = selectBrowserSmokeSuites([
    "docs/testing.md",
    "tabula-app/src/editor/editorState.test.ts",
  ]);

  assert.deepEqual(selection.playwrightFiles, ["harness.spec.ts"]);
  assert.deepEqual(selection.legacySuites, []);
  assert.equal(selection.needsRoom, false);
});

test("selects editor checks without unrelated workspace or collaboration checks", () => {
  const selection = selectBrowserSmokeSuites([
    "tabula-app/src/editor/editorVisualMode.ts",
  ]);

  assert.deepEqual(selection.playwrightFiles, [
    "harness.spec.ts",
    "markdown-parity.spec.mjs",
    "visual-interaction.spec.mjs",
    "editor-controls.spec.mjs",
    "responsive-layout.spec.mjs",
  ]);
  assert(selection.legacySuites.includes("editor-search-source"));
  assert(selection.legacySuites.includes("editor-selection-comments"));
  assert(!selection.legacySuites.includes("workspace"));
  assert(!selection.legacySuites.includes("collaboration"));
  assert.equal(selection.needsRoom, true);
});

test("selects panel and knowledge checks for a knowledge panel change", () => {
  const selection = selectBrowserSmokeSuites([
    "tabula-app/src/right-panel/RightPanelKnowledge.tsx",
  ]);

  assert.deepEqual(selection.playwrightFiles, [
    "harness.spec.ts",
    "right-panels.spec.mjs",
  ]);
  assert.deepEqual(selection.legacySuites, ["knowledge-links", "okf-concepts"]);
});

test("checks out the room relay only for suites that use it", () => {
  const collaboration = selectBrowserSmokeSuites([
    "tabula-app/src/collaboration/roomTransport.ts",
  ]);
  const preview = selectBrowserSmokeSuites([
    "tabula-app/src/preview/VirtualMarkdownPreview.tsx",
  ]);

  assert(collaboration.playwrightFiles.includes("collaboration-capability.spec.mjs"));
  assert.deepEqual(collaboration.legacySuites, []);
  assert.equal(collaboration.needsRoom, true);
  assert.equal(preview.needsRoom, true);
});

test("checks out the JSON server only for JSON sharing checks", () => {
  const share = selectBrowserSmokeSuites([
    "tabula-app/src/share/ShareExportResult.tsx",
  ]);
  const panels = selectBrowserSmokeSuites([
    "tabula-app/src/right-panel/RightPanel.tsx",
  ]);

  assert(share.playwrightFiles.includes("collaboration-capability.spec.mjs"));
  assert(share.playwrightFiles.includes("share-capability.spec.mjs"));
  assert.deepEqual(share.legacySuites, []);
  assert.equal(share.needsJson, true);
  assert.equal(panels.needsJson, false);
});

test("runs the exact legacy scenario file that changed", () => {
  const collaboration = selectBrowserSmokeSuites([
    "scripts/browser-smoke/suites/collaboration-memory.mjs",
  ]);
  const editor = selectBrowserSmokeSuites([
    "scripts/browser-smoke/suites/editor-preview-sync.mjs",
  ]);

  assert.deepEqual(collaboration.legacySuites, ["collaboration-memory"]);
  assert.equal(collaboration.needsRoom, true);
  assert.deepEqual(editor.playwrightFiles, ["harness.spec.ts"]);
  assert.deepEqual(editor.legacySuites, ["editor-preview-sync"]);
});

test("runs a changed performance spec only when explicitly selected", () => {
  const selection = selectBrowserSmokeSuites([
    "tests/browser/performance.spec.mjs",
  ]);

  assert.deepEqual(selection.playwrightFiles, [
    "harness.spec.ts",
    "performance.spec.mjs",
  ]);
  assert.equal(selection.needsRoom, true);
  assert.deepEqual(selection.legacySuites, []);
});

test("routes storage and service suites through capability specs", () => {
  const storage = selectBrowserSmokeSuites([
    "tabula-app/src/workspace/persistence/workspaceIndexedDb.ts",
  ]);
  const collaboration = selectBrowserSmokeSuites([
    "scripts/browser-smoke/suites/collaboration.mjs",
  ]);
  const share = selectBrowserSmokeSuites([
    "scripts/browser-smoke/suites/json-share.mjs",
  ]);

  assert(storage.playwrightFiles.includes("storage-restore.spec.mjs"));
  assert(collaboration.playwrightFiles.includes("collaboration-capability.spec.mjs"));
  assert(share.playwrightFiles.includes("share-capability.spec.mjs"));
  assert.equal(storage.needsRoom, true);
  assert.equal(collaboration.needsRoom, true);
  assert.equal(share.needsJson, true);
});

test("selects the final regression matrix without performance checks", () => {
  const selection = selectBrowserSmokeSuites([
    "tests/browser/accessibility-regression.spec.mjs",
  ]);

  assert(selection.playwrightFiles.includes("accessibility-regression.spec.mjs"));
  assert(!selection.playwrightFiles.includes("performance.spec.mjs"));
  assert.equal(selection.needsRoom, false);
  assert.equal(selection.needsJson, false);
});

test("falls back to the established PR safety checks for shared or unknown runtime changes", () => {
  const infrastructure = selectBrowserSmokeSuites(["playwright.config.ts"]);
  const unknownRuntime = selectBrowserSmokeSuites([
    "tabula-app/src/new-runtime/UnknownSurface.tsx",
  ]);

  for (const selection of [infrastructure, unknownRuntime]) {
    assert.equal(selection.fallbackRun, true);
    assert.deepEqual(selection.playwrightFiles, [
      "harness.spec.ts",
      "markdown-parity.spec.mjs",
      "visual-interaction.spec.mjs",
      "editor-controls.spec.mjs",
      "responsive-layout.spec.mjs",
      "right-panels.spec.mjs",
      "storage-restore.spec.mjs",
      "collaboration-capability.spec.mjs",
      "share-capability.spec.mjs",
      "accessibility-regression.spec.mjs",
    ]);
    assert.deepEqual(selection.legacySuites, []);
    assert.equal(selection.needsRoom, true);
    assert.equal(selection.needsJson, true);
  }
});
