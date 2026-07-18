import { Plus } from "lucide-react";

type NewDocumentButtonProps = {
  buttonClassName: string;
  iconSize?: number;
  label?: string;
  onCreate: () => void;
};

export function NewDocumentButton({
  buttonClassName,
  iconSize = 16,
  label = "New document",
  onCreate,
}: NewDocumentButtonProps) {
  return (
    <button
      className={buttonClassName}
      type="button"
      aria-label={label}
      data-tooltip={label}
      onClick={onCreate}
    >
      <Plus size={iconSize} />
    </button>
  );
}
