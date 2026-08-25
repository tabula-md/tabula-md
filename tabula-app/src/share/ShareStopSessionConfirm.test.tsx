import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getWorkspaceMenuCopy } from "../workspace/workspaceLocale";
import { ShareStopSessionConfirm } from "./ShareStopSessionConfirm";

const noop = () => undefined;

describe("ShareStopSessionConfirm", () => {
  it("offers joined-room users an explicit local workspace choice", () => {
    const copy = getWorkspaceMenuCopy("en").share;
    const html = renderToStaticMarkup(
      <ShareStopSessionConfirm
        copy={copy}
        canChooseExitStrategy
        exitStrategy="restore-local"
        onCancel={noop}
        onConfirm={noop}
        onExitStrategyChange={noop}
      />,
    );

    expect(html).toContain(copy.live.restoreLocalWorkspace);
    expect(html).toContain(copy.live.keepRoomCopy);
    expect(html).toContain('checked="" value="restore-local"');
    expect(html).toContain('value="adopt-room"');
  });

  it("keeps created-room exit confirmation concise", () => {
    const copy = getWorkspaceMenuCopy("en").share;
    const html = renderToStaticMarkup(
      <ShareStopSessionConfirm
        copy={copy}
        canChooseExitStrategy={false}
        exitStrategy="adopt-room"
        onCancel={noop}
        onConfirm={noop}
        onExitStrategyChange={noop}
      />,
    );

    expect(html).toContain(copy.live.stopConfirmDescription);
    expect(html).not.toContain('name="room-exit-strategy"');
  });
});
