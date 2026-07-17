import { describe, expect, it } from "vitest";
import {
  EDIT_MODE_DERIVED_STATE_DELAY_MS,
  getPreviewBodyDerivationDelayMs,
  getPreviewMetadataDerivationDelayMs,
  getWordCountDerivationDelayMs,
  IMMEDIATE_PREVIEW_MAX_CHARACTERS,
  LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS,
  LARGE_DOCUMENT_PREVIEW_BODY_DELAY_MS,
  LARGE_DOCUMENT_METADATA_DERIVED_STATE_DELAY_MS,
  LARGE_DOCUMENT_METADATA_IDLE_TIMEOUT_MS,
  PATCHED_PREVIEW_BODY_MAX_CHARACTERS,
  PREVIEW_MODE_DERIVED_STATE_DELAY_MS,
  shouldDeriveImmediatePreviewState,
  shouldDerivePreviewBodyImmediately,
  shouldPatchPreviewBodyImmediately,
  SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS,
} from "./previewDerivationPolicy";

describe("preview derivation policy", () => {
  it("derives full preview immediately only for eligible non-edit documents", () => {
    expect(
      shouldDeriveImmediatePreviewState({
        hasActiveFile: true,
        largeDocumentMode: false,
        markdownPreviewEligible: true,
        textLength: IMMEDIATE_PREVIEW_MAX_CHARACTERS,
        viewMode: "split",
      }),
    ).toBe(true);

    expect(
      shouldDeriveImmediatePreviewState({
        hasActiveFile: true,
        largeDocumentMode: false,
        markdownPreviewEligible: true,
        textLength: IMMEDIATE_PREVIEW_MAX_CHARACTERS + 1,
        viewMode: "split",
      }),
    ).toBe(false);
    expect(
      shouldDeriveImmediatePreviewState({
        hasActiveFile: true,
        largeDocumentMode: false,
        markdownPreviewEligible: true,
        textLength: 10,
        viewMode: "edit",
      }),
    ).toBe(false);
    expect(
      shouldDeriveImmediatePreviewState({
        hasActiveFile: true,
        largeDocumentMode: false,
        markdownPreviewEligible: false,
        textLength: 10,
        viewMode: "preview",
      }),
    ).toBe(false);
    expect(
      shouldDeriveImmediatePreviewState({
        hasActiveFile: false,
        largeDocumentMode: false,
        markdownPreviewEligible: true,
        textLength: 10,
        viewMode: "preview",
      }),
    ).toBe(false);
  });

  it("derives preview body immediately in preview-capable modes only", () => {
    expect(shouldDerivePreviewBodyImmediately({ hasActiveFile: true, viewMode: "preview" })).toBe(true);
    expect(shouldDerivePreviewBodyImmediately({ hasActiveFile: true, viewMode: "split" })).toBe(true);
    expect(shouldDerivePreviewBodyImmediately({ hasActiveFile: true, viewMode: "edit" })).toBe(false);
    expect(shouldDerivePreviewBodyImmediately({ hasActiveFile: false, viewMode: "split" })).toBe(false);
  });

  it("limits patch-based live preview to moderately large documents", () => {
    expect(
      shouldPatchPreviewBodyImmediately({
        hasActiveFile: true,
        largeDocumentMode: true,
        textLength: PATCHED_PREVIEW_BODY_MAX_CHARACTERS,
        viewMode: "split",
      }),
    ).toBe(true);
    expect(
      shouldPatchPreviewBodyImmediately({
        hasActiveFile: true,
        largeDocumentMode: true,
        textLength: PATCHED_PREVIEW_BODY_MAX_CHARACTERS + 1,
        viewMode: "split",
      }),
    ).toBe(false);
  });

  it("keeps preview body delay precedence stable", () => {
    expect(
      getPreviewBodyDerivationDelayMs({
        largeDocumentMode: true,
        textLength: 1,
        viewMode: "edit",
      }),
    ).toBe(LARGE_DOCUMENT_PREVIEW_BODY_DELAY_MS);
    expect(
      getPreviewBodyDerivationDelayMs({
        largeDocumentMode: false,
        textLength: 1,
        viewMode: "edit",
      }),
    ).toBe(EDIT_MODE_DERIVED_STATE_DELAY_MS);
    expect(
      getPreviewBodyDerivationDelayMs({
        largeDocumentMode: false,
        textLength: 1,
        viewMode: "split",
      }),
    ).toBe(SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS);
    expect(
      getPreviewBodyDerivationDelayMs({
        largeDocumentMode: false,
        textLength: Number.MAX_SAFE_INTEGER,
        viewMode: "preview",
      }),
    ).toBe(PREVIEW_MODE_DERIVED_STATE_DELAY_MS);
  });

  it("uses a longer idle-backed metadata delay for large documents", () => {
    expect(
      getPreviewMetadataDerivationDelayMs({
        largeDocumentMode: true,
        textLength: 1,
        viewMode: "edit",
      }),
    ).toBe(LARGE_DOCUMENT_METADATA_DERIVED_STATE_DELAY_MS);
    expect(LARGE_DOCUMENT_METADATA_IDLE_TIMEOUT_MS).toBe(10_000);
    expect(
      getPreviewMetadataDerivationDelayMs({
        largeDocumentMode: false,
        textLength: 1,
        viewMode: "edit",
      }),
    ).toBe(EDIT_MODE_DERIVED_STATE_DELAY_MS);
    expect(
      getPreviewMetadataDerivationDelayMs({
        largeDocumentMode: false,
        textLength: Number.MAX_SAFE_INTEGER,
        viewMode: "preview",
      }),
    ).toBe(PREVIEW_MODE_DERIVED_STATE_DELAY_MS);
  });

  it("lets edit mode keep the fast word count path even for large documents", () => {
    expect(
      getWordCountDerivationDelayMs({
        largeDocumentMode: true,
        textLength: Number.MAX_SAFE_INTEGER,
        viewMode: "edit",
      }),
    ).toBe(EDIT_MODE_DERIVED_STATE_DELAY_MS);
    expect(
      getWordCountDerivationDelayMs({
        largeDocumentMode: true,
        textLength: 1,
        viewMode: "split",
      }),
    ).toBe(LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS);
    expect(
      getWordCountDerivationDelayMs({
        largeDocumentMode: false,
        textLength: 1,
        viewMode: "preview",
      }),
    ).toBe(SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS);
    expect(
      getWordCountDerivationDelayMs({
        largeDocumentMode: false,
        textLength: Number.MAX_SAFE_INTEGER,
        viewMode: "split",
      }),
    ).toBe(PREVIEW_MODE_DERIVED_STATE_DELAY_MS);
  });
});
