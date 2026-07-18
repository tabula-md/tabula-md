import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

type ModalSurfaceProps = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  layerClassName?: string;
  onClose: () => void;
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type BackgroundRootState = {
  ariaHidden: string | null;
  element: HTMLElement;
  inert: boolean;
};

const modalStack: symbol[] = [];
let backgroundRootState: BackgroundRootState | null = null;

const registerModal = (modalId: symbol) => {
  const appRoot = document.getElementById("root");
  if (modalStack.length === 0 && appRoot) {
    backgroundRootState = {
      ariaHidden: appRoot.getAttribute("aria-hidden"),
      element: appRoot,
      inert: appRoot.inert,
    };
    appRoot.inert = true;
    appRoot.setAttribute("aria-hidden", "true");
  }
  modalStack.push(modalId);

  return () => {
    const index = modalStack.lastIndexOf(modalId);
    if (index >= 0) modalStack.splice(index, 1);
    if (modalStack.length > 0 || !backgroundRootState) return;

    const { ariaHidden, element, inert } = backgroundRootState;
    element.inert = inert;
    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
    backgroundRootState = null;
  };
};

const isTopModal = (modalId: symbol) => modalStack.at(-1) === modalId;

export function ModalSurface({
  ariaLabel,
  ariaLabelledBy,
  children,
  className = "",
  layerClassName = "",
  onClose,
}: ModalSurfaceProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.focus();
    const unregisterModal = registerModal(modalIdRef.current);
    const frame = window.requestAnimationFrame(() => {
      const initialFocus = dialogRef.current?.querySelector<HTMLElement>(
        "[data-modal-initial-focus], button:not([disabled]), input:not([disabled]), select:not([disabled])",
      );
      initialFocus?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(modalIdRef.current)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      unregisterModal();
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, []);

  const closeFromScrim = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target && isTopModal(modalIdRef.current)) onClose();
  };

  return createPortal(
    <div className={`share-modal-layer ui-modal-layer ${layerClassName}`} onMouseDown={closeFromScrim}>
      <section
        ref={dialogRef}
        className={`share-modal ui-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
