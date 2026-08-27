import type { ChangeEventHandler, RefObject } from "react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { getWorkspaceMenuCopy } from "../workspaceLocale";

type WorkspaceImportInputsProps = {
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  language: WorkspaceLanguage;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportWorkspaceChange: ChangeEventHandler<HTMLInputElement>;
};

export function WorkspaceImportInputs({
  importInputRef,
  workspaceImportInputRef,
  language,
  onImportFileChange,
  onImportWorkspaceChange,
}: WorkspaceImportInputsProps) {
  const menuCopy = getWorkspaceMenuCopy(language);
  const interfaceCopy = getWorkspaceInterfaceCopy(language);

  return (
    <>
      <input
        ref={importInputRef}
        className="ui-input-surface workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={onImportFileChange}
        aria-label={interfaceCopy.sidePanel.files.openMarkdown}
      />
      <input
        ref={workspaceImportInputRef}
        className="ui-input-surface workspace-file-input"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={onImportWorkspaceChange}
        aria-label={menuCopy.actions.importWorkspace}
      />
    </>
  );
}
