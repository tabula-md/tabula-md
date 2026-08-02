import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";

const english = {
  files: "Files",
  libraries: "Libraries",
  sections: "Workspace sections",
  emptyTitle: "No libraries yet",
  emptyDescription: "Import a bundle or browse reusable knowledge libraries.",
  importBundle: "Import bundle",
  browseLibraries: "Browse libraries",
  importFailed: "This bundle couldn’t be imported.",
  fileCount: (count: number) => `${count} ${count === 1 ? "file" : "files"}`,
  tree: (name: string) => `${name} bundle contents`,
};

const korean = {
  ...english,
  files: "파일",
  libraries: "라이브러리",
  sections: "워크스페이스 섹션",
  emptyTitle: "아직 라이브러리가 없습니다",
  emptyDescription: "번들을 가져오거나 재사용 가능한 지식 라이브러리를 둘러보세요.",
  importBundle: "번들 가져오기",
  browseLibraries: "라이브러리 둘러보기",
  importFailed: "이 번들을 가져오지 못했습니다.",
  fileCount: (count: number) => `파일 ${count}개`,
  tree: (name: string) => `${name} 번들 내용`,
};

export const getLibraryPanelCopy = (language: WorkspaceLanguage) =>
  language === "ko" ? korean : english;
