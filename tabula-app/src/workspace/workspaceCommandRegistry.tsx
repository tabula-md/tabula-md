import { createElement, type ReactNode } from "react";
import { FileInput, FilePlus2, FolderInput, FolderPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "./workspaceInterfaceLocale";
import { getWorkspaceMenuCopy } from "./workspaceLocale";

export type WorkspaceSearchCommand = {
  id: string;
  label: string;
  keywords?: readonly string[];
  shortcut?: string;
  icon?: ReactNode;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

type WorkspaceCommandRegistryOptions = {
  actions: {
    importFile: () => void;
    importWorkspace: () => void;
    newFile: () => void;
    newFolder: () => void;
  };
  language: WorkspaceLanguage;
};

const icon = (component: LucideIcon) => createElement(component, { size: 16 });

export const buildWorkspaceCommandRegistry = ({
  actions,
  language,
}: WorkspaceCommandRegistryOptions): WorkspaceSearchCommand[] => {
  const interfaceCopy = getWorkspaceInterfaceCopy(language);
  const menuCopy = getWorkspaceMenuCopy(language);

  return [
    {
      id: "document.new",
      label: interfaceCopy.sidePanel.files.newDocument,
      keywords: ["create", "file", "document"],
      icon: icon(FilePlus2),
      onSelect: actions.newFile,
    },
    {
      id: "document.new-folder",
      label: interfaceCopy.sidePanel.files.newFolder,
      keywords: ["create", "directory", "folder"],
      icon: icon(FolderPlus),
      onSelect: actions.newFolder,
    },
    {
      id: "document.import",
      label: menuCopy.actions.importFile,
      keywords: ["open", "markdown", "file"],
      icon: icon(FileInput),
      onSelect: actions.importFile,
    },
    {
      id: "workspace.import",
      label: menuCopy.actions.importWorkspace,
      keywords: ["open", "folder", "bundle", "workspace"],
      icon: icon(FolderInput),
      onSelect: actions.importWorkspace,
    },
  ];
};
