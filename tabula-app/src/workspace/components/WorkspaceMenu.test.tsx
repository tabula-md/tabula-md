import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceMenu } from "./WorkspaceMenu";

const noop = () => undefined;

describe("WorkspaceMenu", () => {
  it("shows every storage context with the active runtime first", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMenu
        isOpen
        preferencesOpen={false}
        theme="system"
        language="en"
        onTogglePreferences={noop}
        onChangeTheme={noop}
        onChangeLanguage={noop}
        onAddFile={noop}
        onImportFile={noop}
        contextSummary={{
          primary: {
            kind: "collaboration",
            title: "Live collaboration",
            description: "Changes are synchronized with everyone in this room.",
            state: "steady",
            attention: false,
          },
          items: [
            {
              kind: "browser",
              title: "This browser",
              description: "Browser persistence is paused.",
              state: "paused",
              attention: false,
            },
            {
              kind: "folder",
              title: "Handbook",
              description: "Saving to this folder is paused.",
              state: "paused",
              attention: false,
            },
            {
              kind: "collaboration",
              title: "Live collaboration",
              description: "Changes are synchronized with everyone in this room.",
              state: "steady",
              attention: false,
            },
          ],
        }}
        onExportFile={noop}
        onExportWorkspace={noop}
        canExportFile
        canExportWorkspace
        onOpenAbout={noop}
        onOpenHelp={noop}
      />,
    );

    expect(html.indexOf("Live collaboration")).toBeLessThan(
      html.indexOf("This browser"),
    );
    expect(html.indexOf("This browser")).toBeLessThan(html.indexOf("Handbook"));
    expect(html).toContain('aria-label="Documents"');
    expect(html).toContain('aria-label="Workspace"');
    expect(html).not.toContain("Save to folder");
  });

  it("keeps collaboration recovery available outside the share dialog", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMenu
        isOpen
        preferencesOpen={false}
        theme="system"
        language="en"
        onTogglePreferences={noop}
        onChangeTheme={noop}
        onChangeLanguage={noop}
        onAddFile={noop}
        onImportFile={noop}
        contextSummary={{
          primary: {
            kind: "collaboration",
            title: "Live collaboration",
            description: "Offline changes are only in this tab.",
            state: "attention",
            attention: true,
          },
          items: [],
        }}
        collaborationActive
        onOpenCollaboration={noop}
        onRetryCollaboration={noop}
        onExportFile={noop}
        onExportWorkspace={noop}
        canExportFile
        canExportWorkspace
        onOpenAbout={noop}
        onOpenHelp={noop}
      />,
    );

    expect(html).toContain("Retry");
    expect(html).toContain("lucide-radio");
  });
});
