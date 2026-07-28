import { useEffect, useRef, useState } from "react";

export type AppToastState = {
  id: number;
  message: string;
  tone: "error" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
};

const DEFAULT_TOAST_DURATION_MS = 3200;
const ACTION_TOAST_DURATION_MS = 10_000;

export const getAppToastDuration = (
  tone: AppToastState["tone"],
  hasAction: boolean,
) => {
  if (tone === "error") return null;
  if (hasAction) return ACTION_TOAST_DURATION_MS;
  return DEFAULT_TOAST_DURATION_MS;
};

export function useAppToast() {
  const [toast, setToast] = useState<AppToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastDeadlineRef = useRef(0);
  const toastIdRef = useRef(0);
  const remainingDurationRef = useRef(DEFAULT_TOAST_DURATION_MS);

  const clearToastTimer = () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const scheduleDismiss = (toastId: number, durationMs: number) => {
    clearToastTimer();
    remainingDurationRef.current = durationMs;
    toastDeadlineRef.current = Date.now() + durationMs;
    toastTimerRef.current = window.setTimeout(() => {
      setToast((currentToast) => currentToast?.id === toastId ? null : currentToast);
      if (toastIdRef.current === toastId) toastIdRef.current = 0;
      toastTimerRef.current = null;
    }, durationMs);
  };

  const dismissToast = () => {
    clearToastTimer();
    toastIdRef.current = 0;
    setToast(null);
  };

  const pauseToast = () => {
    if (toastTimerRef.current === null) return;
    remainingDurationRef.current = Math.max(0, toastDeadlineRef.current - Date.now());
    clearToastTimer();
  };

  const resumeToast = () => {
    if (toastTimerRef.current !== null || toastIdRef.current === 0) return;
    scheduleDismiss(toastIdRef.current, Math.max(250, remainingDurationRef.current));
  };

  const showToast = (
    message: string,
    tone: AppToastState["tone"] = "neutral",
    action?: Pick<AppToastState, "actionLabel" | "onAction">,
  ) => {
    const toastId = toastIdRef.current + 1;
    toastIdRef.current = toastId;
    setToast({ id: toastId, message, tone, ...action });
    const duration = getAppToastDuration(tone, Boolean(action?.onAction));
    if (duration === null) {
      clearToastTimer();
      remainingDurationRef.current = 0;
      toastDeadlineRef.current = 0;
    } else {
      scheduleDismiss(toastId, duration);
    }
  };

  useEffect(() => {
    return () => {
      clearToastTimer();
    };
  }, []);

  return {
    toast,
    dismissToast,
    pauseToast,
    resumeToast,
    showToast,
  };
}
