import { LIVE_PREVIEW_CHAR_THRESHOLD } from "@tabula-md/tabula";
import type { FileViewMode } from "../workspaceStorage";

export const EDIT_MODE_DERIVED_STATE_DELAY_MS = 240;
export const SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS = 120;
export const PREVIEW_MODE_DERIVED_STATE_DELAY_MS = 220;
export const LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS = 720;
export const LARGE_DOCUMENT_PREVIEW_BODY_DELAY_MS = 240;
export const LARGE_DOCUMENT_METADATA_DERIVED_STATE_DELAY_MS = 6_000;
export const LARGE_DOCUMENT_METADATA_IDLE_TIMEOUT_MS = 10_000;
export const IMMEDIATE_PREVIEW_MAX_CHARACTERS = 250_000;
export const PATCHED_PREVIEW_BODY_MAX_CHARACTERS = 256_000;

type PreviewDerivationInput = {
  largeDocumentMode: boolean;
  textLength: number;
  viewMode: FileViewMode;
};

type ImmediatePreviewDerivationInput = PreviewDerivationInput & {
  hasActiveFile: boolean;
  markdownPreviewEligible: boolean;
};

export const shouldDeriveImmediatePreviewState = ({
  hasActiveFile,
  markdownPreviewEligible,
  textLength,
  viewMode,
}: ImmediatePreviewDerivationInput) =>
  hasActiveFile &&
  viewMode !== "edit" &&
  textLength <= IMMEDIATE_PREVIEW_MAX_CHARACTERS &&
  markdownPreviewEligible;

export const shouldDerivePreviewBodyImmediately = ({
  hasActiveFile,
  viewMode,
}: Pick<ImmediatePreviewDerivationInput, "hasActiveFile" | "viewMode">) =>
  hasActiveFile && viewMode !== "edit";

export const shouldPatchPreviewBodyImmediately = ({
  hasActiveFile,
  largeDocumentMode,
  textLength,
  viewMode,
}: Pick<ImmediatePreviewDerivationInput, "hasActiveFile" | "largeDocumentMode" | "textLength" | "viewMode">) =>
  hasActiveFile &&
  largeDocumentMode &&
  viewMode !== "edit" &&
  textLength <= PATCHED_PREVIEW_BODY_MAX_CHARACTERS;

export const getPreviewBodyDerivationDelayMs = ({
  largeDocumentMode,
  textLength,
  viewMode,
}: PreviewDerivationInput) => {
  if (largeDocumentMode) {
    return LARGE_DOCUMENT_PREVIEW_BODY_DELAY_MS;
  }

  if (viewMode === "edit") {
    return EDIT_MODE_DERIVED_STATE_DELAY_MS;
  }

  return textLength <= LIVE_PREVIEW_CHAR_THRESHOLD
    ? SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS
    : PREVIEW_MODE_DERIVED_STATE_DELAY_MS;
};

export const getPreviewMetadataDerivationDelayMs = ({
  largeDocumentMode,
  textLength,
  viewMode,
}: PreviewDerivationInput) => {
  if (largeDocumentMode) {
    return LARGE_DOCUMENT_METADATA_DERIVED_STATE_DELAY_MS;
  }

  if (viewMode === "edit") {
    return EDIT_MODE_DERIVED_STATE_DELAY_MS;
  }

  return textLength <= LIVE_PREVIEW_CHAR_THRESHOLD
    ? SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS
    : PREVIEW_MODE_DERIVED_STATE_DELAY_MS;
};

export const getWordCountDerivationDelayMs = ({
  largeDocumentMode,
  textLength,
  viewMode,
}: PreviewDerivationInput) => {
  if (viewMode === "edit") {
    return EDIT_MODE_DERIVED_STATE_DELAY_MS;
  }

  if (largeDocumentMode) {
    return LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS;
  }

  return textLength <= LIVE_PREVIEW_CHAR_THRESHOLD
    ? SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS
    : PREVIEW_MODE_DERIVED_STATE_DELAY_MS;
};
