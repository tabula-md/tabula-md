import { HardDrive, Plus, Users } from "lucide-react";
import { ScopedCreateButton } from "./ScopedCreateButton";

type NewDocumentButtonProps = {
  buttonClassName: string;
  iconSize?: number;
  live: boolean;
  onCreateShared: () => void;
  onCreatePrivate: () => void;
};

export function NewDocumentButton({
  buttonClassName,
  iconSize = 16,
  live,
  onCreateShared,
  onCreatePrivate,
}: NewDocumentButtonProps) {
  return (
    <ScopedCreateButton
      buttonClassName={buttonClassName}
      live={live}
      title="New document"
      triggerIcon={<Plus size={iconSize} />}
      sharedIcon={<Users size={14} />}
      privateIcon={<HardDrive size={14} />}
      sharedLabel="Shared document"
      privateLabel="Private document"
      menuLabel="New document scope"
      onCreateShared={onCreateShared}
      onCreatePrivate={onCreatePrivate}
    />
  );
}
