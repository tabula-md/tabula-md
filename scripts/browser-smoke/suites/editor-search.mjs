import * as editorSearchFocusHistory from "./editor-search-focus-history.mjs";
import * as editorSearchLayout from "./editor-search-layout.mjs";
import * as editorSearchPreview from "./editor-search-preview.mjs";
import * as editorSearchReplace from "./editor-search-replace.mjs";
import * as editorSearchSource from "./editor-search-source.mjs";

export const id = "editor-search";
export const description = "Compatibility wrapper for all editor search browser smoke suites.";
export const hiddenFeature = true;

const searchSuites = [
  editorSearchLayout,
  editorSearchSource,
  editorSearchReplace,
  editorSearchPreview,
  editorSearchFocusHistory,
];

export async function run(ctx) {
  for (const suite of searchSuites) {
    await suite.run(ctx);
  }
}
