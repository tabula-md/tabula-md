import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

type WorkspaceAssetCopy = {
  region: (name: string) => string;
  toolbar: string;
  actions: string;
  download: string;
  imagePreview: (name: string) => string;
  pdfPreview: (name: string) => string;
  previewUnavailable: string;
  previewUnavailableDescription: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceAssetCopy> = {
  en: {
    region: (name) => `${name} file`,
    toolbar: "File toolbar",
    actions: "File actions",
    download: "Download",
    imagePreview: (name) => `${name} preview`,
    pdfPreview: (name) => `${name} PDF preview`,
    previewUnavailable: "Preview unavailable",
    previewUnavailableDescription: "Download this file to open it in another app.",
  },
  ko: {
    region: (name) => `${name} 파일`,
    toolbar: "파일 도구",
    actions: "파일 동작",
    download: "다운로드",
    imagePreview: (name) => `${name} 미리보기`,
    pdfPreview: (name) => `${name} PDF 미리보기`,
    previewUnavailable: "미리볼 수 없음",
    previewUnavailableDescription: "다른 앱에서 열려면 이 파일을 다운로드하세요.",
  },
  ja: {
    region: (name) => `${name} ファイル`,
    toolbar: "ファイルツールバー",
    actions: "ファイル操作",
    download: "ダウンロード",
    imagePreview: (name) => `${name} プレビュー`,
    pdfPreview: (name) => `${name} PDF プレビュー`,
    previewUnavailable: "プレビューできません",
    previewUnavailableDescription: "別のアプリで開くには、このファイルをダウンロードしてください。",
  },
  zh: {
    region: (name) => `${name} 文件`,
    toolbar: "文件工具栏",
    actions: "文件操作",
    download: "下载",
    imagePreview: (name) => `${name} 预览`,
    pdfPreview: (name) => `${name} PDF 预览`,
    previewUnavailable: "无法预览",
    previewUnavailableDescription: "请下载此文件并在其他应用中打开。",
  },
  es: {
    region: (name) => `Archivo ${name}`,
    toolbar: "Barra de herramientas del archivo",
    actions: "Acciones del archivo",
    download: "Descargar",
    imagePreview: (name) => `Vista previa de ${name}`,
    pdfPreview: (name) => `Vista previa PDF de ${name}`,
    previewUnavailable: "Vista previa no disponible",
    previewUnavailableDescription: "Descarga este archivo para abrirlo en otra aplicación.",
  },
  fr: {
    region: (name) => `Fichier ${name}`,
    toolbar: "Barre d’outils du fichier",
    actions: "Actions du fichier",
    download: "Télécharger",
    imagePreview: (name) => `Aperçu de ${name}`,
    pdfPreview: (name) => `Aperçu PDF de ${name}`,
    previewUnavailable: "Aperçu indisponible",
    previewUnavailableDescription: "Téléchargez ce fichier pour l’ouvrir dans une autre application.",
  },
  de: {
    region: (name) => `${name} Datei`,
    toolbar: "Dateiwerkzeuge",
    actions: "Dateiaktionen",
    download: "Herunterladen",
    imagePreview: (name) => `${name} Vorschau`,
    pdfPreview: (name) => `${name} PDF-Vorschau`,
    previewUnavailable: "Keine Vorschau verfügbar",
    previewUnavailableDescription: "Laden Sie diese Datei herunter, um sie in einer anderen App zu öffnen.",
  },
};

export const getWorkspaceAssetCopy = (language: WorkspaceLanguage) =>
  copies[language];
