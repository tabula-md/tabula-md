import { describe, expect, it } from "vitest";
import {
  getWorkspaceMenuCopy,
  WORKSPACE_LANGUAGE_OPTIONS,
} from "./workspaceLocale";

describe("workspace locale chrome copy", () => {
  it("keeps the supported language set visible and bounded", () => {
    expect(WORKSPACE_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual([
      "en",
      "ko",
      "ja",
      "zh",
      "es",
      "fr",
      "de",
    ]);
  });

  it("localizes Preferences, empty state, and Share chrome together", () => {
    const english = getWorkspaceMenuCopy("en");
    expect(english.actions.preferences).toBe("Preferences");
    expect(english.emptyState.tagline).toBe(
      "A local-first workspace for files that people and coding agents can share safely.",
    );
    expect(english.emptyState.newFile).toBe("New File");
    expect(english.share.live.startSession).toBe("Start session");
    expect(english.share.live.includedCount(1, 3)).toBe("1/3 included");
    expect(english.share.shareable.title).toBe("Export to link");
    expect(english.share.shareable.description).toBe(
      "Create an encrypted link to a copy of the included documents.",
    );
    expect(english.share.modalTitle).toBe("Share");

    const korean = getWorkspaceMenuCopy("ko");
    expect(korean.actions.preferences).toBe("환경설정");
    expect(korean.emptyState.openFile).toBe("파일 열기");
    expect(korean.share.live.startSession).toBe("세션 시작");
    expect(korean.share.live.includedCount(1, 3)).toBe("1/3개 포함");
    expect(korean.share.shareable.title).toBe("링크로 내보내기");
    expect(korean.share.shareable.description).toBe(
      "포함된 문서의 암호화된 복사본 링크를 만듭니다.",
    );
    expect(korean.share.modalTitle).toBe("공유");
  });
});
