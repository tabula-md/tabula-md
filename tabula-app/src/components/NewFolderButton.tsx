import { FolderPlus, HardDrive, Users } from "lucide-react";
import { ScopedCreateButton } from "./ScopedCreateButton";

type NewFolderButtonProps = {
  buttonClassName: string;
  live: boolean;
  onCreateShared: () => void;
  onCreatePrivate: () => void;
};

export function NewFolderButton({
  buttonClassName,
  live,
  onCreateShared,
  onCreatePrivate,
}: NewFolderButtonProps) {
  return (
    <ScopedCreateButton
      buttonClassName={buttonClassName}
      live={live}
      title="New folder"
      triggerIcon={<FolderPlus size={15} />}
      sharedIcon={<Users size={14} />}
      privateIcon={<HardDrive size={14} />}
      sharedLabel="Shared folder"
      privateLabel="Private folder"
      menuLabel="New folder scope"
      onCreateShared={onCreateShared}
      onCreatePrivate={onCreatePrivate}
    />
  );
}
