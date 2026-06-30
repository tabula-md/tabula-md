import { useEffect, useRef, useState } from "react";

export type AppToastState = {
  id: number;
  message: string;
  tone: "error" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
};

export function useAppToast() {
  const [toast, setToast] = useState<AppToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (
    message: string,
    tone: AppToastState["tone"] = "neutral",
    action?: Pick<AppToastState, "actionLabel" | "onAction">,
  ) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({ id: Date.now(), message, tone, ...action });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    toast,
    showToast,
  };
}
