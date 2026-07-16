import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  description: string;
  contains: (documents: number, folders: number) => string;
  paths: string;
  more: (count: number) => string;
  cancel: string;
  open: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceFolderImportCopy> = {
  en: { close: "Close import dialog", title: "Import workspace", description: "Importing this folder replaces the current local workspace. Only Markdown (.md) documents are included.", contains: (documents, folders) => `${documents} ${documents === 1 ? "document" : "documents"} · ${folders} ${folders === 1 ? "folder" : "folders"}`, paths: "Documents in this workspace", more: (count) => `+${count} more`, cancel: "Cancel", open: "Import workspace" },
  ko: { close: "가져오기 창 닫기", title: "워크스페이스 가져오기", description: "이 폴더를 가져오면 현재 로컬 워크스페이스를 대체합니다. Markdown(.md) 문서만 포함됩니다.", contains: (documents, folders) => `문서 ${documents}개 · 폴더 ${folders}개`, paths: "이 워크스페이스의 문서", more: (count) => `외 ${count}개`, cancel: "취소", open: "워크스페이스 가져오기" },
  ja: { close: "読み込みダイアログを閉じる", title: "ワークスペースを読み込む", description: "このフォルダーを読み込むと、現在のローカルワークスペースが置き換えられます。Markdown（.md）文書のみが含まれます。", contains: (documents, folders) => `ドキュメント ${documents} 件 · フォルダー ${folders} 件`, paths: "このワークスペースのドキュメント", more: (count) => `ほか ${count} 件`, cancel: "キャンセル", open: "ワークスペースを読み込む" },
  zh: { close: "关闭导入对话框", title: "导入工作区", description: "导入此文件夹将替换当前本地工作区。仅包含 Markdown（.md）文档。", contains: (documents, folders) => `${documents} 个文档 · ${folders} 个文件夹`, paths: "此工作区中的文档", more: (count) => `另有 ${count} 个`, cancel: "取消", open: "导入工作区" },
  es: { close: "Cerrar diálogo de importación", title: "Importar espacio de trabajo", description: "Importar esta carpeta reemplaza el espacio local actual. Solo se incluyen documentos Markdown (.md).", contains: (documents, folders) => `${documents} documentos · ${folders} carpetas`, paths: "Documentos de este espacio", more: (count) => `+${count} más`, cancel: "Cancelar", open: "Importar espacio" },
  fr: { close: "Fermer la boîte de dialogue d’import", title: "Importer l’espace de travail", description: "L’import de ce dossier remplace l’espace local actuel. Seuls les documents Markdown (.md) sont inclus.", contains: (documents, folders) => `${documents} documents · ${folders} dossiers`, paths: "Documents de cet espace", more: (count) => `+${count} de plus`, cancel: "Annuler", open: "Importer l’espace" },
  de: { close: "Import-Dialog schließen", title: "Workspace importieren", description: "Beim Importieren dieses Ordners wird der aktuelle lokale Workspace ersetzt. Nur Markdown-Dokumente (.md) werden übernommen.", contains: (documents, folders) => `${documents} Dokumente · ${folders} Ordner`, paths: "Dokumente in diesem Workspace", more: (count) => `+${count} weitere`, cancel: "Abbrechen", open: "Workspace importieren" },
};

export const getWorkspaceFolderImportCopy = (language: WorkspaceLanguage) => copies[language];
