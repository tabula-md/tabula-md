import {
  ChevronDown,
  CopyMinus,
  CopyX,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../ui/Menu";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";

type OpenTabsMenuProps = {
  activeFile?: WorkspaceFile;
  folders: WorkspaceFolder[];
  language: WorkspaceLanguage;
  lastClosedFile?: WorkspaceFile;
  openFiles: WorkspaceFile[];
  onCloseAllFiles: () => void;
  onCloseOtherFiles: () => void;
  onOpen: () => void;
  onReopenLastClosedFile: () => void;
  onSelectFile: (fileId: string) => void;
};

const getTabDisplayTitle = (title: string) =>
  title.replace(/\.(?:md|markdown)$/i, "");

export function OpenTabsMenu({
  activeFile,
  folders,
  language,
  lastClosedFile,
  openFiles,
  onCloseAllFiles,
  onCloseOtherFiles,
  onOpen,
  onReopenLastClosedFile,
  onSelectFile,
}: OpenTabsMenuProps) {
  const [open, setOpen] = useState(false);
  const copy = getWorkspaceInterfaceCopy(language).tabs;
  const tabLabels = useMemo(
    () => getWorkspaceFileTabLabels(openFiles, folders),
    [folders, openFiles],
  );
  const activeTabTitle = activeFile
    ? getTabDisplayTitle(
        tabLabels.get(activeFile.id)?.displayTitle ?? activeFile.title,
      )
    : null;

  if (openFiles.length === 0 && !lastClosedFile) {
    return null;
  }

  return (
    <MenuRoot
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) onOpen();
      }}
    >
      <MenuTrigger asChild>
        <button
          className="panel-toggle top-panel-toggle open-tabs-trigger"
          type="button"
          aria-label={copy.manage}
          data-tooltip={copy.manage}
        >
          {activeTabTitle && (
            <span className="open-tabs-trigger-title">{activeTabTitle}</span>
          )}
          <ChevronDown size={16} />
        </button>
      </MenuTrigger>
      <MenuContent
        ariaLabel={copy.manage}
        className="open-tabs-menu"
      >
        <MenuGroup>
          <MenuItem
            disabled={openFiles.length <= 1}
            icon={<CopyMinus size={15} />}
            label={copy.closeOthers}
            onSelect={onCloseOtherFiles}
          />
          <MenuItem
            disabled={openFiles.length === 0}
            icon={<CopyX size={15} />}
            label={copy.closeAll}
            onSelect={onCloseAllFiles}
          />
          <MenuItem
            disabled={!lastClosedFile}
            icon={<Undo2 size={15} />}
            label={copy.reopenLastClosed}
            onSelect={onReopenLastClosedFile}
          />
        </MenuGroup>
        {openFiles.length > 0 && (
          <>
            <MenuSeparator className="ui-command-menu-separator" />
            <MenuRadioGroup
              value={activeFile?.id ?? ""}
              onValueChange={onSelectFile}
            >
              {openFiles.map((file) => {
                const tabLabel = tabLabels.get(file.id);
                const title = getTabDisplayTitle(tabLabel?.displayTitle ?? file.title);
                const label = tabLabel?.locationLabel
                  ? `${title} · ${tabLabel.locationLabel}`
                  : title;
                return (
                  <MenuRadioItem
                    key={file.id}
                    value={file.id}
                    label={label}
                  />
                );
              })}
            </MenuRadioGroup>
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
}
