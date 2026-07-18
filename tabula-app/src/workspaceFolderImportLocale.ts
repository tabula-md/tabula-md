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
  en: { close: "Close folder dialog", title: "Open folder", description: "Tabula.md saves a copy in this browser and replaces the current local workspace. The original folder is not changed or kept in sync. Only Markdown (.md) documents are included.", contains: (documents, folders) => `${documents} ${documents === 1 ? "document" : "documents"} · ${folders} ${folders === 1 ? "folder" : "folders"}`, paths: "Markdown in this folder", more: (count) => `+${count} more`, cancel: "Cancel", open: "Open folder" },
  ko: { close: "폴더 창 닫기", title: "폴더 열기", description: "Tabula.md가 이 브라우저에 사본을 저장하고 현재 로컬 워크스페이스를 대체합니다. 원본 폴더는 변경되거나 동기화되지 않습니다. Markdown(.md) 문서만 포함됩니다.", contains: (documents, folders) => `문서 ${documents}개 · 폴더 ${folders}개`, paths: "이 폴더의 Markdown", more: (count) => `외 ${count}개`, cancel: "취소", open: "폴더 열기" },
  ja: { close: "フォルダーダイアログを閉じる", title: "フォルダーを開く", description: "Tabula.md はこのブラウザーにコピーを保存し、現在のローカルワークスペースを置き換えます。元のフォルダーは変更も同期もされません。Markdown（.md）文書のみが含まれます。", contains: (documents, folders) => `ドキュメント ${documents} 件 · フォルダー ${folders} 件`, paths: "このフォルダーの Markdown", more: (count) => `ほか ${count} 件`, cancel: "キャンセル", open: "フォルダーを開く" },
  zh: { close: "关闭文件夹对话框", title: "打开文件夹", description: "Tabula.md 会在此浏览器中保存一个副本，并替换当前本地工作区。原文件夹不会被修改，也不会保持同步。仅包含 Markdown（.md）文档。", contains: (documents, folders) => `${documents} 个文档 · ${folders} 个文件夹`, paths: "此文件夹中的 Markdown", more: (count) => `另有 ${count} 个`, cancel: "取消", open: "打开文件夹" },
  es: { close: "Cerrar diálogo de carpeta", title: "Abrir carpeta", description: "Tabula.md guarda una copia en este navegador y reemplaza el espacio local actual. La carpeta original no se modifica ni se mantiene sincronizada. Solo se incluyen documentos Markdown (.md).", contains: (documents, folders) => `${documents} documentos · ${folders} carpetas`, paths: "Markdown de esta carpeta", more: (count) => `+${count} más`, cancel: "Cancelar", open: "Abrir carpeta" },
  fr: { close: "Fermer la boîte de dialogue du dossier", title: "Ouvrir un dossier", description: "Tabula.md enregistre une copie dans ce navigateur et remplace l’espace local actuel. Le dossier d’origine n’est ni modifié ni synchronisé. Seuls les documents Markdown (.md) sont inclus.", contains: (documents, folders) => `${documents} documents · ${folders} dossiers`, paths: "Markdown de ce dossier", more: (count) => `+${count} de plus`, cancel: "Annuler", open: "Ouvrir le dossier" },
  de: { close: "Ordnerdialog schließen", title: "Ordner öffnen", description: "Tabula.md speichert eine Kopie in diesem Browser und ersetzt den aktuellen lokalen Workspace. Der ursprüngliche Ordner wird weder geändert noch synchron gehalten. Nur Markdown-Dokumente (.md) werden übernommen.", contains: (documents, folders) => `${documents} Dokumente · ${folders} Ordner`, paths: "Markdown in diesem Ordner", more: (count) => `+${count} weitere`, cancel: "Abbrechen", open: "Ordner öffnen" },
};

export const getWorkspaceFolderImportCopy = (language: WorkspaceLanguage) => copies[language];
