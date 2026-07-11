import { FolderPlus } from "lucide-react";

type NewFolderButtonProps = {
  buttonClassName: string;
  onCreate: () => void;
};

export function NewFolderButton({
  buttonClassName,
  onCreate,
}: NewFolderButtonProps) {
  return (
    <button
      className={buttonClassName}
      type="button"
      title="New folder"
      aria-label="New folder"
      onClick={onCreate}
    >
      <FolderPlus size={15} />
    </button>
  );
}
