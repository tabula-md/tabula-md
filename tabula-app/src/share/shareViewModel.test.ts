import { describe, expect, it } from "vitest";
import { buildShareViewModel, normalizeSharePanel } from ".";

const labels = {
  shareLink: "Share link",
  export: "Export",
  sendTo: "Send to...",
  exportToLink: "Create snapshot link",
  exporting: "Creating link",
  updateLink: "New snapshot link",
};

const baseInput = {
  activePanel: "share-link" as const,
  canStartSession: true,
  isLive: false,
  labels,
  jsonShareCanExport: true,
  jsonShareDisabledReason: "",
  jsonShareExporting: false,
  startSessionUnavailableReason: "",
};

describe("share view model", () => {
  it("keeps the public share surface limited to implemented tabs", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
      activePanel: "publish",
    });

    expect(viewModel.activePanel).toBe("share-link");
    expect(viewModel.tabs.map((tab) => tab.id)).toEqual([
      "share-link",
      "export",
      "send-to",
    ]);
    expect(viewModel.tabs).not.toContainEqual(
      expect.objectContaining({ id: "publish" }),
    );
  });

  it("normalizes unknown or future share panels to the share link tab", () => {
    expect(normalizeSharePanel("export")).toBe("export");
    expect(normalizeSharePanel("send-to")).toBe("send-to");
    expect(normalizeSharePanel("publish")).toBe("share-link");
    expect(normalizeSharePanel("future-panel")).toBe("share-link");
    expect(normalizeSharePanel(undefined)).toBe("share-link");
  });

  it("models snapshot links as encrypted copies, not read-only publishing", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
      jsonShareUrl: "https://tabula.md/#json=snapshot,key",
    });

    expect(viewModel.shareable.status).toBe("exported");
    expect(viewModel.shareable.primaryLabel).toBe("New snapshot link");
    expect(JSON.stringify(viewModel.shareable).toLowerCase()).not.toContain(
      "read-only",
    );
    expect(JSON.stringify(viewModel.shareable).toLowerCase()).not.toContain(
      "publish",
    );
  });

  it("blocks snapshot export with a direct disabled reason", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
      jsonShareCanExport: false,
      jsonShareDisabledReason: "Add content before exporting a link.",
    });

    expect(viewModel.shareable.status).toBe("blocked");
    expect(viewModel.shareable.canExport).toBe(false);
    expect(viewModel.shareable.disabledReason).toBe(
      "Add content before exporting a link.",
    );
  });

  it("keeps the live room invite display unavailable until a valid room link exists", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
      isLive: true,
      roomId: "room_123",
      shareUrl: "https://tabula.md/#room=other,key",
    });

    expect(viewModel.live.status).toBe("active");
    expect(viewModel.live.link.canCopy).toBe(false);
  });
});
