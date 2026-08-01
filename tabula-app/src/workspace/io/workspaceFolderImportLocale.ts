import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  replacementWarning: string;
  cancel: string;
  importAndReplace: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceFolderImportCopy> = {
  en: {
    close: "Close folder import",
    title: "Replace workspace?",
    replacementWarning: "This replaces the current documents and comments with a browser copy that won’t stay in sync.",
    cancel: "Cancel",
    importAndReplace: "Import folder",
  },
  ko: {
    close: "폴더 가져오기 닫기",
    title: "워크스페이스를 대체할까요?",
    replacementWarning: "현재 문서와 댓글을 동기화되지 않는 브라우저 사본으로 대체합니다.",
    cancel: "취소",
    importAndReplace: "폴더 가져오기",
  },
  ja: {
    close: "フォルダーのインポートを閉じる",
    title: "ワークスペースを置き換えますか？",
    replacementWarning: "現在の文書とコメントを、同期されないブラウザーコピーに置き換えます。",
    cancel: "キャンセル",
    importAndReplace: "フォルダーをインポート",
  },
  zh: {
    close: "关闭文件夹导入",
    title: "替换工作区？",
    replacementWarning: "这会用一个不会同步的浏览器副本替换当前文档和评论。",
    cancel: "取消",
    importAndReplace: "导入文件夹",
  },
  es: {
    close: "Cerrar importación de carpeta",
    title: "¿Reemplazar el espacio?",
    replacementWarning: "Esto reemplaza los documentos y comentarios actuales por una copia del navegador que no se sincronizará.",
    cancel: "Cancelar",
    importAndReplace: "Importar carpeta",
  },
  fr: {
    close: "Fermer l’importation du dossier",
    title: "Remplacer l’espace ?",
    replacementWarning: "Cette action remplace les documents et commentaires actuels par une copie locale qui ne sera pas synchronisée.",
    cancel: "Annuler",
    importAndReplace: "Importer le dossier",
  },
  de: {
    close: "Ordnerimport schließen",
    title: "Workspace ersetzen?",
    replacementWarning: "Dadurch werden die aktuellen Dokumente und Kommentare durch eine nicht synchronisierte Browserkopie ersetzt.",
    cancel: "Abbrechen",
    importAndReplace: "Ordner importieren",
  },
};

export const getWorkspaceFolderImportCopy = (language: WorkspaceLanguage) =>
  copies[language];
