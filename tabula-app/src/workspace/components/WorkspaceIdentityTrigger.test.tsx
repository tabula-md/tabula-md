import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceIdentityTrigger } from "./WorkspaceIdentityTrigger";

const noop = () => undefined;

describe("WorkspaceIdentityTrigger", () => {
  it("keeps the workspace identity and its primary storage context together", () => {
    const html = renderToStaticMarkup(
      <WorkspaceIdentityTrigger
        contextSummary={{
          primary: {
            kind: "folder",
            title: "Connected folder",
            description: "Changes save automatically to this folder.",
            state: "steady",
            attention: false,
          },
          items: [],
        }}
        isOpen={false}
        label="Open Workspace menu"
        workspaceName="Team handbook"
        onToggle={noop}
      />,
    );

    expect(html).toContain("Team handbook");
    expect(html).toContain("Connected folder");
    expect(html).toContain("lucide-folder-open");
    expect(html).toContain('data-workspace-context="folder"');
    expect(html).toContain('data-workspace-state="steady"');
  });

  it("surfaces an attention state without replacing the workspace name", () => {
    const html = renderToStaticMarkup(
      <WorkspaceIdentityTrigger
        contextSummary={{
          primary: {
            kind: "collaboration",
            title: "Live collaboration",
            description: "Changes are synchronized.",
            state: "steady",
            attention: false,
          },
          items: [
            {
              kind: "folder",
              title: "Connected folder",
              description: "Folder permission is required before saving.",
              state: "attention",
              attention: true,
            },
          ],
        }}
        isOpen
        label="Close Workspace menu"
        workspaceName="Team handbook"
        onToggle={noop}
      />,
    );

    expect(html).toContain("Team handbook");
    expect(html).toContain("Connected folder");
    expect(html).toContain("lucide-triangle-alert");
    expect(html).toContain("attention active");
  });
});
