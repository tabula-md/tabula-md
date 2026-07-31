import type {
  DocumentAnalysis,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeMetadata,
} from "./workspaceKnowledgeIndex";

export type OkfReviewSchedule =
  | "current"
  | "due"
  | "unscheduled"
  | "invalid";

export type OkfDocumentAttentionSignal =
  | "unverified"
  | "review-due"
  | "invalid-review-date";

export type WorkspaceKnowledgePosture = {
  conceptCount: number;
  currentCount: number;
  reviewDueCount: number;
  unscheduledCount: number;
  invalidReviewDateCount: number;
  unverifiedCount: number;
  draftCount: number;
  deprecatedCount: number;
};

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isConceptPath = (path: string) => {
  const basename = path.split("/").at(-1)?.toLocaleLowerCase();
  return basename !== "index.md" && basename !== "log.md";
};

export const getOkfReviewSchedule = (
  metadata: Pick<WorkspaceKnowledgeMetadata, "staleAfter">,
  today = new Date().toISOString().slice(0, 10),
): OkfReviewSchedule => {
  if (!metadata.staleAfter) return "unscheduled";
  if (!isCalendarDate(metadata.staleAfter)) return "invalid";
  return today >= metadata.staleAfter ? "due" : "current";
};

export const getOkfDocumentAttentionSignals = (
  analysis: Pick<DocumentAnalysis, "path" | "knowledgeMetadata">,
  today = new Date().toISOString().slice(0, 10),
): readonly OkfDocumentAttentionSignal[] => {
  const metadata = analysis.knowledgeMetadata;
  if (!metadata.type || !isConceptPath(analysis.path)) return [];
  const signals: OkfDocumentAttentionSignal[] = [];

  if (metadata.generated && metadata.trustTier === "unverified") {
    signals.push("unverified");
  }

  const reviewSchedule = getOkfReviewSchedule(metadata, today);
  if (reviewSchedule === "due") signals.push("review-due");
  if (reviewSchedule === "invalid") signals.push("invalid-review-date");
  return signals;
};

export const getWorkspaceKnowledgePosture = (
  index: WorkspaceKnowledgeIndex,
  today = new Date().toISOString().slice(0, 10),
): WorkspaceKnowledgePosture => {
  const posture: WorkspaceKnowledgePosture = {
    conceptCount: 0,
    currentCount: 0,
    reviewDueCount: 0,
    unscheduledCount: 0,
    invalidReviewDateCount: 0,
    unverifiedCount: 0,
    draftCount: 0,
    deprecatedCount: 0,
  };

  for (const analysis of index.analysesByDocumentId.values()) {
    const metadata = analysis.knowledgeMetadata;
    if (!metadata.type || !isConceptPath(analysis.path)) continue;

    posture.conceptCount += 1;
    const reviewSchedule = getOkfReviewSchedule(metadata, today);
    if (reviewSchedule === "current") posture.currentCount += 1;
    if (reviewSchedule === "due") posture.reviewDueCount += 1;
    if (reviewSchedule === "unscheduled") posture.unscheduledCount += 1;
    if (reviewSchedule === "invalid") posture.invalidReviewDateCount += 1;
    if (metadata.trustTier === "unverified") posture.unverifiedCount += 1;
    if (metadata.status === "draft") posture.draftCount += 1;
    if (metadata.status === "deprecated") posture.deprecatedCount += 1;
  }

  return posture;
};
