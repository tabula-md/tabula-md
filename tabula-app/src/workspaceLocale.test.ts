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
    expect(english.share.shareable.title).toBe("Snapshot link");
    expect(english.share.shareable.description).toBe(
      "Create an encrypted local-copy snapshot. Anyone with the full link can open it for 7 days.",
    );
    expect(english.share.shareable.emptyFileReason("Untitled")).toBe(
      "Add content to Untitled before creating a snapshot link.",
    );
    expect(english.share.modalTitle("README")).toBe("Share README");

    const korean = getWorkspaceMenuCopy("ko");
    expect(korean.actions.preferences).toBe("환경설정");
    expect(korean.emptyState.openFile).toBe("파일 열기");
    expect(korean.share.tabs.shareLink).toBe("공유 링크");
    expect(korean.share.shareable.title).toBe("스냅샷 링크");
    expect(korean.share.shareable.description).toBe(
      "암호화된 로컬 복사본 스냅샷을 만듭니다. 전체 링크가 있으면 7일 동안 열 수 있습니다.",
    );
    expect(korean.share.shareable.emptyFileReason("Untitled 5")).toBe(
      "Untitled 5에 내용을 추가하면 스냅샷 링크를 만들 수 있습니다.",
    );
    expect(korean.share.modalTitle("README")).toBe("README 공유");
  });
});
