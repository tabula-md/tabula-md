import { describe, expect, it } from "vitest";
import { buildPublishViewModel, formatPublicUrlPreview } from "./publishViewModel";

const baseInput = {
  activeFileDisplayTitle: "README",
  activeFileTitle: "README.md",
  tabulaPlusEnabled: true,
  publishScope: "file" as const,
  publishFileCount: 3,
  canRepublishSnapshot: true,
  publishing: false,
  unpublishing: false,
};

describe("publish view model", () => {
  it("builds the current-page publish plan", () => {
    const viewModel = buildPublishViewModel(baseInput);

    expect(viewModel.headingTitle).toBe("Publish a public page");
    expect(viewModel.status).toBe("ready");
    expect(viewModel.primaryLabel).toBe("Publish current page");
    expect(viewModel.canSubmit).toBe(true);
    expect(viewModel.details.filesLabel).toBe("1 file");
    expect(viewModel.summary).toBe("README will be published.");
    expect(viewModel.scopeCards).toEqual([
      { scope: "file", active: true, title: "Current page", detail: "README" },
      { scope: "project", active: false, title: "Project", detail: "3 files" },
    ]);
  });

  it("builds the project publish plan", () => {
    const viewModel = buildPublishViewModel({ ...baseInput, publishScope: "project" });

    expect(viewModel.primaryLabel).toBe("Publish project");
    expect(viewModel.details.filesLabel).toBe("3 files");
    expect(viewModel.summary).toBe("3 project files will be published.");
  });

  it("describes published-page management", () => {
    const viewModel = buildPublishViewModel({
      ...baseInput,
      publishScope: "project",
      publishPageUrl: "https://tabula.md/p/publish_1234567890",
      publishedScope: "project",
      publishedFileCount: 3,
      publishedAt: "2026-06-21T17:38:00.000Z",
    });

    expect(viewModel.headingTitle).toBe("Published page");
    expect(viewModel.status).toBe("published");
    expect(viewModel.primaryLabel).toBe("Update project");
    expect(viewModel.publishedScopeSummary).toBe("Published as a project: 3 files.");
    expect(viewModel.details.publishedScopeTitle).toBe("Project");
    expect(viewModel.details.publishedFilesLabel).toBe("3 files");
    expect(viewModel.publicUrlPreview).toBe("https://tabula.md/p/publish_...");
    expect(viewModel.summary).toContain("This updates the existing project publish at the same URL.");
    expect(viewModel.summary).toContain("Published ");
    expect(viewModel.managementActions).toEqual([
      { id: "update", label: "Update project", disabled: false, disabledReason: "" },
      { id: "view", label: "View page", disabled: false, disabledReason: "" },
      { id: "copy", label: "Copy link", disabled: false, disabledReason: "" },
      { id: "changeScope", label: "Change scope", disabled: false, disabledReason: "" },
      { id: "unpublish", label: "Unpublish", disabled: false, disabledReason: "" },
    ]);
  });

  it("makes scope replacement explicit", () => {
    const viewModel = buildPublishViewModel({
      ...baseInput,
      publishScope: "project",
      publishPageUrl: "https://tabula.md/p/snapshot-1",
      publishedScope: "file",
    });

    expect(viewModel.selectedScopeChanged).toBe(true);
    expect(viewModel.primaryLabel).toBe("Republish as project");
    expect(viewModel.summary).toBe(
      "This will replace the existing current-page publish with a project publish at the same URL.",
    );
  });

  it("blocks publish when content is missing", () => {
    const viewModel = buildPublishViewModel({
      ...baseInput,
      publishBlockerMessage: "Add content to Untitled before publishing.",
    });

    expect(viewModel.blocked).toBe(true);
    expect(viewModel.status).toBe("blocked");
    expect(viewModel.canSubmit).toBe(false);
    expect(viewModel.disabledReason).toBe("Add content to Untitled before publishing.");
    expect(viewModel.summary).toBe("Add content to Untitled before publishing.");
  });

  it("builds the Plus boundary model", () => {
    const viewModel = buildPublishViewModel({ ...baseInput, tabulaPlusEnabled: false });

    expect(viewModel.requiresPlus).toBe(true);
    expect(viewModel.status).toBe("plus-required");
    expect(viewModel.canSubmit).toBe(false);
    expect(viewModel.headingTitle).toBe("Publish with Tabula +");
    expect(viewModel.headingDescription).toBe(
      "Public pages, project publishing, and durable agent handoff belong to Tabula +.",
    );
  });

  it("formats public URLs defensively", () => {
    expect(formatPublicUrlPreview("https://tabula.md/p/short")).toBe("https://tabula.md/p/short");
    expect(formatPublicUrlPreview("https://tabula.md/p/1234567890abcdef")).toBe("https://tabula.md/p/12345678...");
    expect(formatPublicUrlPreview("not a url")).toBe("not a url");
  });
});
