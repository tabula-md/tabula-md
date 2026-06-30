export type {
  ActiveDocumentFile,
  ActiveDocumentRuntime,
  DocumentBookmark,
} from "./activeDocumentRuntime";
export { createActiveDocumentRuntime } from "./activeDocumentRuntime";

export type {
  CollaborationCollaborator,
  CollaborationConnectionStatus,
  CollaborationLiveSelection,
  CollaborationRoomMeta,
  CollaborationRoomSnapshot,
} from "./collaborationTypes";

export type {
  CollaboratorRegistry,
} from "./collabCollaborators";
export { createCollaboratorRegistry } from "./collabCollaborators";

export type {
  RoomServerMetadata,
} from "./collabConnectionModel";
export {
  createRoomApiUrl,
  decodePresence,
  encodePresenceForRoom,
  isEncryptedEnvelope,
  sortCollaborators,
  toRoomMeta,
} from "./collabConnectionModel";

export type {
  CollabJoinResult,
  CollabOfflineReason,
  CollabOfflineResult,
  CollabSessionState,
} from "./collabSessionState";
export { createCollabSessionState } from "./collabSessionState";

export {
  getCollaboratorPresenceDetail,
  getCollaboratorPresenceLabel,
  getLineNumberForPresenceOffset,
  getLineNumberForPresenceSelection,
  isCollaboratorInFile,
} from "./collaborationPresence";

export type {
  CommentRuntimeAnchor,
  CommentRuntimeBookmark,
  PreviewCommentAnchor,
  PreviewLineAnnotation,
} from "./commentRuntimeModel";
export {
  formatCommentDate,
  getItemsInSourceLineRange,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  isPositionInLineRange,
  toggleLineBookmarkInList,
} from "./commentRuntimeModel";

export type {
  DocumentControlsCopy,
  DocumentControlsModel,
  DocumentControlsModelInput,
  DocumentReadingWidthOption,
  DocumentToggleControl,
  DocumentViewModeAction,
  DocumentViewModeIcon,
  DocumentViewModeSlot,
} from "./documentControlsModel";
export { buildDocumentControlsModel } from "./documentControlsModel";

export { getMarkdownWordCount } from "./documentMetrics";

export type {
  FileViewMode,
  ReadingWidth,
} from "./documentPrimitives";
export {
  DEFAULT_SPLIT_EDITOR_RATIO,
  FILE_VIEW_MODES,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  READING_WIDTHS,
  clampSplitEditorRatio,
} from "./documentPrimitives";

export type {
  DocumentSurfaceDocumentState,
  DocumentSurfaceModel,
  DocumentSurfaceState,
} from "./documentSurfaceModel";
export { buildDocumentSurface } from "./documentSurfaceModel";

export type {
  JsonShareCreateResponse,
  JsonShareImportRoute,
  JsonShareLocation,
  JsonShareRoute,
} from "./jsonShareLinkModel";
export {
  JSON_SHARE_ID_PATTERN,
  JSON_SHARE_KEY_BYTES,
  createJsonShareUrl,
  decodeBase64Url,
  encodeBase64Url,
  formatJsonShareUrlPreview,
  getJsonShareImportRoute,
  getJsonShareRoute,
  parseJsonShareFromHash,
  trimTrailingSlash,
  validateJsonShareCreateResponse,
} from "./jsonShareLinkModel";

export type {
  LineSurfaceAnnotation,
  LineSurfaceAnnotationRowOptions,
  LineSurfaceRect,
  LineSurfaceRectKind,
  LineSurfaceRow,
  LineSurfaceSourceBlock,
  LineSurfaceSourceLine,
  LineSurfaceSourceRange,
  LineSurfaceVisualRow,
  LineSurfaceVisualRowOptions,
} from "./lineSurfaceModel";
export {
  areLineSurfaceRowsEqual,
  buildLineSurfaceAnnotationRows,
  buildLineSurfaceVisualRows,
  getLineNumberForSourcePosition,
  getLineNumbersForSourceRanges,
  getLineSurfaceAnnotationsSignature,
  getLineSurfaceRectBottom,
  getLineSurfaceRectRight,
  lineSurfaceRowsAreAdjacent,
  positionInSourceLine,
  sourceRangeIntersectsLine,
} from "./lineSurfaceModel";

export type {
  MarkdownHeading,
  ParsedFrontmatter,
  PreviewBody,
  SearchMatch,
} from "./markdown";
export {
  getLineNumberForOffset,
  getLineStartOffset,
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getPreviewBody,
  getSearchMatches,
  parseFrontmatter,
} from "./markdown";

export type {
  MarkdownRangeEdit,
  MarkdownRangeSelection,
  MarkdownTextEdit,
} from "./markdownEditing";
export {
  getMarkdownEnterEdit,
  getMarkdownIndentEdit,
  getMarkdownPasteEdit,
} from "./markdownEditing";

export type {
  MarkdownFormatCommand,
  MarkdownFormatResult,
  MarkdownFormatSelection,
} from "./markdownFormatting";
export { applyMarkdownFormat } from "./markdownFormatting";

export type {
  CommentScope,
  RightPanelComment,
  RightPanelCommentFile,
  RightPanelCommentGroup,
} from "./rightPanelCommentViewModel";
export {
  getRightPanelCommentGroups,
  getRightPanelCommentScopeModel,
  stripMarkdownExtension,
} from "./rightPanelCommentViewModel";

export type {
  EncryptedEnvelope,
  EnvelopeKind,
  RoomJoinedMessage,
  RoomPeersMessage,
} from "./roomProtocol";

export type {
  ParsedRoomLocation,
  RoomRouteLocation,
  RoomSession,
} from "./roomShareLinkModel";
export {
  ROOM_ID_BYTES,
  ROOM_KEY_BYTES,
  ROOM_KEY_PATTERN,
  createRoomShareUrl,
  parseRoomFromHash,
  parseRoomKeyFromHash,
  parseRoomLocation,
  parseRoomShareUrl,
} from "./roomShareLinkModel";

export type { RoomShareLinkView } from "./shareLinkViewModel";
export { getRoomShareLinkView } from "./shareLinkViewModel";

export type {
  ShareSnapshot,
  ShareSnapshotComment,
  ShareSnapshotCommentReply,
  ShareSnapshotFile,
  ShareSnapshotPayload,
  ShareSnapshotSourceFile,
} from "./shareSnapshotPayload";
export {
  SHARE_SNAPSHOT_SCHEMA_VERSION,
  createShareSnapshot,
  createShareSnapshotPayload,
  validateShareSnapshotPayload,
} from "./shareSnapshotPayload";

export type {
  ShareTabView,
  ShareViewLabels,
  ShareViewModel,
  VisibleSharePanel,
} from "./shareViewModel";
export { buildShareViewModel, normalizeSharePanel } from "./shareViewModel";

export type { StatusBarSaveState } from "./statusBarViewModel";
export { getStatusBarSaveState } from "./statusBarViewModel";

export type { TextChange, TextPatch } from "./textPatches";
export {
  applyTextPatches,
  areTextPatchesApplicable,
  diffTextPatch,
  getTextPatchesForChange,
  normalizeTextPatches,
} from "./textPatches";

export type {
  WorkspaceFileIdentity,
  WorkspaceFileTitleLike,
} from "./workspaceFileRuntimeModel";
export {
  normalizeWorkspaceFileTitleForLookup,
  removeRecordKey,
  restoreFileToList,
  restoreOpenFileId,
} from "./workspaceFileRuntimeModel";

export type {
  ImportedWorkspaceFileDraft,
  TextFileDownloadDraft,
  WorkspaceFilePreferenceDefaults,
  WorkspaceImportFileDescriptor,
  WorkspaceIoFile,
  WorkspaceIoPreferenceOverrides,
} from "./workspaceIoModel";
export {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isSupportedImportFileDescriptor,
} from "./workspaceIoModel";

export type {
  CloseFileResult,
  RenameFileResult,
  WorkspaceModelAction,
  WorkspaceModelFile,
  WorkspaceModelState,
} from "./workspaceModel";
export {
  addWorkspaceFile,
  closeWorkspaceFile,
  createWorkspaceModelState,
  deleteWorkspaceFile,
  getActiveWorkspaceFile,
  getAvailableWorkspaceFileTitle,
  getOpenWorkspaceFiles,
  normalizeWorkspaceFileTitle,
  renameWorkspaceFile,
  reorderOpenWorkspaceFile,
  selectAdjacentWorkspaceFile,
  selectWorkspaceFile,
  setWorkspaceActiveFileId,
  workspaceReducer,
} from "./workspaceModel";

export type {
  WorkspaceConnectionStatus,
  WorkspaceViewFile,
} from "./workspaceViewModel";
export {
  getActiveWorkspaceStatus,
  getWorkspaceFileSearchText,
  getWorkspaceFileStatus,
  getWorkspaceStatusLabel,
  isUsableWorkspaceRoomFile,
} from "./workspaceViewModel";
