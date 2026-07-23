import { ArrowRight } from "lucide-react";
import { type ReactNode, useId } from "react";

type ShareChoiceActionProps = {
  actionLabel: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  icon: ReactNode;
  locked?: boolean;
  onClick: () => void;
  title: string;
};

export function ShareChoiceAction({
  actionLabel,
  description,
  disabled = false,
  disabledReason,
  icon,
  locked = false,
  onClick,
  title,
}: ShareChoiceActionProps) {
  const actionId = useId();
  const descriptionId = useId();
  const disabledReasonId = useId();
  const titleId = useId();

  return (
    <button
      className={`share-choice-action ${locked ? "locked" : ""}`}
      type="button"
      aria-busy={locked || undefined}
      aria-describedby={disabledReason ? `${descriptionId} ${disabledReasonId}` : descriptionId}
      aria-labelledby={`${titleId} ${actionId}`}
      disabled={disabled || locked}
      title={disabledReason || undefined}
      onClick={onClick}
    >
      <span className="share-modal-option-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="share-choice-copy">
        <span className="share-choice-title" id={titleId}>
          {title}
        </span>
        <span className="share-choice-description" id={descriptionId}>
          {description}
        </span>
        {disabledReason && (
          <span className="share-choice-disabled-reason" id={disabledReasonId}>
            {disabledReason}
          </span>
        )}
      </span>
      <span className="share-choice-cta" id={actionId}>
        <span className="share-modal-title-hidden">{actionLabel}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}
