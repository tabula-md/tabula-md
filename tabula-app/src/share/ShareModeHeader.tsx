import type { ReactNode } from "react";

type ShareModeHeaderProps = {
  description: string;
  descriptionId?: string;
  headingId?: string;
  headingLevel: 2 | 3;
  icon: ReactNode;
  title: string;
};

export function ShareModeHeader({
  description,
  descriptionId,
  headingId,
  headingLevel,
  icon,
  title,
}: ShareModeHeaderProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <header className="share-mode-header">
      <span className="share-modal-option-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <Heading id={headingId}>{title}</Heading>
        <p id={descriptionId}>{description}</p>
      </div>
    </header>
  );
}
