import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type WorkspaceIoCopy = {
  fileCopied: string;
  fileDownloaded: string;
  workspaceDownloaded: string;
  exportFailed: string;
  openFailed: string;
  saveOpenedWorkspaceFailed: string;
  unsupportedDrop: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceIoCopy> = {
  en: { fileCopied: "File copied.", fileDownloaded: "File downloaded.", workspaceDownloaded: "Workspace downloaded.", exportFailed: "Couldn’t export to file.", openFailed: "Couldn’t open this workspace.", saveOpenedWorkspaceFailed: "The workspace opened, but it couldn’t be saved in this browser.", unsupportedDrop: "Drop a Markdown file." },
  ko: { fileCopied: "파일을 복사했습니다.", fileDownloaded: "파일을 다운로드했습니다.", workspaceDownloaded: "워크스페이스를 다운로드했습니다.", exportFailed: "파일로 내보내지 못했습니다.", openFailed: "이 워크스페이스를 열지 못했습니다.", saveOpenedWorkspaceFailed: "워크스페이스를 열었지만 이 브라우저에 저장하지 못했습니다.", unsupportedDrop: "Markdown 파일을 놓아주세요." },
  ja: { fileCopied: "ファイルをコピーしました。", fileDownloaded: "ファイルをダウンロードしました。", workspaceDownloaded: "ワークスペースをダウンロードしました。", exportFailed: "ファイルに書き出せませんでした。", openFailed: "このワークスペースを開けませんでした。", saveOpenedWorkspaceFailed: "ワークスペースを開きましたが、このブラウザーに保存できませんでした。", unsupportedDrop: "Markdown ファイルをドロップしてください。" },
  zh: { fileCopied: "已复制文件。", fileDownloaded: "已下载文件。", workspaceDownloaded: "已下载工作区。", exportFailed: "无法导出为文件。", openFailed: "无法打开此工作区。", saveOpenedWorkspaceFailed: "工作区已打开，但无法保存在此浏览器中。", unsupportedDrop: "请拖放 Markdown 文件。" },
  es: { fileCopied: "Archivo copiado.", fileDownloaded: "Archivo descargado.", workspaceDownloaded: "Espacio descargado.", exportFailed: "No se pudo exportar a un archivo.", openFailed: "No se pudo abrir este espacio.", saveOpenedWorkspaceFailed: "El espacio se abrió, pero no se pudo guardar en este navegador.", unsupportedDrop: "Suelta un archivo Markdown." },
  fr: { fileCopied: "Fichier copié.", fileDownloaded: "Fichier téléchargé.", workspaceDownloaded: "Espace téléchargé.", exportFailed: "Impossible d’exporter vers un fichier.", openFailed: "Impossible d’ouvrir cet espace.", saveOpenedWorkspaceFailed: "L’espace est ouvert, mais n’a pas pu être enregistré dans ce navigateur.", unsupportedDrop: "Déposez un fichier Markdown." },
  de: { fileCopied: "Datei kopiert.", fileDownloaded: "Datei heruntergeladen.", workspaceDownloaded: "Workspace heruntergeladen.", exportFailed: "Export als Datei fehlgeschlagen.", openFailed: "Dieser Workspace konnte nicht geöffnet werden.", saveOpenedWorkspaceFailed: "Der Workspace wurde geöffnet, konnte aber nicht in diesem Browser gespeichert werden.", unsupportedDrop: "Markdown-Datei hier ablegen." },
};

export const getWorkspaceIoCopy = (language: WorkspaceLanguage) => copies[language];
