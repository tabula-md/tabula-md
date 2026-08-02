import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";

const english = {
  files: "Files",
  libraries: "Libraries",
  sections: "Workspace sections",
  emptyTitle: "No libraries yet",
  emptyDescription: "Browse reusable knowledge libraries and add them to Tabula.",
  browseLibraries: "Browse libraries",
  loading: "Loading libraries…",
  loadError: "Libraries could not be loaded.",
  readOnly: "Read-only library",
  version: (version: string) => `Version ${version}`,
  fileCount: (count: number) => count === 1 ? "1 file" : `${count} files`,
  openLibrary: (name: string) => `Open ${name}`,
  closeLibrary: (name: string) => `Close ${name}`,
  openFolder: (name: string) => `Open folder ${name}`,
  closeFolder: (name: string) => `Close folder ${name}`,
  source: "Open library source",
};

const korean = {
  ...english,
  files: "파일",
  libraries: "라이브러리",
  sections: "워크스페이스 섹션",
  emptyTitle: "아직 라이브러리가 없습니다",
  emptyDescription: "재사용 가능한 지식 라이브러리를 둘러보고 Tabula에 추가하세요.",
  browseLibraries: "라이브러리 둘러보기",
  loading: "라이브러리를 불러오는 중…",
  loadError: "라이브러리를 불러올 수 없습니다.",
  readOnly: "읽기 전용 라이브러리",
  version: (version: string) => `버전 ${version}`,
  fileCount: (count: number) => `파일 ${count}개`,
  openLibrary: (name: string) => `${name} 열기`,
  closeLibrary: (name: string) => `${name} 닫기`,
  openFolder: (name: string) => `${name} 폴더 열기`,
  closeFolder: (name: string) => `${name} 폴더 닫기`,
  source: "라이브러리 출처 열기",
};

export const getLibraryPanelCopy = (language: WorkspaceLanguage) =>
  language === "ko" ? korean : english;
