import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";

const english = {
  files: "Files",
  libraries: "Libraries",
  sections: "Workspace sections",
  emptyTitle: "No libraries yet",
  emptyDescription: "Browse reusable knowledge libraries and add them to Tabula.",
  browseLibraries: "Browse libraries",
};

const korean = {
  ...english,
  files: "파일",
  libraries: "라이브러리",
  sections: "워크스페이스 섹션",
  emptyTitle: "아직 라이브러리가 없습니다",
  emptyDescription: "재사용 가능한 지식 라이브러리를 둘러보고 Tabula에 추가하세요.",
  browseLibraries: "라이브러리 둘러보기",
};

export const getLibraryPanelCopy = (language: WorkspaceLanguage) =>
  language === "ko" ? korean : english;
