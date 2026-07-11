import { useState } from "react";
import { X } from "lucide-react";

type AppToastProps = {
  dismissLabel: string;
  message: string;
  tone?: "error" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
};

export function AppToast({
  dismissLabel,
  message,
  tone = "neutral",
  actionLabel,
  onAction,
  onDismiss,
  onPause,
  onResume,
}: AppToastProps) {
  const [focusWithin, setFocusWithin] = useState(false);
  const [hovered, setHovered] = useState(false);
  const updateInteraction = (nextHovered: boolean, nextFocusWithin: boolean) => {
    if (nextHovered || nextFocusWithin) onPause();
    else onResume();
  };

  return (
    <div
      className="toast-viewport"
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div
        className={`app-toast ${tone}`}
        onMouseEnter={() => {
          setHovered(true);
          updateInteraction(true, focusWithin);
        }}
        onMouseLeave={() => {
          setHovered(false);
          updateInteraction(false, focusWithin);
        }}
        onFocusCapture={() => {
          setFocusWithin(true);
          updateInteraction(hovered, true);
        }}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setFocusWithin(false);
          updateInteraction(hovered, false);
        }}
      >
        <span>{message}</span>
        {actionLabel && onAction && (
          <button className="app-toast-action" type="button" onClick={() => {
            onDismiss();
            onAction();
          }}>
            {actionLabel}
          </button>
        )}
        <button className="app-toast-dismiss" type="button" aria-label={dismissLabel} onClick={onDismiss}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
