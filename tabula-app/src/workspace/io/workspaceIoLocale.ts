import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type LiveFolderIoCopy = {
  liveFolderOpeningTitle: string;
  liveFolderOpeningDescription: string;
  liveFolderTooManyFiles: string;
  liveFolderTooManyFolders: string;
  liveFolderTooLarge: string;
  liveFolderTooDeep: string;
  liveFolderPermissionRequired: string;
  liveFolderOpenFailed: string;
  liveFolderDisconnected: string;
};

type WorkspaceIoCopy = LiveFolderIoCopy & {
  fileCopied: string;
  fileDownloaded: string;
  workspaceDownloaded: string;
  exportFailed: string;
  openFailed: string;
  saveOpenedWorkspaceFailed: string;
  unsupportedDrop: string;
  confirmLiveFolderDelete: string;
  liveFolderPermissionLost: string;
  liveFolderWriteConflict: string;
  liveFolderWriteFailed: string;
  liveFolderCheckFailed: string;
};

const englishLiveFolderCopy: LiveFolderIoCopy = {
  liveFolderOpeningTitle: "Connecting local folder",
  liveFolderOpeningDescription: "Reading workspace files. Your current workspace will remain unchanged until you review and connect the folder.",
  liveFolderTooManyFiles: "This folder contains too many workspace files. Generated dependency folders are skipped, but the remaining workspace still exceeds Tabula’s limit.",
  liveFolderTooManyFolders: "This folder contains too many workspace folders for Tabula.",
  liveFolderTooLarge: "This folder is too large to open safely in this browser.",
  liveFolderTooDeep: "This folder is nested too deeply for Tabula.",
  liveFolderPermissionRequired: "Tabula needs read and write access to connect this folder.",
  liveFolderOpenFailed: "Tabula couldn’t read this folder. Your current workspace was not changed.",
  liveFolderDisconnected: "Local folder disconnected. This workspace is now saved in the browser.",
};

const liveFolderCopies: Record<WorkspaceLanguage, LiveFolderIoCopy> = {
  en: englishLiveFolderCopy,
  ko: {
    liveFolderOpeningTitle: "로컬 폴더 연결 중",
    liveFolderOpeningDescription: "워크스페이스 파일을 읽고 있습니다. 폴더를 검토하고 연결하기 전까지 현재 워크스페이스는 변경되지 않습니다.",
    liveFolderTooManyFiles: "워크스페이스 파일이 너무 많습니다. 생성된 의존성 폴더를 제외한 뒤에도 Tabula의 제한을 초과합니다.",
    liveFolderTooManyFolders: "Tabula에서 열 수 있는 폴더 수를 초과했습니다.",
    liveFolderTooLarge: "이 브라우저에서 안전하게 열기에는 폴더 용량이 너무 큽니다.",
    liveFolderTooDeep: "폴더 구조가 Tabula에서 지원하는 깊이를 초과했습니다.",
    liveFolderPermissionRequired: "이 폴더를 연결하려면 읽기 및 쓰기 권한이 필요합니다.",
    liveFolderOpenFailed: "이 폴더를 읽지 못했습니다. 현재 워크스페이스는 변경되지 않았습니다.",
    liveFolderDisconnected: "로컬 폴더 연결을 해제했습니다. 현재 워크스페이스는 브라우저에 저장됩니다.",
  },
  ja: {
    ...englishLiveFolderCopy,
    liveFolderOpeningTitle: "ローカルフォルダーに接続中",
    liveFolderOpeningDescription: "ワークスペースのファイルを読み込んでいます。確認して接続するまで現在のワークスペースは変更されません。",
    liveFolderPermissionRequired: "接続にはフォルダーの読み書き権限が必要です。",
    liveFolderOpenFailed: "フォルダーを読み込めませんでした。現在のワークスペースは変更されていません。",
  },
  zh: {
    ...englishLiveFolderCopy,
    liveFolderOpeningTitle: "正在连接本地文件夹",
    liveFolderOpeningDescription: "正在读取工作区文件。在确认并连接前，当前工作区不会改变。",
    liveFolderPermissionRequired: "连接此文件夹需要读写权限。",
    liveFolderOpenFailed: "无法读取此文件夹。当前工作区未被更改。",
  },
  es: {
    ...englishLiveFolderCopy,
    liveFolderOpeningTitle: "Conectando carpeta local",
    liveFolderOpeningDescription: "Leyendo los archivos. El espacio actual no cambiará hasta que revises y conectes la carpeta.",
    liveFolderPermissionRequired: "Tabula necesita permiso de lectura y escritura para conectar esta carpeta.",
    liveFolderOpenFailed: "Tabula no pudo leer esta carpeta. El espacio actual no cambió.",
  },
  fr: {
    ...englishLiveFolderCopy,
    liveFolderOpeningTitle: "Connexion du dossier local",
    liveFolderOpeningDescription: "Lecture des fichiers. L’espace actuel ne changera pas avant votre validation.",
    liveFolderPermissionRequired: "Tabula a besoin d’un accès en lecture et en écriture.",
    liveFolderOpenFailed: "Tabula n’a pas pu lire ce dossier. L’espace actuel n’a pas été modifié.",
  },
  de: {
    ...englishLiveFolderCopy,
    liveFolderOpeningTitle: "Lokaler Ordner wird verbunden",
    liveFolderOpeningDescription: "Workspace-Dateien werden gelesen. Der aktuelle Workspace bleibt bis zur Bestätigung unverändert.",
    liveFolderPermissionRequired: "Tabula benötigt Lese- und Schreibzugriff auf diesen Ordner.",
    liveFolderOpenFailed: "Tabula konnte diesen Ordner nicht lesen. Der aktuelle Workspace wurde nicht verändert.",
  },
};

const copies: Record<WorkspaceLanguage, WorkspaceIoCopy> = {
  en: { ...englishLiveFolderCopy, fileCopied: "File copied.", fileDownloaded: "File downloaded.", workspaceDownloaded: "Workspace downloaded.", exportFailed: "Couldn’t export to file.", openFailed: "Couldn’t open this workspace.", saveOpenedWorkspaceFailed: "The workspace opened, but it couldn’t be saved in this browser.", unsupportedDrop: "Drop a Markdown file.", confirmLiveFolderDelete: "Also delete these files from the connected folder?", liveFolderPermissionLost: "Folder write permission was lost. Your changes remain saved in this browser.", liveFolderWriteConflict: "The connected folder changed outside Tabula. Review the conflict before saving.", liveFolderWriteFailed: "Couldn’t save changes to the connected folder.", liveFolderCheckFailed: "Couldn’t check the connected folder for external changes." },
  ko: { ...liveFolderCopies.ko, fileCopied: "파일을 복사했습니다.", fileDownloaded: "파일을 다운로드했습니다.", workspaceDownloaded: "워크스페이스를 다운로드했습니다.", exportFailed: "파일로 내보내지 못했습니다.", openFailed: "이 워크스페이스를 열지 못했습니다.", saveOpenedWorkspaceFailed: "워크스페이스를 열었지만 이 브라우저에 저장하지 못했습니다.", unsupportedDrop: "Markdown 파일을 놓아주세요.", confirmLiveFolderDelete: "연결된 폴더에서도 이 파일을 삭제할까요?", liveFolderPermissionLost: "폴더 쓰기 권한이 사라졌습니다. 변경 내용은 이 브라우저에 보존됩니다.", liveFolderWriteConflict: "연결된 폴더가 Tabula 외부에서 변경되었습니다. 저장하기 전에 충돌을 검토하세요.", liveFolderWriteFailed: "연결된 폴더에 변경 내용을 저장하지 못했습니다.", liveFolderCheckFailed: "연결된 폴더의 외부 변경을 확인하지 못했습니다." },
  ja: { ...liveFolderCopies.ja, fileCopied: "ファイルをコピーしました。", fileDownloaded: "ファイルをダウンロードしました。", workspaceDownloaded: "ワークスペースをダウンロードしました。", exportFailed: "ファイルに書き出せませんでした。", openFailed: "このワークスペースを開けませんでした。", saveOpenedWorkspaceFailed: "ワークスペースを開きましたが、このブラウザーに保存できませんでした。", unsupportedDrop: "Markdown ファイルをドロップしてください。", confirmLiveFolderDelete: "接続したフォルダーからもこのファイルを削除しますか？", liveFolderPermissionLost: "フォルダーへの書き込み権限が失われました。変更はブラウザーに保存されています。", liveFolderWriteConflict: "接続したフォルダーが Tabula の外部で変更されました。保存前に競合を確認してください。", liveFolderWriteFailed: "接続したフォルダーに変更を保存できませんでした。", liveFolderCheckFailed: "接続したフォルダーの外部変更を確認できませんでした。" },
  zh: { ...liveFolderCopies.zh, fileCopied: "已复制文件。", fileDownloaded: "已下载文件。", workspaceDownloaded: "已下载工作区。", exportFailed: "无法导出为文件。", openFailed: "无法打开此工作区。", saveOpenedWorkspaceFailed: "工作区已打开，但无法保存在此浏览器中。", unsupportedDrop: "请拖放 Markdown 文件。", confirmLiveFolderDelete: "也要从连接的文件夹中删除这些文件吗？", liveFolderPermissionLost: "文件夹写入权限已失效。更改仍保存在此浏览器中。", liveFolderWriteConflict: "连接的文件夹已在 Tabula 外部更改。请先检查冲突。", liveFolderWriteFailed: "无法将更改保存到连接的文件夹。", liveFolderCheckFailed: "无法检查连接文件夹中的外部更改。" },
  es: { ...liveFolderCopies.es, fileCopied: "Archivo copiado.", fileDownloaded: "Archivo descargado.", workspaceDownloaded: "Espacio descargado.", exportFailed: "No se pudo exportar a un archivo.", openFailed: "No se pudo abrir este espacio.", saveOpenedWorkspaceFailed: "El espacio se abrió, pero no se pudo guardar en este navegador.", unsupportedDrop: "Suelta un archivo Markdown.", confirmLiveFolderDelete: "¿Eliminar también estos archivos de la carpeta conectada?", liveFolderPermissionLost: "Se perdió el permiso de escritura. Los cambios siguen guardados en este navegador.", liveFolderWriteConflict: "La carpeta conectada cambió fuera de Tabula. Revisa el conflicto antes de guardar.", liveFolderWriteFailed: "No se pudieron guardar los cambios en la carpeta conectada.", liveFolderCheckFailed: "No se pudieron comprobar los cambios externos de la carpeta conectada." },
  fr: { ...liveFolderCopies.fr, fileCopied: "Fichier copié.", fileDownloaded: "Fichier téléchargé.", workspaceDownloaded: "Espace téléchargé.", exportFailed: "Impossible d’exporter vers un fichier.", openFailed: "Impossible d’ouvrir cet espace.", saveOpenedWorkspaceFailed: "L’espace est ouvert, mais n’a pas pu être enregistré dans ce navigateur.", unsupportedDrop: "Déposez un fichier Markdown.", confirmLiveFolderDelete: "Supprimer aussi ces fichiers du dossier connecté ?", liveFolderPermissionLost: "L’autorisation d’écriture a été perdue. Les modifications restent enregistrées dans ce navigateur.", liveFolderWriteConflict: "Le dossier connecté a changé hors de Tabula. Vérifiez le conflit avant d’enregistrer.", liveFolderWriteFailed: "Impossible d’enregistrer les modifications dans le dossier connecté.", liveFolderCheckFailed: "Impossible de vérifier les modifications externes du dossier connecté." },
  de: { ...liveFolderCopies.de, fileCopied: "Datei kopiert.", fileDownloaded: "Datei heruntergeladen.", workspaceDownloaded: "Workspace heruntergeladen.", exportFailed: "Export als Datei fehlgeschlagen.", openFailed: "Dieser Workspace konnte nicht geöffnet werden.", saveOpenedWorkspaceFailed: "Der Workspace wurde geöffnet, konnte aber nicht in diesem Browser gespeichert werden.", unsupportedDrop: "Markdown-Datei hier ablegen.", confirmLiveFolderDelete: "Diese Dateien auch aus dem verbundenen Ordner löschen?", liveFolderPermissionLost: "Die Schreibberechtigung ist verloren gegangen. Änderungen bleiben in diesem Browser gespeichert.", liveFolderWriteConflict: "Der verbundene Ordner wurde außerhalb von Tabula geändert. Prüfe den Konflikt vor dem Speichern.", liveFolderWriteFailed: "Änderungen konnten nicht im verbundenen Ordner gespeichert werden.", liveFolderCheckFailed: "Externe Änderungen im verbundenen Ordner konnten nicht geprüft werden." },
};

export const getWorkspaceIoCopy = (language: WorkspaceLanguage) =>
  copies[language];
