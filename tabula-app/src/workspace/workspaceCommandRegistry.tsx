import { createElement, type ReactNode } from "react";
import {
  Braces,
  Download,
  FileInput,
  FilePlus2,
  Files,
  FolderInput,
  FolderPlus,
  Library,
  Link,
  ListTree,
  Menu,
  MessageSquare,
  PanelLeft,
  Search,
  X,
  Copy,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LeftPanelView, RightPanelView } from "../ui/uiTypes";
import { getKnowledgePanelCopy } from "./knowledgePanelLocale";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "./workspaceInterfaceLocale";
import { getWorkspaceChromeCopy, getWorkspaceMenuCopy } from "./workspaceLocale";

export type WorkspaceCommandCategory = "document" | "workspace" | "panel";

export type WorkspaceSearchCommand = {
  id: string;
  label: string;
  category: string;
  keywords?: readonly string[];
  shortcut?: string;
  icon?: ReactNode;
  enabled?: boolean;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

type WorkspaceCommandActions = {
  closeActiveFile: () => void;
  closeAllFiles: () => void;
  closeOtherFiles: () => void;
  duplicateActiveFile: () => void;
  exportActiveFile: () => void;
  exportWorkspace: () => void;
  importFile: () => void;
  importWorkspace: () => void;
  newFile: () => void;
  newFolder: () => void;
  openDocumentSearch: () => void;
  openLeftPanel: (view: LeftPanelView) => void;
  openRightPanel: (view: RightPanelView) => void;
  reopenLastClosedFile: () => void;
  toggleWorkspaceMenu: () => void;
};

type WorkspaceCommandRegistryOptions = {
  actions: WorkspaceCommandActions;
  activeFileId?: string;
  fileCount: number;
  hasLastClosedFile: boolean;
  language: WorkspaceLanguage;
  openFileCount: number;
};

const categoryLabels: Record<WorkspaceLanguage, Record<WorkspaceCommandCategory, string>> = {
  en: { document: "Document", workspace: "Workspace", panel: "View" },
  ko: { document: "문서", workspace: "워크스페이스", panel: "보기" },
  ja: { document: "ドキュメント", workspace: "ワークスペース", panel: "表示" },
  zh: { document: "文档", workspace: "工作区", panel: "视图" },
  es: { document: "Documento", workspace: "Espacio de trabajo", panel: "Vista" },
  fr: { document: "Document", workspace: "Espace de travail", panel: "Affichage" },
  de: { document: "Dokument", workspace: "Workspace", panel: "Ansicht" },
};

const icon = (component: LucideIcon) =>
  createElement(component, { size: 16 });

export const buildWorkspaceCommandRegistry = ({
  actions,
  activeFileId,
  fileCount,
  hasLastClosedFile,
  language,
  openFileCount,
}: WorkspaceCommandRegistryOptions): WorkspaceSearchCommand[] => {
  const interfaceCopy = getWorkspaceInterfaceCopy(language);
  const chromeCopy = getWorkspaceChromeCopy(language);
  const menuCopy = getWorkspaceMenuCopy(language);
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const categories = categoryLabels[language];
  const hasActiveFile = Boolean(activeFileId);

  return [
    {
      id: "document.new",
      label: interfaceCopy.sidePanel.files.newDocument,
      category: categories.document,
      keywords: ["create", "file", "document"],
      icon: icon(FilePlus2),
      onSelect: actions.newFile,
    },
    {
      id: "document.new-folder",
      label: interfaceCopy.sidePanel.files.newFolder,
      category: categories.document,
      keywords: ["create", "directory", "folder"],
      icon: icon(FolderPlus),
      onSelect: actions.newFolder,
    },
    {
      id: "document.import",
      label: menuCopy.actions.importFile,
      category: categories.document,
      keywords: ["open", "markdown", "file"],
      icon: icon(FileInput),
      onSelect: actions.importFile,
    },
    {
      id: "document.export",
      label: menuCopy.actions.exportFile,
      category: categories.document,
      keywords: ["download", "markdown", "file"],
      icon: icon(Download),
      enabled: hasActiveFile,
      onSelect: actions.exportActiveFile,
    },
    {
      id: "document.duplicate",
      label: interfaceCopy.sidePanel.files.duplicate,
      category: categories.document,
      keywords: ["copy", "clone", "document"],
      icon: icon(Copy),
      enabled: hasActiveFile,
      onSelect: actions.duplicateActiveFile,
    },
    {
      id: "document.find",
      label: chromeCopy.documentControls.findInFile,
      category: categories.document,
      keywords: ["search", "find", "current", "document"],
      icon: icon(Search),
      enabled: hasActiveFile,
      onSelect: actions.openDocumentSearch,
    },
    {
      id: "document.close",
      label: interfaceCopy.tabs.close,
      category: categories.document,
      keywords: ["close", "tab", "document"],
      icon: icon(X),
      enabled: hasActiveFile,
      onSelect: actions.closeActiveFile,
    },
    {
      id: "document.close-others",
      label: interfaceCopy.tabs.closeOthers,
      category: categories.document,
      keywords: ["close", "other", "tabs", "documents"],
      icon: icon(X),
      enabled: openFileCount > 1,
      onSelect: actions.closeOtherFiles,
    },
    {
      id: "document.close-all",
      label: interfaceCopy.tabs.closeAll,
      category: categories.document,
      keywords: ["close", "all", "tabs", "documents"],
      icon: icon(X),
      enabled: openFileCount > 0,
      onSelect: actions.closeAllFiles,
    },
    {
      id: "document.reopen-closed",
      label: interfaceCopy.tabs.reopenLastClosed,
      category: categories.document,
      keywords: ["restore", "reopen", "closed", "tab"],
      icon: icon(RotateCcw),
      enabled: hasLastClosedFile,
      onSelect: actions.reopenLastClosedFile,
    },
    {
      id: "workspace.import",
      label: menuCopy.actions.importWorkspace,
      category: categories.workspace,
      keywords: ["open", "folder", "bundle", "workspace"],
      icon: icon(FolderInput),
      onSelect: actions.importWorkspace,
    },
    {
      id: "workspace.export",
      label: menuCopy.actions.exportWorkspace,
      category: categories.workspace,
      keywords: ["download", "zip", "bundle", "workspace"],
      icon: icon(Download),
      enabled: fileCount > 0,
      onSelect: actions.exportWorkspace,
    },
    {
      id: "workspace.menu",
      label: chromeCopy.topChrome.openWorkspaceMenu,
      category: categories.workspace,
      keywords: ["project", "preferences", "settings", "menu"],
      icon: icon(Menu),
      onSelect: actions.toggleWorkspaceMenu,
    },
    {
      id: "panel.files",
      label: chromeCopy.topChrome.files,
      category: categories.panel,
      keywords: ["open", "workspace", "panel", "files"],
      icon: icon(Files),
      onSelect: () => actions.openLeftPanel("files"),
    },
    {
      id: "panel.libraries",
      label: chromeCopy.topChrome.libraries,
      category: categories.panel,
      keywords: ["open", "workspace", "panel", "libraries"],
      icon: icon(Library),
      onSelect: () => actions.openLeftPanel("libraries"),
    },
    {
      id: "panel.outline",
      label: interfaceCopy.sidePanel.tabs.outline,
      category: categories.panel,
      keywords: ["open", "headings", "document", "panel"],
      icon: icon(ListTree),
      enabled: hasActiveFile,
      onSelect: () => actions.openRightPanel("outline"),
    },
    {
      id: "panel.links",
      label: interfaceCopy.sidePanel.tabs.links,
      category: categories.panel,
      keywords: ["open", "backlinks", "outgoing", "document", "panel"],
      icon: icon(Link),
      enabled: hasActiveFile,
      onSelect: () => actions.openRightPanel("links"),
    },
    {
      id: "panel.comments",
      label: interfaceCopy.sidePanel.tabs.comments,
      category: categories.panel,
      keywords: ["open", "review", "discussion", "document", "panel"],
      icon: icon(MessageSquare),
      enabled: hasActiveFile,
      onSelect: () => actions.openRightPanel("comments"),
    },
    {
      id: "panel.metadata",
      label: knowledgeCopy.reviewInKnowledge,
      category: categories.panel,
      keywords: ["open", "properties", "frontmatter", "status", "trust", "metadata"],
      icon: icon(Braces),
      enabled: hasActiveFile,
      onSelect: () => actions.openRightPanel("properties"),
    },
    {
      id: "panel.workspace",
      label: chromeCopy.topChrome.workspacePanel,
      category: categories.panel,
      keywords: ["sidebar", "left", "toggle", "workspace"],
      icon: icon(PanelLeft),
      onSelect: () => actions.openLeftPanel("files"),
    },
  ];
};
