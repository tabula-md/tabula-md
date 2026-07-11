import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type ScopedCreateButtonProps = {
  buttonClassName: string;
  live: boolean;
  title: string;
  triggerIcon: ReactNode;
  sharedIcon: ReactNode;
  privateIcon: ReactNode;
  sharedLabel: string;
  privateLabel: string;
  menuLabel: string;
  onCreateShared: () => void;
  onCreatePrivate: () => void;
};

export function ScopedCreateButton({
  buttonClassName,
  live,
  title,
  triggerIcon,
  sharedIcon,
  privateIcon,
  sharedLabel,
  privateLabel,
  menuLabel,
  onCreateShared,
  onCreatePrivate,
}: ScopedCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target || !wrapRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === "ArrowDown"
      ? (index + 1) % 2
      : event.key === "ArrowUp"
        ? (index + 1) % 2
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 1
            : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      itemRefs.current[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const create = (scope: "shared" | "private") => {
    setOpen(false);
    if (scope === "shared") onCreateShared();
    else onCreatePrivate();
  };

  return (
    <div className="new-document-menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        className={buttonClassName}
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup={live ? "menu" : undefined}
        aria-controls={live ? menuId : undefined}
        aria-expanded={live ? open : undefined}
        onKeyDown={(event) => {
          if (live && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={() => {
          if (live) setOpen((current) => !current);
          else onCreateShared();
        }}
      >
        {triggerIcon}
      </button>

      {live && open && (
        <div id={menuId} className="new-document-menu" role="menu" aria-label={menuLabel}>
          <button
            ref={(element) => { itemRefs.current[0] = element; }}
            type="button"
            role="menuitem"
            onKeyDown={(event) => handleMenuKeyDown(event, 0)}
            onClick={() => create("shared")}
          >
            {sharedIcon}
            <span>{sharedLabel}</span>
          </button>
          <button
            ref={(element) => { itemRefs.current[1] = element; }}
            type="button"
            role="menuitem"
            onKeyDown={(event) => handleMenuKeyDown(event, 1)}
            onClick={() => create("private")}
          >
            {privateIcon}
            <span>{privateLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
