import type {
  ComponentPropsWithoutRef,
  ReactNode,
  RefObject,
} from "react";

type PanelShellProps = Omit<
  ComponentPropsWithoutRef<"aside">,
  "aria-label" | "children" | "className" | "ref"
> & {
  ariaLabel: string;
  children: ReactNode;
  isOpen: boolean;
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
  side: "left" | "right";
};

export function PanelShell({
  ariaLabel,
  children,
  isOpen,
  overlayMode = false,
  panelRef,
  side,
  ...attributes
}: PanelShellProps) {
  if (!isOpen) return null;

  return (
    <aside
      {...attributes}
      ref={panelRef}
      className={`${side}-panel`}
      role={overlayMode ? "dialog" : undefined}
      aria-modal={overlayMode || undefined}
      aria-label={ariaLabel}
      tabIndex={overlayMode ? -1 : undefined}
    >
      {children}
    </aside>
  );
}
