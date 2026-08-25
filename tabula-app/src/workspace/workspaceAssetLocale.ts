import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

type WorkspaceAssetCopy = {
  region: (name: string) => string;
  toolbar: string;
  actions: string;
  copy: string;
  copied: string;
  download: string;
  imagePreview: (name: string) => string;
  pdfPreview: (name: string) => string;
  audioPreview: (name: string) => string;
  videoPreview: (name: string) => string;
  previewUnavailable: string;
  previewUnavailableDescription: string;
};

const en: WorkspaceAssetCopy = {
  region: (name) => `${name} file`,
  toolbar: "File toolbar",
  actions: "File actions",
  copy: "Copy contents",
  copied: "Copied",
  download: "Download",
  imagePreview: (name) => `${name} preview`,
  pdfPreview: (name) => `${name} PDF preview`,
  audioPreview: (name) => `${name} audio player`,
  videoPreview: (name) => `${name} video player`,
  previewUnavailable: "Preview unavailable",
  previewUnavailableDescription: "Download this file to open it in another app.",
};

const ko: WorkspaceAssetCopy = {
  region: (name) => `${name} 파일`,
  toolbar: "파일 도구",
  actions: "파일 동작",
  copy: "내용 복사",
  copied: "복사됨",
  download: "다운로드",
  imagePreview: (name) => `${name} 미리보기`,
  pdfPreview: (name) => `${name} PDF 미리보기`,
  audioPreview: (name) => `${name} 오디오 플레이어`,
  videoPreview: (name) => `${name} 비디오 플레이어`,
  previewUnavailable: "미리볼 수 없음",
  previewUnavailableDescription: "다른 앱에서 열려면 이 파일을 다운로드하세요.",
};

const copies: Record<WorkspaceLanguage, WorkspaceAssetCopy> = {
  en,
  ko,
  ja: en,
  zh: en,
  es: en,
  fr: en,
  de: en,
};

export const getWorkspaceAssetCopy = (language: WorkspaceLanguage) =>
  copies[language];
