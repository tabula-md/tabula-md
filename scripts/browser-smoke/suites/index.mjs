import * as workspace from "./workspace-menu.mjs";
import * as editorPreview from "./editor-preview.mjs";
import * as editorSearch from "./editor-search.mjs";
import * as editorSelectionComments from "./editor-selection-comments.mjs";
import * as editorCertification from "./editor-certification.mjs";
import * as splitLayout from "./split-layout.mjs";
import * as layout from "./layout.mjs";
import * as panels from "./panels.mjs";
import * as collaboration from "./collaboration.mjs";
import * as collaborationEditorTorture from "./collaboration-editor-torture.mjs";
import * as jsonShare from "./json-share.mjs";
import * as performance from "./performance.mjs";

export const suites = [
  workspace,
  editorPreview,
  editorSearch,
  editorSelectionComments,
  editorCertification,
  splitLayout,
  layout,
  panels,
  collaboration,
  collaborationEditorTorture,
  jsonShare,
  performance,
];
