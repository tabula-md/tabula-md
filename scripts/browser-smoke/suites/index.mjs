import * as workspace from "./workspace-menu.mjs";
import * as editorPreview from "./editor-preview.mjs";
import * as editorSearch from "./editor-search.mjs";
import * as editorSelectionComments from "./editor-selection-comments.mjs";
import * as splitLayout from "./split-layout.mjs";
import * as layout from "./layout.mjs";
import * as panels from "./panels.mjs";
import * as collaboration from "./collaboration.mjs";
import * as publish from "./publish-flow.mjs";
import * as performance from "./performance.mjs";

export const suites = [
  workspace,
  editorPreview,
  editorSearch,
  editorSelectionComments,
  splitLayout,
  layout,
  panels,
  collaboration,
  publish,
  performance,
];
