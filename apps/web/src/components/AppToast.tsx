type AppToastProps = {
  message: string;
  tone?: "error" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
};

export function AppToast({ message, tone = "neutral", actionLabel, onAction }: AppToastProps) {
  return (
    <div className="toast-viewport" role="status" aria-live="assertive" aria-atomic="true">
      <div className={`app-toast ${tone}`}>
        <span>{message}</span>
        {actionLabel && onAction && (
          <button className="app-toast-action" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
