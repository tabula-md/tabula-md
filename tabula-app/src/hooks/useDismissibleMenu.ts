import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
} from "react";

type UseDismissibleMenuOptions = {
  autoFocus?: boolean;
  menuRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
};

const getEnabledMenuItems = (menu: HTMLElement) =>
  Array.from(
    menu.querySelectorAll<HTMLElement>(
      "[role='menuitem']:not([aria-disabled='true']), [role='menuitemcheckbox']:not([aria-disabled='true']), [role='menuitemradio']:not([aria-disabled='true'])",
    ),
  ).filter((item) => !item.hasAttribute("disabled") && item.offsetParent !== null);

export function useDismissibleMenu({
  autoFocus = true,
  menuRef,
  onClose,
  open,
  triggerRef,
}: UseDismissibleMenuOptions) {
  useEffect(() => {
    if (!open) return;

    const menu = menuRef.current;
    let focusWasInsideMenu = Boolean(
      menu && document.activeElement instanceof Node && menu.contains(document.activeElement),
    );
    let outsidePointerDismissal = false;
    const frame = autoFocus
      ? window.requestAnimationFrame(() => {
          const currentMenu = menuRef.current;
          if (currentMenu) getEnabledMenuItems(currentMenu)[0]?.focus();
        })
      : null;
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && menu?.contains(target)) focusWasInsideMenu = true;
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target || menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      outsidePointerDismissal = true;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      const activeElement = document.activeElement;
      const focusNeedsRecovery =
        activeElement === document.body ||
        (activeElement instanceof Node && Boolean(menu?.contains(activeElement)));
      if (focusWasInsideMenu && !outsidePointerDismissal && focusNeedsRecovery) {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
  }, [autoFocus, menuRef, onClose, open, triggerRef]);

  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const menu = menuRef.current;
      if (!menu) return;
      const items = getEnabledMenuItems(menu);
      if (items.length === 0) return;
      const activeIndex = items.findIndex((item) => item === document.activeElement);
      let targetIndex: number | null = null;
      if (event.key === "ArrowDown") targetIndex = activeIndex + 1;
      else if (event.key === "ArrowUp") targetIndex = activeIndex - 1;
      else if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = items.length - 1;
      if (targetIndex === null) return;

      event.preventDefault();
      const normalizedIndex = (targetIndex + items.length) % items.length;
      items[normalizedIndex]?.focus();
    },
    [menuRef],
  );
}
