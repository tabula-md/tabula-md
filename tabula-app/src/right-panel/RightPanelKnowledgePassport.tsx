import {
  getOkfReviewSchedule,
  type WorkspaceKnowledgeMetadata,
} from "@tabula-md/tabula";
import type { KnowledgePanelCopy } from "../workspace/knowledgePanelLocale";

const displayActor = (actor: string) => actor.replace(/^human:/, "");
const displayDate = (dateTime: string) => dateTime.slice(0, 10);

export function RightPanelKnowledgePassport({
  copy,
  metadata,
}: {
  copy: KnowledgePanelCopy;
  metadata: WorkspaceKnowledgeMetadata;
}) {
  const latestVerification = metadata.verified.at(-1);
  const trustValue = metadata.trustTier === "human-reviewed"
    ? copy.humanReviewed
    : metadata.trustTier === "machine-confirmed"
      ? copy.machineConfirmed
      : copy.unverified;
  const reviewSchedule = getOkfReviewSchedule(metadata);
  const freshnessValue = reviewSchedule === "current"
    ? copy.current
    : reviewSchedule === "due"
      ? copy.reviewDue
      : reviewSchedule === "invalid"
        ? copy.invalidReviewDate
        : copy.noReviewDate;
  const freshnessDetail = reviewSchedule === "current"
    ? copy.reviewAfter(metadata.staleAfter!)
    : reviewSchedule === "due"
      ? copy.reviewDueSince(metadata.staleAfter!)
      : reviewSchedule === "invalid"
        ? copy.invalidReviewDateValue(metadata.staleAfter!)
        : copy.noReviewScheduled;

  return (
    <section
      className="right-knowledge-passport"
      aria-label={copy.knowledgePassport}
    >
      <h3>{copy.knowledgePassport}</h3>
      <dl>
        <div data-axis="lifecycle">
          <dt>{copy.lifecycle}</dt>
          <dd>
            <strong>{copy.lifecycleStatus(metadata.status)}</strong>
          </dd>
        </div>
        <div data-axis="trust">
          <dt>{copy.trust}</dt>
          <dd>
            <strong>{trustValue}</strong>
            <small>
              {latestVerification
                ? copy.actorAndDate(
                    displayActor(latestVerification.by),
                    displayDate(latestVerification.at),
                  )
                : copy.neverVerified}
            </small>
          </dd>
        </div>
        <div data-axis="freshness">
          <dt>{copy.freshness}</dt>
          <dd>
            <strong>{freshnessValue}</strong>
            <small>{freshnessDetail}</small>
          </dd>
        </div>
      </dl>
    </section>
  );
}
