import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceMenu } from "./WorkspaceMenu";

const noop = () => undefined;
const workspaceContextSummary = {
  primary: {
    kind: "browser" as const,
    title: "This browser",
    description: "Saved automatically here.",
    state: "steady" as const,
    attention: false,
  },
  items: [{
    kind: "browser" as const,
    title: "This browser",
    description: "Saved automatically here.",
    state: "steady" as const,
    attention: false,
  }],
};

describe("WorkspaceMenu", () => {
  it("keeps workspace operations in the contextual menu", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMenu
        isOpen
        language="en"
        workspaceContextSummary={workspaceContextSummary}
        onImportWorkspace={noop}
        onOpenLiveWorkspace={noop}
        onExportWorkspace={noop}
        onClearWorkspace={noop}
      />,
    );

    expect(html).toContain("Import folder copy");
    expect(html).toContain("Connect local folder");
    expect(html).toContain("Export workspace");
    expect(html).toContain("Clear local workspace");
    expect(html).not.toContain("Workspace settings");
    expect(html).not.toContain("New document");
    expect(html).not.toContain("Help");
    expect(html).not.toContain("GitHub");
  });

  it("keeps collaboration recovery available from the compact popover", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMenu
        isOpen
        language="en"
        workspaceContextSummary={workspaceContextSummary}
        collaborationActive
        onRetryCollaboration={noop}
      />,
    );

    expect(html).toContain("Retry");
    expect(html).toContain("attention");
  });

  it("shows conflict review without exposing folder save controls", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMenu
        isOpen
        language="en"
        workspaceContextSummary={workspaceContextSummary}
        onReviewLiveFolderConflict={noop}
        onSaveLiveWorkspace={noop}
      />,
    );

    expect(html).toContain("Review folder conflict");
    expect(html).not.toContain("Save to folder");
  });
});
