import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const id = "okf-concepts";
export const description = "OKF concept graph roles, filters, details, and metadata retrieval.";

const fixtureRoot = path.resolve(
  "scripts/browser-smoke/fixtures/openwiki-okf",
);

const readFixtureEntries = async (directory, relativeDirectory = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((first, second) =>
    first.name.localeCompare(second.name))) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readFixtureEntries(absolutePath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: await readFile(absolutePath, "utf8"),
      });
    }
  }
  return files;
};

const openExportPreflight = async (page, openProjectMenu) => {
  await openProjectMenu(page);
  await page.getByRole("button", {
    name: "Export workspace (.zip)",
    exact: true,
  }).click();
  const exportReview = page.getByRole("dialog", {
    name: "Review workspace export",
  });
  await exportReview.waitFor();
  await exportReview.getByRole("button", {
    name: "Review issues",
    exact: true,
  }).click();
  await page.getByRole("heading", {
    name: "Knowledge base compatibility",
    exact: true,
  }).waitFor();
};

export async function run(ctx) {
  const {
    browser,
    ensureSidePanelOpen,
    expect,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForPanelTab,
    withPage,
  } = ctx;
  const fixtureEntries = await readFixtureEntries(fixtureRoot);

  await withPage(browser, "/", async (page) => {
    await page.locator('input[aria-label="Open folder"]').evaluate(
      (input, entries) => {
        const dataTransfer = new DataTransfer();
        for (const entry of entries) {
          const name = entry.path.split("/").at(-1);
          const file = new File(
            [entry.content],
            name,
            {
              type: entry.path.endsWith(".md")
                ? "text/markdown"
                : "application/json",
            },
          );
          Object.defineProperty(file, "webkitRelativePath", {
            value: `openwiki-okf/${entry.path}`,
          });
          dataTransfer.items.add(file);
        }
        Object.defineProperty(input, "files", {
          configurable: true,
          value: dataTransfer.files,
        });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      fixtureEntries,
    );
    await page.getByRole("dialog", { name: "Open folder" }).waitFor();
    const detectedWorkspace = page.getByRole("region", {
      name: "Detected workspace",
    });
    expect(
      await detectedWorkspace.getByText("OKF 0.1", { exact: true }).isVisible() &&
        await detectedWorkspace.getByText("OpenWiki", { exact: true }).isVisible() &&
        await detectedWorkspace.getByText("Markdown links", { exact: true }).isVisible() &&
        await detectedWorkspace.getByText(
          "Root index declares OKF 0.1.",
          { exact: true },
        ).isVisible(),
      "Folder import should distinguish the OKF standard from OpenWiki and link conventions.",
    );
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await waitForPanelTab(page, "Files");
    expect(
      (await page.getByRole("button", {
        name: "Open .last-update.json",
        exact: true,
      }).count()) === 1,
      "OpenWiki run state should survive folder import as a workspace support file.",
    );
    await page.getByRole("button", {
      name: "Open runtime.md",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "runtime.md" });
    await waitForEditorReady(page, { mode: "edit" });

    const sidePanelNavigation = page.getByRole("navigation", {
      name: "Side panel sections",
    });
    await sidePanelNavigation.getByRole("button", {
      name: "Knowledge",
      exact: true,
    }).click();
    await waitForPanelTab(page, "Knowledge");
    const documentKnowledgeContext = page.getByRole("region", {
      name: "Knowledge context",
    });
    expect(
      await documentKnowledgeContext.getByRole("heading", {
        name: "Runtime architecture",
        exact: true,
      }).isVisible() &&
        await documentKnowledgeContext.getByText(
          "How application services fit together at runtime.",
          { exact: true },
        ).isVisible() &&
        await documentKnowledgeContext.getByText("Architecture", { exact: true }).isVisible() &&
        await documentKnowledgeContext.getByText("runtime, platform", { exact: true }).isVisible(),
      "Knowledge should explain the active document rather than opening a workspace browser.",
    );
    expect(
      (await documentKnowledgeContext.getByRole("link", {
        name: /Open source/,
      }).getAttribute("href")) ===
          "https://github.com/acme/example/tree/main/src",
      "The active document context should keep its canonical source actionable.",
    );
    expect(
      (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0 &&
        (await page.getByRole("button", {
          name: "Review workspace",
          exact: true,
        }).count()) === 0 &&
        (await page.locator(".right-graph-panel").count()) === 0,
      "Knowledge should not expose browse, graph, or review-workspace modes during editing.",
    );

    await sidePanelNavigation.getByRole("button", {
      name: "Search",
      exact: true,
    }).click();
    await waitForPanelTab(page, "Search");
    const conceptSearch = page.getByRole("searchbox", {
      name: "Search documents and metadata",
      exact: true,
    });
    await conceptSearch.fill("dispatches work");
    expect(
      await page.getByRole("button", {
        name: "architecture/runtime",
        exact: true,
      }).isVisible() &&
        (await page.locator(".right-panel-search-result").count()) === 1,
      "Search should retrieve concept body text without turning Knowledge into a catalog.",
    );
    await conceptSearch.fill("");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("button", { name: /^Architecture\s+1$/ }).click();
    await page.getByRole("button", { name: "Show 1 document", exact: true }).click();
    expect(
      (await page.locator(".right-panel-search-result").count()) === 1 &&
        await page.getByRole("button", {
          name: "Remove Type: Architecture",
          exact: true,
        }).isVisible(),
      "Metadata filters should visibly constrain the result list and remain removable.",
    );

    await openProjectMenu(page);
    await page.getByRole("button", {
      name: "Export workspace (.zip)",
      exact: true,
    }).click();
    const exportReview = page.getByRole("dialog", {
      name: "Review workspace export",
    });
    await exportReview.waitFor();
    expect(
      await exportReview.getByText("Compatibility", { exact: true }).isVisible() &&
        await exportReview.getByText("Knowledge health", { exact: true }).isVisible() &&
        await exportReview.getByText("Handoff log", { exact: true }).isVisible(),
      "Knowledge workspace export should surface its checks at the handoff boundary.",
    );
    await exportReview.getByRole("button", {
      name: "Review issues",
      exact: true,
    }).click();
    await page.getByRole("heading", {
      name: "Knowledge base compatibility",
      exact: true,
    }).waitFor();
    expect(
      (await page.getByRole("dialog", {
        name: "Review workspace export",
      }).count()) === 0,
      "Review issues should leave the summary and open the export preflight.",
    );
    expect(
      await page.getByText("Compatible with OKF 0.1", { exact: true }).isVisible() &&
        (await page.getByText("Required changes", { exact: true }).count()) === 0,
      "A valid OpenWiki 0.1 bundle should pass compatibility without required changes.",
    );
    const rootIndex = page.locator(".right-compatibility-index-item > button")
      .filter({ has: page.locator("strong", { hasText: /^index\.md$/ }) });
    await rootIndex.click();
    expect(
      await rootIndex.getByText("Curated", { exact: true }).isVisible() &&
        await page.getByRole("button", { name: "Current index", exact: true }).isVisible() &&
        await page.getByRole("button", { name: "Generated candidate", exact: true }).isVisible(),
      "A human-authored OpenWiki index should be distinguished from a generated candidate.",
    );
    await page.getByRole("button", {
      name: "Replace curated index…",
      exact: true,
    }).click();
    expect(
      await page.getByText(
        "This replaces human-written index content with the generated candidate.",
        { exact: true },
      ).isVisible() &&
        await page.getByRole("button", { name: "Replace index", exact: true }).isVisible(),
      "Replacing curated index prose should require a second explicit confirmation.",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await page.getByRole("button", { name: "Replace index", exact: true }).count()) === 0,
      "Cancelling curated index replacement should leave the source untouched.",
    );
    await page.getByRole("button", { name: "Close export preflight", exact: true }).click();
    await openProjectMenu(page);
    await page.getByRole("button", {
      name: "Export workspace (.zip)",
      exact: true,
    }).click();
    const reviewedDownloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog", {
      name: "Review workspace export",
    }).getByRole("button", {
      name: /^Export(?: anyway)?$/,
    }).click();
    const reviewedDownload = await reviewedDownloadPromise;
    expect(
      reviewedDownload.suggestedFilename().endsWith(".zip"),
      "Confirming the review should download the reviewed workspace snapshot.",
    );
  });

  await withPage(browser, "/", async (page) => {
    const migrationEntries = [
      {
        path: "index.md",
        content: '---\nokf_version: "0.2"\n---\n\n# Files',
      },
      {
        path: "notes/source.md",
        content: [
          "---",
          "type: Note",
          "status: deprecated",
          "stale_after: 2020-01-01",
          "generated: { by: agent:research, at: 2026-07-20T00:00:00Z }",
          "verified: { by: human:taeha, at: 2026-07-19T00:00:00Z }",
          "sources:",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "---",
          "",
          "See [[Target|the target]]. Claim [^missing]. Broken [Missing](missing.md).",
        ].join("\n"),
      },
      {
        path: "notes/Target.md",
        content: "---\ntype: Note\n---\n\n# Target\n\n[Source](source.md)",
      },
    ];
    await page.locator('input[aria-label="Open folder"]').evaluate(
      (input, entries) => {
        const dataTransfer = new DataTransfer();
        for (const entry of entries) {
          const file = new File(
            [entry.content],
            entry.path.split("/").at(-1),
            { type: "text/markdown" },
          );
          Object.defineProperty(file, "webkitRelativePath", {
            value: `wikilink-migration/${entry.path}`,
          });
          dataTransfer.items.add(file);
        }
        Object.defineProperty(input, "files", {
          configurable: true,
          value: dataTransfer.files,
        });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      migrationEntries,
    );
    await page.getByRole("dialog", { name: "Open folder" }).waitFor();
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Knowledge", exact: true }).click();
    await openExportPreflight(page, openProjectMenu);
    const humanReview = page.getByRole("region", { name: "Human review 1" });
    await humanReview.locator(".right-compatibility-verification-row").click();
    const evidenceCount = await humanReview.getByText(
      "https://example.com/policy",
      { exact: true },
    ).count();
    const priorVerificationCount = await humanReview.getByText(
      /human:taeha/,
    ).count();
    expect(
      evidenceCount > 0 && priorVerificationCount > 0,
      `Human review should expose the source and prior verification before approval (evidence=${evidenceCount}, prior=${priorVerificationCount}).`,
    );
    await humanReview.getByRole("checkbox", {
      name: "I compared this document with the sources listed above.",
      exact: true,
    }).click();
    await humanReview.getByRole("button", {
      name: /^Record as /,
    }).click();
    await humanReview.waitFor({ state: "detached" });
    expect(
      (await page.getByRole("region", { name: /^Human review/ }).count()) === 0,
      "Recording a human verification should clear the outdated review signal.",
    );
    expect(
      await page.getByText("Knowledge health", { exact: true }).isVisible() &&
        await page.getByText("Refresh after 2020-01-01", { exact: true }).isVisible() &&
        await page.getByText(
          "Deprecated concept still has 1 references",
          { exact: true },
        ).isVisible() &&
        await page.getByText(
          "Citation has no matching source: missing",
          { exact: true },
        ).isVisible() &&
        await page.getByText(
          "Relationship target does not exist: missing.md",
          { exact: true },
        ).isVisible() &&
        await page.getByText(
          "Source id is duplicated: policy",
          { exact: true },
        ).isVisible() &&
        await page.getByText(
          "Source resource is duplicated: https://example.com/policy",
          { exact: true },
        ).isVisible(),
      "OKF compatibility should remain separate from read-only knowledge maintenance signals.",
    );
    await page.getByRole("button").filter({
      hasText: "Refresh after 2020-01-01",
    }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await page.waitForFunction(() =>
      window.getSelection()?.toString() === "stale_after: 2020-01-01"
    );
    expect(
      await page.evaluate(() =>
        window.getSelection()?.toString() === "stale_after: 2020-01-01"
      ),
      "Knowledge metadata signals should select the exact frontmatter field.",
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await openExportPreflight(page, openProjectMenu);
    await page.getByRole("button").filter({
      hasText: "Relationship target does not exist: missing.md",
    }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await page.waitForFunction(() =>
      window.getSelection()?.toString() === "[Missing](missing.md)"
    );
    expect(
      await page.evaluate(() =>
        window.getSelection()?.toString() === "[Missing](missing.md)"
      ),
      "Relationship signals should reopen editing and select the broken link.",
    );
    await openExportPreflight(page, openProjectMenu);
    await page.getByRole("checkbox", {
      name: "Include this change: notes/source.md",
      exact: true,
    }).click();
    expect(
      await page.getByText("[the target](Target.md)", { exact: false }).isVisible(),
      "Resolved wikilinks should show a Markdown diff before conversion.",
    );
    await page.getByRole("button", {
      name: "Convert selected",
      exact: true,
    }).click();
    await page.getByText("Portable links", { exact: true }).waitFor({
      state: "detached",
    });
    expect(
      (await page.getByText("Portable links", { exact: true }).count()) === 0,
      "Applying the reviewed conversion should clear the portable-link action.",
    );
    await page.getByText("Knowledge changes", { exact: true }).waitFor();
    expect(
      await page.getByText(
        "0 added, 1 updated, 0 removed",
        { exact: true },
      ).isVisible() &&
        await page.getByText(
          "0 introduced, 1 resolved",
          { exact: true },
        ).isVisible() &&
        await page.getByText("Log candidate", { exact: true }).isVisible() &&
        await page.getByText(
          "Updated [source](notes/source.md)",
          { exact: false },
        ).isVisible(),
      "A reviewed document edit should produce a deterministic log candidate.",
    );
    await page.getByRole("button", { name: "Create log", exact: true }).click();
    await page.getByText("No knowledge changes", { exact: true }).waitFor();
    expect(
      await page.getByText("No knowledge changes", { exact: true }).isVisible(),
      "Materializing the log should advance the baseline only after the explicit action.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);
    await page.getByRole("button", {
      name: "Clear local workspace…",
      exact: true,
    }).click();
    await page.getByRole("button", {
      name: "Clear workspace",
      exact: true,
    }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    await page.getByRole("button", {
      name: "New document",
      exact: true,
    }).last().click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await page.getByRole("textbox").fill("# Plain Markdown");
    await openProjectMenu(page);
    const directDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {
      name: "Export workspace (.zip)",
      exact: true,
    }).click();
    const directDownload = await directDownloadPromise;
    expect(
      directDownload.suggestedFilename() === "Project.zip" &&
        (await page.getByRole("dialog", {
          name: "Review workspace export",
        }).count()) === 0,
      "Plain Markdown should keep the direct ZIP export path.",
    );
  });
}
