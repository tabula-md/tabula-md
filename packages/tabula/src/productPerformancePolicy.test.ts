import { describe, expect, it } from "vitest";
import {
  TABULA_LARGE_DOCUMENT_UX_POLICY,
  TABULA_PRODUCT_SUPPORT_TARGETS,
} from "./productPerformancePolicy";

describe("product performance policy", () => {
  it("defines the public preview and launch Markdown comfort targets", () => {
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.betaMarkdownBytes).toBe(150_000);
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.launchMarkdownBytes).toBe(1_000_000);
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.launchMarkdownBytes).toBeGreaterThan(
      TABULA_PRODUCT_SUPPORT_TARGETS.betaMarkdownBytes,
    );
  });

  it("defines the collaboration comfort target", () => {
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.collaborationMinPeople).toBe(2);
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.collaborationMaxPeople).toBe(5);
    expect(TABULA_PRODUCT_SUPPORT_TARGETS.collaborationSoakDurationMs).toBe(30 * 60 * 1000);
  });

  it("keeps large-document UX biased toward editor responsiveness", () => {
    expect(TABULA_LARGE_DOCUMENT_UX_POLICY.editorResponsivenessFirst).toBe(true);
    expect(TABULA_LARGE_DOCUMENT_UX_POLICY.splitViewPriority).toBe("editor-responsiveness");
    expect(TABULA_LARGE_DOCUMENT_UX_POLICY.previewRefresh).toBe("idle-only");
    expect(TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus).toBe(false);
  });
});
