import type { ReactNode } from "react";
import { IconButton } from "../../ui/IconButton";

export type SidePanelTabItem<View extends string> = {
  icon: ReactNode;
  indicator?: ReactNode;
  label: string;
  tooltip?: string;
  view: View;
};

type SidePanelTabsProps<View extends string> = {
  activeView: View;
  ariaLabel: string;
  controls: string;
  items: SidePanelTabItem<View>[];
  onSelect: (view: View) => void;
  side: "left" | "right";
};

export function SidePanelTabs<View extends string>({
  activeView,
  ariaLabel,
  controls,
  items,
  onSelect,
  side,
}: SidePanelTabsProps<View>) {
  return (
    <nav className={`${side}-panel-tabs side-panel-tabs`} aria-label={ariaLabel}>
      {items.map((item) => (
        <IconButton
          key={item.view}
          className={`${side}-panel-tab side-panel-tab ${activeView === item.view ? "active" : ""}`}
          label={item.label}
          tooltip={item.tooltip}
          aria-controls={controls}
          aria-pressed={activeView === item.view}
          onClick={() => onSelect(item.view)}
        >
          {item.icon}
          {item.indicator}
        </IconButton>
      ))}
    </nav>
  );
}
