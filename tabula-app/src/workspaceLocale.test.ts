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
    expect(english.share.tabs.shareLink).toBe("Share link");
    expect(english.share.shareable.description).toBe("Export an encrypted copy of this file.");
    expect(english.share.modalTitle("README")).toBe("Share README");

    const korean = getWorkspaceMenuCopy("ko");
    expect(korean.actions.preferences).toBe("환경설정");
    expect(korean.emptyState.openFile).toBe("파일 열기");
    expect(korean.share.tabs.shareLink).toBe("공유 링크");
    expect(korean.share.shareable.description).toBe("이 파일의 암호화된 복사본을 내보냅니다.");
    expect(korean.share.modalTitle("README")).toBe("README 공유");
  });
});
