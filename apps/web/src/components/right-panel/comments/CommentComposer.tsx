import { type RefObject } from "react";

type CommentComposerProps = {
  activeFileTitle: string;
  commentDraft: string;
  identityName: string;
  selectedText: string;
  selectedWordCount: number;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
  onCancel: () => void;
  onCommentDraftChange: (draft: string) => void;
  onIdentityNameChange: (name: string) => void;
  onIdentityNameCommit: () => void;
  onAddComment: () => void;
};

export function CommentComposer({
  activeFileTitle,
  commentDraft,
  identityName,
  selectedText,
  selectedWordCount,
  commentInputRef,
  onCancel,
  onCommentDraftChange,
  onIdentityNameChange,
  onIdentityNameCommit,
  onAddComment,
}: CommentComposerProps) {
  const hasSelection = selectedWordCount > 0;
  const canCancel = hasSelection || commentDraft.trim().length > 0;
  const selectedPreview = selectedText.replace(/\s+/g, " ").trim();
  const isExpanded = hasSelection || commentDraft.trim().length > 0;

  return (
    <div className={`right-comment-form ${isExpanded ? "expanded" : ""}`}>
      <label className="right-comment-composer-identity">
        <span>as</span>
        <input
          value={identityName}
          aria-label="Comment author name"
          maxLength={40}
          onBlur={onIdentityNameCommit}
          onChange={(event) => onIdentityNameChange(event.target.value)}
        />
      </label>
      <textarea
        ref={commentInputRef}
        className="right-comment-input"
        value={commentDraft}
        onChange={(event) => onCommentDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onAddComment();
          }
        }}
        placeholder={hasSelection ? "Comment on selected text" : "Add file comment"}
        rows={2}
        aria-label={`Add comment to ${activeFileTitle}`}
      />
      <div className="right-comment-form-footer">
        {hasSelection && (
          <span className="right-comment-scope">
            {selectedPreview ? `Selected: "${selectedPreview}"` : `${selectedWordCount} selected ${selectedWordCount === 1 ? "word" : "words"}`}
          </span>
        )}
        <span className="right-comment-form-actions">
          {canCancel && (
            <button className="right-comment-text-button" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="right-comment-submit"
            type="button"
            disabled={!commentDraft.trim()}
            onClick={onAddComment}
          >
            Comment
          </button>
        </span>
      </div>
    </div>
  );
}
