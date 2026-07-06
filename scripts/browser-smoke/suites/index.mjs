import * as workspace from "./workspace-menu.mjs";
import * as editorPreview from "./editor-preview.mjs";
import * as editorPreviewSync from "./editor-preview-sync.mjs";
import * as editorPreviewTypography from "./editor-preview-typography.mjs";
import * as editorSearch from "./editor-search.mjs";
import * as editorSearchFocusHistory from "./editor-search-focus-history.mjs";
import * as editorSearchLayout from "./editor-search-layout.mjs";
import * as editorSearchPreview from "./editor-search-preview.mjs";
import * as editorSearchReplace from "./editor-search-replace.mjs";
import * as editorSearchSource from "./editor-search-source.mjs";
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
  editorPreviewSync,
  editorPreviewTypography,
  editorSearch,
  editorSearchLayout,
  editorSearchSource,
  editorSearchReplace,
  editorSearchPreview,
  editorSearchFocusHistory,
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
