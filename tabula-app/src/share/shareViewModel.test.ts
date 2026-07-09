import { describe, expect, it } from "vitest";
import { buildShareViewModel } from ".";

const labels = {
  exportToLink: "Export to link",
  exporting: "Exporting link",
};

const baseInput = {
  canStartSession: true,
  isLive: false,
  labels,
  jsonShareCanExport: true,
  jsonShareDisabledReason: "",
  jsonShareExporting: false,
  startSessionUnavailableReason: "",
};

describe("share view model", () => {
  it("models the share surface as a single live/export screen", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
    });

    expect(viewModel).not.toHaveProperty("tabs");
    expect(viewModel).not.toHaveProperty("activePanel");
  });

  it("models export links as encrypted copy links, not publishing", () => {
    const viewModel = buildShareViewModel({
      ...baseInput,
      jsonShareUrl: "https://tabula.md/#json=snapshot,key",
    });

    expect(viewModel.shareable.status).toBe("exported");
    expect(viewModel.shareable.primaryLabel).toBe("Export to link");
    expect(JSON.stringify(viewModel.shareable).toLowerCase()).not.toContain(
      "publish",
    );
  });

  it("blocks export link creation with a direct disabled reason", () => {
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
