import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import { ShareTrigger } from "./ShareTrigger";

const noop = () => undefined;

const renderTrigger = ({
  connectionStatus,
  isLive,
}: {
  connectionStatus: ConnectionStatus;
  isLive: boolean;
}) => renderToStaticMarkup(
  <ShareTrigger
    connectionStatus={connectionStatus}
    isLive={isLive}
    language="en"
    shareOpen={false}
    onToggleShare={noop}
  />,
);

describe("ShareTrigger", () => {
  it.each<ConnectionStatus>([
    "connected",
    "connecting",
    "reconnecting",
    "suspended",
    "disconnected",
  ])("keeps the Share identity while the live status is %s", (connectionStatus) => {
    const html = renderTrigger({ connectionStatus, isLive: true });

    expect(html).toContain('<span class="share-label-visible">Share</span>');
    expect(html).toContain('class="lucide lucide-share2"');
    expect(html).toContain('class="share-button share-trigger');
    expect(html).toContain(' live ');
  });

  it("keeps live status details in the accessible label", () => {
    const html = renderTrigger({ connectionStatus: "connected", isLive: true });

    expect(html).toContain('aria-label="Share: live collaboration active"');
    expect(html).toContain('data-live-status="connected"');
  });
});
