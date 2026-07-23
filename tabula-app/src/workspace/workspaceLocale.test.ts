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

  it("keeps the start message action-first in every language", () => {
    expect(WORKSPACE_LANGUAGE_OPTIONS.map(({ value }) => getWorkspaceMenuCopy(value).emptyState.tagline)).toEqual([
      "Open Markdown. Share one link. Edit with people or agents.",
      "Markdown을 여세요. 링크 하나로 사람이나 에이전트와 함께 편집하세요.",
      "Markdownを開く。リンクを共有して、人やエージェントと編集。",
      "打开 Markdown。分享一个链接，与人或智能体一起编辑。",
      "Abre Markdown. Comparte un enlace. Edita con personas o agentes.",
      "Ouvrez Markdown. Partagez un lien. Modifiez avec des personnes ou des agents.",
      "Markdown öffnen. Einen Link teilen. Mit Menschen oder Agenten bearbeiten.",
    ]);
  });

  it("localizes Preferences, empty state, and Share chrome together", () => {
    const english = getWorkspaceMenuCopy("en");
    expect(english.actions.preferences).toBe("Preferences");
    expect(english.actions.importFile).toBe("Import document (.md)…");
    expect(english.actions.importWorkspace).toBe("Open folder…");
    expect(english.actions.exportFile).toBe("Export document (.md)");
    expect(english.actions.exportWorkspace).toBe("Export workspace (.zip)");
    expect(english.emptyState.tagline).toBe(
      "Open Markdown. Share one link. Edit with people or agents.",
    );
    expect(english.emptyState.newFile).toBe("New document");
    expect(english.share.live.startSession).toBe("Start session");
    expect(english.share.live.title).toBe("Open a live collaboration room");
    expect(english.share.live.description).toBe(
      "This private room keeps the workspace’s documents and comments in sync while people are connected. You can also invite an agent with the prompt.",
    );
    expect(english.share.nothingToShare).toBe(
      "Nothing to share yet. Create or open a document first.",
    );
    expect(english.share.chooserSecurityDescription).toBe(
      "Your workspace is encrypted before it leaves this browser. Only people with the link can open it—not even our servers can read it.",
    );
    expect(english.share.shareLinkLabel).toBe("Share link");
    expect(english.share.live.stopConfirmTitle).toBe(
      "Leave live collaboration?",
    );
    expect(english.share.live.stopSession).toBe("Leave room");
    expect(english.share.live.copyAgentInvite).toBe("Copy prompt");
    expect(getWorkspaceMenuCopy("ko").share.live.statusLabel("connected")).toBe(
      "실시간 협업 중",
    );
    expect(english.share.shareable.title).toBe("Share a snapshot by link");
    expect(english.share.shareable.description).toBe(
      "Create an encrypted copy of the workspace, including comments. People with the link can open that snapshot, but later changes won’t sync.",
    );
    expect(english.share.shareable.exportToLink).toBe("Create link");
    expect(english.share.shareable.expiryDescription("Jul 30, 2026")).toBe(
      "Expires Jul 30, 2026",
    );
    expect(english.share.modalTitle).toBe("Share");

    const korean = getWorkspaceMenuCopy("ko");
    expect(korean.actions.preferences).toBe("환경설정");
    expect(korean.emptyState.openFile).toBe("Markdown 파일 열기");
    expect(korean.share.live.startSession).toBe("세션 시작");
    expect(korean.share.shareable.title).toBe("스냅샷 링크로 공유하기");
    expect(korean.share.shareable.description).toBe(
      "댓글을 포함한 워크스페이스의 암호화된 복사본을 만듭니다. 링크를 가진 사람은 스냅샷을 열 수 있지만 이후 변경 사항은 동기화되지 않습니다.",
    );
    expect(korean.share.modalTitle).toBe("공유");
  });
});
