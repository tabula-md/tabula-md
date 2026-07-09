export const TABULA_PRODUCT_SUPPORT_TARGETS = {
  betaMarkdownBytes: 150_000,
  launchMarkdownBytes: 1_000_000,
  collaborationMinPeople: 2,
  collaborationMaxPeople: 5,
  collaborationSoakDurationMs: 30 * 60 * 1000,
} as const;

export const TABULA_LARGE_DOCUMENT_UX_POLICY = {
  editorResponsivenessFirst: true,
  splitViewPriority: "editor-responsiveness",
  previewRefresh: "idle-only",
  showTransientPreviewStatus: false,
} as const;
