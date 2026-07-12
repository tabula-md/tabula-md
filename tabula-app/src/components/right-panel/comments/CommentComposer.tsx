import { type RefObject } from "react";
import { WORKSPACE_ROOM_MAX_COMMENT_LENGTH } from "@tabula-md/tabula";
import type { RightPanelCommentsCopy } from "./types";

type CommentComposerProps = {
  activeFileTitle: string;
  commentDraft: string;
  copy: RightPanelCommentsCopy;
  identityName: string;
  selectedText: string;
  selectedCharacterCount: number;
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
  copy,
  identityName,
  selectedText,
  selectedCharacterCount,
  commentInputRef,
  onCancel,
  onCommentDraftChange,
  onIdentityNameChange,
  onIdentityNameCommit,
  onAddComment,
}: CommentComposerProps) {
  const hasSelection = selectedCharacterCount > 0;
  const canCancel = hasSelection || commentDraft.trim().length > 0;
  const selectedPreview = selectedText.replace(/\s+/g, " ").trim();
  const isExpanded = hasSelection || commentDraft.trim().length > 0;

  return (
    <div className={`right-comment-form ${isExpanded ? "expanded" : ""}`}>
      <label className="right-comment-composer-identity">
        <span>{copy.as}</span>
        <input
          value={identityName}
          aria-label={copy.authorName}
          maxLength={40}
          onBlur={onIdentityNameCommit}
          onChange={(event) => onIdentityNameChange(event.target.value)}
        />
      </label>
      <textarea
        ref={commentInputRef}
        className="right-comment-input"
        maxLength={WORKSPACE_ROOM_MAX_COMMENT_LENGTH}
        value={commentDraft}
        onChange={(event) => onCommentDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onAddComment();
          }
        }}
        placeholder={hasSelection ? copy.selectedPlaceholder : copy.filePlaceholder}
        rows={2}
        aria-label={copy.addTo(activeFileTitle)}
      />
      <div className="right-comment-form-footer">
        {hasSelection && (
          <span className="right-comment-scope">
            {selectedPreview
              ? copy.selected(selectedPreview)
              : copy.selectedCharacters(selectedCharacterCount)}
          </span>
        )}
        <span className="right-comment-form-actions">
          {canCancel && (
            <button className="right-comment-text-button" type="button" onClick={onCancel}>
              {copy.cancel}
            </button>
          )}
          <button
            className="right-comment-submit"
            type="button"
            disabled={!commentDraft.trim()}
            onClick={onAddComment}
          >
            {copy.comment}
          </button>
        </span>
      </div>
    </div>
  );
}
