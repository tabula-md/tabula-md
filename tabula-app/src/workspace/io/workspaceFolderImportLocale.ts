import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

export type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  description: string;
  warning: string;
  cancel: string;
  open: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceFolderImportCopy> = {
  en: {
    close: "Close folder dialog",
    title: "Replace workspace?",
    description: "The selected folder will become a browser copy. The original folder stays unchanged and is not kept in sync.",
    warning: "This replaces the current documents and comments.",
    cancel: "Cancel",
    open: "Import folder",
  },
  ko: {
    close: "폴더 창 닫기",
    title: "워크스페이스를 교체할까요?",
    description: "선택한 폴더를 브라우저 사본으로 가져옵니다. 원본 폴더는 변경되거나 동기화되지 않습니다.",
    warning: "현재 문서와 댓글을 교체합니다.",
    cancel: "취소",
    open: "폴더 가져오기",
  },
  ja: {
    close: "フォルダーダイアログを閉じる",
    title: "ワークスペースを置き換えますか？",
    description: "選択したフォルダーをブラウザーのコピーとして読み込みます。元のフォルダーは変更も同期もされません。",
    warning: "現在の文書とコメントが置き換えられます。",
    cancel: "キャンセル",
    open: "フォルダーを読み込む",
  },
  zh: {
    close: "关闭文件夹对话框",
    title: "替换工作区？",
    description: "所选文件夹将作为浏览器副本导入。原文件夹不会被修改或保持同步。",
    warning: "这将替换当前文档和评论。",
    cancel: "取消",
    open: "导入文件夹",
  },
  es: {
    close: "Cerrar diálogo de carpeta",
    title: "¿Reemplazar el espacio de trabajo?",
    description: "La carpeta seleccionada se importará como una copia del navegador. La carpeta original no se modifica ni se sincroniza.",
    warning: "Esto reemplaza los documentos y comentarios actuales.",
    cancel: "Cancelar",
    open: "Importar carpeta",
  },
  fr: {
    close: "Fermer la boîte de dialogue du dossier",
    title: "Remplacer l’espace de travail ?",
    description: "Le dossier sélectionné sera importé comme copie dans le navigateur. Le dossier d’origine n’est ni modifié ni synchronisé.",
    warning: "Cela remplace les documents et commentaires actuels.",
    cancel: "Annuler",
    open: "Importer le dossier",
  },
  de: {
    close: "Ordnerdialog schließen",
    title: "Workspace ersetzen?",
    description: "Der ausgewählte Ordner wird als Browserkopie importiert. Der ursprüngliche Ordner wird weder geändert noch synchronisiert.",
    warning: "Dadurch werden die aktuellen Dokumente und Kommentare ersetzt.",
    cancel: "Abbrechen",
    open: "Ordner importieren",
  },
};

export const getWorkspaceFolderImportCopy = (
  language: WorkspaceLanguage,
): WorkspaceFolderImportCopy => copies[language];
