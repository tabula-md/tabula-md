import { FileOutput } from "lucide-react";
import type { ShareViewModel } from "@tabula-md/tabula";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";
import { ShareChoiceAction } from "./ShareChoiceAction";

type ShareExportPanelProps = {
  copy: WorkspaceShareCopy;
  jsonShare: JsonShareController;
  locked?: boolean;
  shareView: ShareViewModel;
  onExportToJsonLink: () => void;
};

export function ShareExportPanel({
  copy,
  jsonShare,
  locked = false,
  shareView,
  onExportToJsonLink,
}: ShareExportPanelProps) {
  return (
    <ShareChoiceAction
      actionLabel={copy.shareable.exportToLink}
      description={copy.shareable.description}
      disabled={!jsonShare.canExport}
      disabledReason={shareView.shareable.disabledReason || undefined}
      icon={<FileOutput size={18} />}
      locked={locked}
      onClick={onExportToJsonLink}
      title={copy.shareable.title}
    />
  );
}
