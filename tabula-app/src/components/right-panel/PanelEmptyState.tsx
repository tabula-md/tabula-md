import type { ReactNode } from "react";

type PanelEmptyStateProps = {
  children: ReactNode;
};

export function PanelEmptyState({ children }: PanelEmptyStateProps) {
  return <p className="right-empty-state">{children}</p>;
}
