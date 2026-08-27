import {
  getOrderedWorkspaceContextItems,
  type WorkspaceContextSummaryItem,
  type WorkspaceContextSummaryViewModel,
} from "./workspaceContextSummary";

export type WorkspaceStatusIndicatorViewModel = {
  kind: WorkspaceContextSummaryItem["kind"];
  label: string;
  description: string;
  tone: "quiet" | "working" | "attention";
};

const findFirstByState = (
  items: readonly WorkspaceContextSummaryItem[],
  states: readonly WorkspaceContextSummaryItem["state"][],
) => items.find((item) => states.includes(item.state));

export const getWorkspaceStatusIndicator = (
  summary: WorkspaceContextSummaryViewModel,
): WorkspaceStatusIndicatorViewModel => {
  const orderedItems = getOrderedWorkspaceContextItems(summary);
  const item =
    findFirstByState(orderedItems, ["attention"]) ??
    findFirstByState(orderedItems, ["pending"]) ??
    findFirstByState(orderedItems, ["working"]) ??
    summary.primary;
  const tone = item.state === "attention" || item.state === "pending"
    ? "attention"
    : item.state === "working"
      ? "working"
      : "quiet";

  return {
    kind: item.kind,
    label: tone === "quiet" ? item.title : item.description,
    description: item.description,
    tone,
  };
};
