import { Plus } from "lucide-react";

type NewDocumentButtonProps = {
  buttonClassName: string;
  iconSize?: number;
  onCreate: () => void;
};

export function NewDocumentButton({
  buttonClassName,
  iconSize = 16,
  onCreate,
}: NewDocumentButtonProps) {
  return (
    <button
      className={buttonClassName}
      type="button"
      title="New document"
      aria-label="New document"
      onClick={onCreate}
    >
      <Plus size={iconSize} />
    </button>
  );
}
