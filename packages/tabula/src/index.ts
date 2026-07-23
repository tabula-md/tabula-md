export type {
  ActiveDocumentFile,
  ActiveDocumentEditorRuntime,
  ActiveDocumentPreviewBodyRuntime,
  ActiveDocumentPreviewMetadataRuntime,
  ActiveDocumentPreviewRuntime,
  ActiveDocumentRuntime,
  DocumentBookmark,
} from "./document/activeDocumentRuntime";
export {
  createActiveDocumentEditorRuntime,
  createActiveDocumentPreviewBodyRuntime,
  createActiveDocumentPreviewMetadataRuntime,
  createActiveDocumentPreviewRuntime,
  createActiveDocumentRuntime,
} from "./document/activeDocumentRuntime";

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
  DocumentViewModeIcon,
  DocumentViewModeOption,
} from "./document/documentControlsModel";
export { buildDocumentControlsModel } from "./document/documentControlsModel";

export { getMarkdownWordCount } from "./document/documentMetrics";

export type {
  FileViewMode,
  ReadingWidth,
} from "./document/documentPrimitives";
export {
  DEFAULT_SPLIT_EDITOR_RATIO,
  FILE_VIEW_MODES,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  READING_WIDTHS,
  clampSplitEditorRatio,
} from "./document/documentPrimitives";

export type {
  DocumentSurfaceDocumentState,
  DocumentSurfaceModel,
  DocumentSurfaceState,
} from "./document/documentSurfaceModel";
export { buildDocumentSurface } from "./document/documentSurfaceModel";

export type {
  DocumentBufferTextReader,
  DocumentBufferTextState,
  EditorDocumentRuntime,
  EditorDocumentRuntimeFlushResult,
  EditorDocumentRuntimeSnapshot,
  PendingDocumentBufferCommit,
} from "./document/documentBuffer";
export {
  createEditorDocumentRuntime,
  createDocumentBufferTextState,
  createPendingDocumentBufferCommit,
  getDocumentBufferVisibleText,
  resolvePendingDocumentBufferText,
  shouldCancelPendingDocumentBufferCommit,
} from "./document/documentBuffer";

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
  FrontmatterInspection,
  MarkdownHeading,
  ParsedFrontmatter,
  ParsedFrontmatterData,
  PreviewBody,
} from "./markdown/parse";
export {
  getLineNumberForOffset,
  getLineStartOffset,
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getOutlineHeadingsFromMarkdown,
  getPreviewBody,
  inspectFrontmatterData,
  parseFrontmatter,
  parseFrontmatterData,
} from "./markdown/parse";

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
} from "./markdown/editing";
export {
  getMarkdownIndentEdit,
} from "./markdown/editing";

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
} from "./markdown/formatting";
export { applyMarkdownFormat } from "./markdown/formatting";

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
  RoomActorAttribution,
  RoomActorClient,
  RoomActorKind,
  RoomCapability,
} from "./roomCollaboration";

export type {
  RoomChunkAssembler,
  RoomWireChunkPacket,
  RoomWireDataPacket,
  RoomWirePacket,
  RoomWirePacketDecodeResult,
  RoomWirePacketType,
} from "./roomBinaryProtocol";
export {
  ROOM_WIRE_CHUNK_BYTES,
  ROOM_WIRE_CHUNK_PAYLOAD_BYTES,
  ROOM_WIRE_CHUNK_TTL_MS,
  ROOM_WIRE_MAX_BUFFERED_BYTES,
  ROOM_WIRE_MAX_CHUNKS,
  ROOM_WIRE_MAX_INFLIGHT_PER_ACTOR,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  ROOM_WIRE_MAX_MESSAGE_BYTES,
  ROOM_WIRE_PROTOCOL_VERSION,
  createRoomChunkAssembler,
  decodeRoomWirePacket,
  encodeRoomWirePacket,
  encodeRoomWirePackets,
} from "./roomBinaryProtocol";

export type {
  RemoteSyncOrigin,
  WorkspaceRoomSyncAdapters,
  WorkspaceRoomSyncClock,
  WorkspaceRoomSyncController,
  WorkspaceRoomSyncControllerOptions,
  WorkspaceRoomSyncCrypto,
  WorkspaceRoomTransport,
  WorkspaceRoomTransportHandlers,
} from "./workspaceRoomSync";
export {
  REMOTE_AWARENESS_ORIGIN,
  REMOTE_SYNC_ORIGIN,
  createWorkspaceRoomSyncController,
  isRemoteSyncOrigin,
} from "./workspaceRoomSync";

export type {
  WorkspaceRoomComment,
  WorkspaceRoomCommentReply,
  WorkspaceRoomDocumentSnapshot,
  WorkspaceRoomFolderSnapshot,
  WorkspaceRoomLimitResult,
  WorkspaceRoomLimitViolation,
  WorkspaceRoomNode,
  WorkspaceRoomNodeType,
  WorkspaceRoomSnapshot,
  WorkspaceRoomStructureSnapshot,
} from "./workspaceRoomModel";
export type {
  WorkspaceRoomCrdt,
  WorkspaceRoomStructureResult,
} from "./workspaceRoomCrdt";
export {
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_REPLIES,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
  WORKSPACE_ROOM_ROOT_ID,
  WORKSPACE_ROOM_SCHEMA_VERSION,
  validateWorkspaceRoomLimits,
  validateWorkspaceRoomStructureLimits,
} from "./workspaceRoomModel";
export {
  addWorkspaceRoomCommentReply,
  createWorkspaceRoomCrdt,
  createWorkspaceRoomDocument,
  createWorkspaceRoomFolder,
  deleteWorkspaceRoomComment,
  deleteWorkspaceRoomNode,
  getWorkspaceRoomComments,
  getWorkspaceRoomDocument,
  getWorkspaceRoomDocumentComments,
  getWorkspaceRoomSnapshot,
  getWorkspaceRoomStructureSnapshot,
  initializeWorkspaceRoomCrdt,
  moveWorkspaceRoomNode,
  renameWorkspaceRoomNode,
  setWorkspaceRoomComment,
  setWorkspaceRoomCommentResolved,
  setWorkspaceRoomNodeOrder,
  touchWorkspaceRoomNode,
  validateWorkspaceRoomStructure,
} from "./workspaceRoomCrdt";
export type { WorkspaceRoomBootstrapInput } from "./workspaceRoomBootstrap";
export { createWorkspaceRoomBootstrap } from "./workspaceRoomBootstrap";
export type {
  LoadedWorkspaceRoomCheckpoint,
  SaveWorkspaceRoomCheckpointRequest,
  SaveWorkspaceRoomCheckpointResult,
  WorkspaceRoomCheckpointMetadata,
  WorkspaceRoomCheckpointStore,
} from "./workspaceRoomCheckpoint";
export {
  ROOM_CHECKPOINT_RETENTION_MS,
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
} from "./workspaceRoomCheckpoint";
export {
  AGENT_ROOM_CAPABILITIES,
  DEFAULT_ACTOR_COLOR,
  DEFAULT_ACTOR_NAME,
  DEFAULT_AGENT_ACTOR_CLIENT,
  DEFAULT_HUMAN_ACTOR_CLIENT,
  HUMAN_ROOM_CAPABILITIES,
  ROOM_ACTOR_ADJECTIVES,
  ROOM_ACTOR_COLORS,
  createRoomActorColor,
  createRoomActorName,
  createRoomActor,
  getDefaultRoomCapabilities,
  hasRoomCapability,
  isRoomCapability,
  normalizeRoomCapabilities,
  parseRoomActor,
  parseRoomActorAttribution,
  toRoomActorAttribution,
} from "./roomCollaboration";

export type {
  ShareSnapshot,
  ShareSnapshotComment,
  ShareSnapshotCommentReply,
  ShareSnapshotFile,
  ShareSnapshotFolder,
  ShareSnapshotPayload,
  ShareSnapshotSourceFile,
  ShareSnapshotSourceFolder,
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

export type { StatusBarSaveState } from "./document/statusBarViewModel";
export { getStatusBarSaveState } from "./document/statusBarViewModel";

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

export type { WorkspacePathSegmentIssue } from "./workspacePath";
export {
  WORKSPACE_PATH_SEGMENT_MAX_LENGTH,
  getWorkspacePathSegmentIssue,
  isWorkspacePathSegment,
} from "./workspacePath";

export type {
  WorkspaceConnectionStatus,
  WorkspaceViewFile,
} from "./workspaceViewModel";
export {
  getActiveWorkspaceStatus,
  getWorkspaceFileSearchText,
  getWorkspaceStatusLabel,
} from "./workspaceViewModel";

export type {
  DocumentAnalysis,
  DocumentHeadingAnalysis,
  DocumentLinkAnalysis,
  DocumentLinkRelation,
  DocumentLinkSyntax,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
  WorkspaceLinkStatus,
  WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";
export {
  analyzeWorkspaceDocument,
  createWorkspaceKnowledgeIndex,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
} from "./workspaceKnowledgeIndex";

export type {
  OkfCompatibilityIssue,
  OkfCompatibilityIssueCode,
  OkfCompatibilityIssueSeverity,
  OkfCompatibilityReport,
  OkfCompatibilityStatus,
  OkfDocumentCompatibility,
  OkfDocumentRole,
  OkfDocumentStatus,
} from "./workspaceOkfCompatibility";
export {
  OKF_TARGET_VERSION,
  getWorkspaceOkfCompatibility,
} from "./workspaceOkfCompatibility";
