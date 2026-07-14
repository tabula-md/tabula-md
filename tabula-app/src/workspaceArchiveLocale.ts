import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

type WorkspaceArchiveCopy = {
  close: string;
  title: string;
  description: string;
  contains: (documents: number, folders: number) => string;
  paths: string;
  more: (count: number) => string;
  cancel: string;
  open: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceArchiveCopy> = {
  en: { close: "Close workspace dialog", title: "Open workspace", description: "Opening this ZIP replaces the current local workspace.", contains: (documents, folders) => `${documents} ${documents === 1 ? "document" : "documents"} · ${folders} ${folders === 1 ? "folder" : "folders"}`, paths: "Documents in this workspace", more: (count) => `+${count} more`, cancel: "Cancel", open: "Open workspace" },
  ko: { close: "워크스페이스 창 닫기", title: "워크스페이스 열기", description: "이 ZIP을 열면 현재 로컬 워크스페이스를 대체합니다.", contains: (documents, folders) => `문서 ${documents}개 · 폴더 ${folders}개`, paths: "이 워크스페이스의 문서", more: (count) => `외 ${count}개`, cancel: "취소", open: "워크스페이스 열기" },
  ja: { close: "ワークスペースダイアログを閉じる", title: "ワークスペースを開く", description: "この ZIP を開くと、現在のローカルワークスペースが置き換えられます。", contains: (documents, folders) => `ドキュメント ${documents} 件 · フォルダー ${folders} 件`, paths: "このワークスペースのドキュメント", more: (count) => `ほか ${count} 件`, cancel: "キャンセル", open: "ワークスペースを開く" },
  zh: { close: "关闭工作区对话框", title: "打开工作区", description: "打开此 ZIP 将替换当前本地工作区。", contains: (documents, folders) => `${documents} 个文档 · ${folders} 个文件夹`, paths: "此工作区中的文档", more: (count) => `另有 ${count} 个`, cancel: "取消", open: "打开工作区" },
  es: { close: "Cerrar diálogo del espacio", title: "Abrir espacio de trabajo", description: "Abrir este ZIP reemplaza el espacio local actual.", contains: (documents, folders) => `${documents} documentos · ${folders} carpetas`, paths: "Documentos de este espacio", more: (count) => `+${count} más`, cancel: "Cancelar", open: "Abrir espacio" },
  fr: { close: "Fermer la boîte de dialogue", title: "Ouvrir l’espace de travail", description: "L’ouverture de ce ZIP remplace l’espace local actuel.", contains: (documents, folders) => `${documents} documents · ${folders} dossiers`, paths: "Documents de cet espace", more: (count) => `+${count} de plus`, cancel: "Annuler", open: "Ouvrir l’espace" },
  de: { close: "Workspace-Dialog schließen", title: "Workspace öffnen", description: "Beim Öffnen dieser ZIP-Datei wird der aktuelle lokale Workspace ersetzt.", contains: (documents, folders) => `${documents} Dokumente · ${folders} Ordner`, paths: "Dokumente in diesem Workspace", more: (count) => `+${count} weitere`, cancel: "Abbrechen", open: "Workspace öffnen" },
};

export const getWorkspaceArchiveCopy = (language: WorkspaceLanguage) => copies[language];
