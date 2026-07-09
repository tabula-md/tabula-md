export type {
  ActiveDocumentFile,
  ActiveDocumentEditorRuntime,
  ActiveDocumentPreviewBodyRuntime,
  ActiveDocumentPreviewMetadataRuntime,
  ActiveDocumentPreviewRuntime,
  ActiveDocumentRuntime,
  DocumentBookmark,
} from "./activeDocumentRuntime";
export {
  createActiveDocumentEditorRuntime,
  createActiveDocumentPreviewBodyRuntime,
  createActiveDocumentPreviewMetadataRuntime,
  createActiveDocumentPreviewRuntime,
  createActiveDocumentRuntime,
} from "./activeDocumentRuntime";

export type {
  CollaborationCollaborator,
  CollaborationConnectionStatus,
  CollaborationLiveSelection,
} from "./collaborationTypes";

export type {
  CollaboratorRegistry,
} from "./collabCollaborators";
export {
  createCollaboratorRegistry,
  mapCollaborationPositionThroughTextPatches,
  mapCollaborationSelectionThroughTextPatches,
} from "./collabCollaborators";

export type {
  RoomServerMetadata,
} from "./collabConnectionModel";
export {
  createRoomApiUrl,
  isEncryptedEnvelope,
  sortCollaborators,
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
  DocumentBufferTextReader,
  DocumentBufferTextState,
  EditorDocumentRuntime,
  EditorDocumentRuntimeFlushResult,
  EditorDocumentRuntimeSnapshot,
  PendingDocumentBufferCommit,
} from "./documentBuffer";
export {
  createEditorDocumentRuntime,
  createDocumentBufferTextState,
  createPendingDocumentBufferCommit,
  getDocumentBufferVisibleText,
  resolvePendingDocumentBufferText,
  shouldCancelPendingDocumentBufferCommit,
} from "./documentBuffer";

export type {
  JsonShareCreateResponse,
  JsonShareImportRoute,
  JsonShareLocation,
  JsonShareRoute,
} from "./jsonShareLinkModel";
export {
  JSON_SHARE_API_PREFIX,
  JSON_SHARE_ID_PATTERN,
  JSON_SHARE_KEY_BYTES,
  JSON_SHARE_POST_PATH,
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
  DecryptDataOptions,
  EncryptedData,
  EncryptDataOptions,
} from "./data/encryption";
export {
  AES_GCM_IV_BYTES,
  DEFAULT_ENCRYPTION_KEY_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
  getCrypto,
  importEncryptionKey,
  toArrayBuffer,
} from "./data/encryption";

export type {
  DecodeEncryptedDataOptions,
  EncodeEncryptedDataOptions,
  EncryptedDataEncodingInfo,
} from "./data/encode";
export {
  decodeEncryptedData,
  encodeEncryptedData,
} from "./data/encode";

export type {
  SerializeShareSnapshotInput,
} from "./data/json";
export {
  createShareSnapshotPayload as createShareSnapshotPayloadFromData,
  parseShareSnapshot,
  restoreShareSnapshot,
  serializeShareSnapshot,
} from "./data/json";

export { restoreShareSnapshotPayload } from "./data/restore";

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
} from "./markdown";
export {
  getLineNumberForOffset,
  getLineStartOffset,
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getOutlineHeadingsFromMarkdown,
  getPreviewBody,
  parseFrontmatter,
} from "./markdown";

export type {
  PreviewBlock,
  PreviewBlockIndex,
  PreviewBlockMeasurements,
  PreviewBlockKind,
  PreviewRenderableAnchor,
  PreviewScrollMapAnchor,
  PreviewScrollMapOptions,
  PreviewWindow,
} from "./previewBlockModel";
export {
  LARGE_DOCUMENT_CHAR_THRESHOLD,
  HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD,
  HEAVY_PREVIEW_FENCE_LINE_THRESHOLD,
  HEAVY_PREVIEW_TABLE_RUN_THRESHOLD,
  LARGE_DOCUMENT_LINE_THRESHOLD,
  LARGE_DOCUMENT_LONG_LINE_THRESHOLD,
  LARGE_DOCUMENT_TABLE_RUN_THRESHOLD,
  LARGE_DOCUMENT_WORD_THRESHOLD,
  LIVE_PREVIEW_CHAR_THRESHOLD,
  applyPreviewBlockMeasurements,
  choosePreviewRenderableAnchor,
  createOptimisticPreviewBlockIndex,
  createOptimisticPreviewBlockIndexFromPatches,
  createPreviewBlockIndex,
  getMarkdownLineCount,
  getPreviewScrollTopForSourceLine,
  getPreviewWindow,
  hasGlobalMarkdownSyntax,
  hasHeavyMarkdownPreviewShape,
  hasLargeMarkdownWordCount,
  hasLongMarkdownLine,
  isLargeMarkdownDocument,
  mapPreviewLineToBlock,
  shouldUseImmediateMarkdownPreview,
} from "./previewBlockModel";

export type {
  BuildSourceScrollSegmentsMetadata,
  EditorScrollPosition,
  PreviewScrollTarget,
  SourceScrollMap,
  SourceScrollPosition,
  SourceScrollSegment,
  SourceScrollSegmentKind,
  SourceScrollTransferViewport,
} from "./sourceScrollTransfer";
export {
  applyPreviewSegmentMeasurements,
  buildSourceScrollSegments,
  getPreviewScrollTargetForEditorPosition,
  getPreviewScrollTopForSourcePosition,
  resolveSourcePosition,
} from "./sourceScrollTransfer";

export {
  TABULA_LARGE_DOCUMENT_UX_POLICY,
  TABULA_PRODUCT_SUPPORT_TARGETS,
} from "./productPerformancePolicy";

export type {
  MarkdownRangeEdit,
  MarkdownRangeSelection,
} from "./markdownEditing";
export {
  getMarkdownIndentEdit,
} from "./markdownEditing";

export type {
  MarkdownLink,
  MarkdownLinkUrlEdit,
} from "./markdown/links";
export {
  getMarkdownLinkAtOffset,
  getMarkdownLinks,
  isSafeMarkdownLinkUrl,
  updateMarkdownLinkUrl,
} from "./markdown/links";

export type {
  MarkdownTaskMarker,
  MarkdownTaskToggleEdit,
} from "./markdown/tasks";
export {
  getMarkdownTaskAtOffset,
  getMarkdownTaskMarkers,
  toggleMarkdownTaskOnLine,
  toggleMarkdownTaskAtOffset,
} from "./markdown/tasks";

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

export type { RoomEnvelopeMetadata } from "./room/envelope";
export {
  createRoomAad,
  createRoomEnvelope,
  decryptRoomEnvelope,
  isEnvelopeKind,
  validateRoomPayload,
} from "./room/envelope";

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
  RoomActor,
  RoomActorClient,
  RoomActorKind,
  RoomActorJoinedEvent,
  RoomActorLeftEvent,
  RoomCapability,
  RoomEvent,
  RoomEventBase,
  RoomEventParseResult,
  RoomEventType,
  RoomPresence,
  RoomPresenceUpdatedEvent,
  RoomTextUpdatedEvent,
  RoomWorkspaceUpdatedEvent,
  WorkspaceDocumentNode,
  WorkspaceFolderNode,
  WorkspaceNode,
  WorkspaceRoomDocument,
  WorkspaceRoomCheckpoint,
  WorkspaceRoomState,
} from "./roomCollaboration";
export {
  AGENT_ROOM_CAPABILITIES,
  DEFAULT_ACTOR_COLOR,
  DEFAULT_ACTOR_NAME,
  DEFAULT_AGENT_ACTOR_CLIENT,
  DEFAULT_HUMAN_ACTOR_CLIENT,
  HUMAN_ROOM_CAPABILITIES,
  MARKDOWN_TEXT_HASH_ALGORITHM,
  WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION,
  createWorkspaceRoomCheckpoint,
  createWorkspaceRoomState,
  createRoomActor,
  decodeRoomEvent,
  decodeWorkspaceRoomCheckpoint,
  encodeWorkspaceRoomCheckpoint,
  encodeRoomEvent,
  getDefaultRoomCapabilities,
  hasRoomCapability,
  hashMarkdownText,
  isBase64UrlBytes,
  isRoomCapability,
  normalizeRoomCapabilities,
  parseRoomActor,
  parseRoomEvent,
  parseRoomPresence,
  parseWorkspaceNode,
  parseWorkspaceRoomDocument,
  parseWorkspaceRoomCheckpoint,
  parseWorkspaceRoomState,
} from "./roomCollaboration";

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
  ShareViewLabels,
  ShareViewModel,
} from "./shareViewModel";
export { buildShareViewModel } from "./shareViewModel";

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
