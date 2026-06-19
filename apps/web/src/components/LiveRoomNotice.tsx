import { AlertTriangle, Copy, Link2, Unplug } from "lucide-react";

type LiveRoomNoticeProps = {
  title: string;
  message: string;
  canKeepLocal?: boolean;
  onCopyMarkdown: () => void;
  onKeepLocal: () => void;
  onOpenShare: () => void;
};

export function LiveRoomNotice({
  title,
  message,
  canKeepLocal = false,
  onCopyMarkdown,
  onKeepLocal,
  onOpenShare,
}: LiveRoomNoticeProps) {
  return (
    <aside className="live-room-notice" aria-label="Live room status">
      <AlertTriangle size={16} aria-hidden="true" />
      <div className="live-room-notice-copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <div className="live-room-notice-actions">
        <button type="button" onClick={onOpenShare}>
          <Link2 size={14} />
          <span>Open Share</span>
        </button>
        <button type="button" onClick={onCopyMarkdown}>
          <Copy size={14} />
          <span>Copy Markdown</span>
        </button>
        {canKeepLocal && (
          <button type="button" onClick={onKeepLocal}>
            <Unplug size={14} />
            <span>Keep local copy</span>
          </button>
        )}
      </div>
    </aside>
  );
}
