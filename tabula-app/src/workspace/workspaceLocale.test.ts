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
    expect(english.share.live.description).toBe(
      "Collaborate on the whole workspace in an encrypted live room.",
    );
    expect(english.share.nothingToShare).toBe(
      "Nothing to share yet. Create or open a document first.",
    );
    expect(english.share.chooserSecurityDescription).toContain("Tabula.md");
    expect(english.share.live.inviteAgent).toBe("Invite an agent");
    expect(english.share.live.inviteAgentDescription).toContain(
      "what you want changed",
    );
    expect(english.share.live.agentAccessWarning).toContain(
      "hosted MCP can read room content",
    );
    expect(english.share.live.resultDescription).toBe(
      "Changes sync in real time.",
    );
    expect(english.share.shareLinkLabel).toBe("Share link");
    expect(english.share.workspaceSummary(2)).toBe(
      "Whole workspace · 2 documents · comments included",
    );
    expect(english.share.live.stopConfirmTitle).toBe(
      "Stop live collaboration?",
    );
    expect(english.share.shareable.title).toBe("Export link");
    expect(english.share.shareable.description).toBe(
      "Create an encrypted point-in-time copy. Changes do not sync back.",
    );
    expect(english.share.shareable.exportToLink).toBe("Create link");
    expect(english.share.shareable.resultDescription).toBe(
      "Snapshot created. Changes do not sync.",
    );
    expect(english.share.shareable.snapshotMetadata("Jul 30, 2026")).toBe(
      "Snapshot · Expires Jul 30, 2026",
    );
    expect(english.share.modalTitle).toBe("Share");

    const korean = getWorkspaceMenuCopy("ko");
    expect(korean.actions.preferences).toBe("환경설정");
    expect(korean.emptyState.openFile).toBe("Markdown 파일 열기");
    expect(korean.share.live.startSession).toBe("세션 시작");
    expect(korean.share.shareable.title).toBe("내보내기 링크");
    expect(korean.share.shareable.description).toBe(
      "암호화된 시점 복사본을 만듭니다. 이후 변경은 원본에 동기화되지 않습니다.",
    );
    expect(korean.share.modalTitle).toBe("공유");
  });
});
