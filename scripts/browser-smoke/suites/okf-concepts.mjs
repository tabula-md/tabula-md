import { selectDocumentViewMode } from "../support/view-mode.mjs";
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
    name: "Workspace issues",
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
  const fixtureEntries = [
    ...await readFixtureEntries(fixtureRoot),
    { path: "scratch.tmp", content: "preserved in the browser copy" },
    {
      path: "diagram.png",
      content:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA"
        + "DUlEQVR42mNk+M/wHwAF/gL+AvzZAAAAAElFTkSuQmCC",
      encoding: "base64",
    },
  ];

  await withPage(browser, "/", async (page) => {
    await page.locator('input[aria-label="Import folder"]').evaluate(
      (input, entries) => {
        const dataTransfer = new DataTransfer();
        for (const entry of entries) {
          const name = entry.path.split("/").at(-1);
          const content = entry.encoding === "base64"
            ? Uint8Array.from(atob(entry.content), (character) =>
                character.charCodeAt(0))
            : entry.content;
          const file = new File(
            [content],
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
    await page.getByRole("dialog", { name: "Import folder" }).waitFor();
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
    await page.getByRole("button", { name: "Import and replace", exact: true }).click();
    const importToast = page.locator(".app-toast");
    await importToast.waitFor();
    expect(
      /3 OKF concepts imported(?: · \d+ issues)?/.test(await importToast.textContent()) &&
        (await page.getByRole("dialog", {
          name: "OKF workspace imported",
        }).count()) === 0,
      "An OKF import should open the workspace immediately and summarize the result without a blocking step.",
    );
    await importToast.getByRole("button", {
      name: "Import details",
      exact: true,
    }).click();
    const importResult = page.getByRole("dialog", {
      name: "OKF workspace imported",
    });
    await importResult.waitFor();
    const resultValue = async (label) =>
      importResult.getByText(label, { exact: true }).locator("..").locator("dd")
        .textContent();
    expect(
      (await resultValue("Detected format")) === "OKF 0.1" &&
        (await resultValue("Concepts")) === "3" &&
        (await resultValue("Directory indexes")) === "2" &&
        (await resultValue("Activity log")) === "Present" &&
        (await resultValue("Bundle assets preserved")) === "3" &&
        /^\d+$/.test((await resultValue("Required compatibility fixes")) ?? "") &&
        /^\d+$/.test((await resultValue("Knowledge health attention")) ?? ""),
      "OKF import orientation should summarize the detected structure and existing review models.",
    );
    expect(
      await importResult.getByText(
        "This workspace declares OKF 0.1. OKF 0.2 metadata and lifecycle practices may require compatibility changes.",
        { exact: true },
      ).isVisible() &&
        (await importResult.getByRole("button", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0,
      "Optional import details may explain the detected version without prescribing a workspace review step.",
    );
    await importResult.getByRole("button", {
      name: "Import details",
      exact: true,
    }).click();
    expect(
      await importResult.getByText(".last-update.json", {
        exact: true,
      }).isVisible() &&
        await importResult.getByText("scratch.tmp", {
          exact: true,
        }).isVisible() &&
        await importResult.getByText("diagram.png", {
          exact: true,
        }).isVisible(),
      "Import details should retain every non-Markdown bundle asset after replacement.",
    );
    await importResult.getByRole("button", {
      name: "Open root index",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "index.md" });
    expect(
      (await page.getByRole("dialog", {
        name: "OKF workspace imported",
      }).count()) === 0,
      "Opening the root index should dismiss the one-time import orientation.",
    );

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await waitForPanelTab(page, "Files");
    expect(
      (await page.getByRole("button", {
        name: "Open .last-update.json",
        exact: true,
      }).count()) === 1 &&
        (await page.getByRole("button", {
          name: "Open scratch.tmp",
          exact: true,
        }).count()) === 1 &&
        (await page.getByRole("button", {
          name: "Open diagram.png",
          exact: true,
        }).count()) === 1,
      "All bundle assets should survive folder import without becoming knowledge documents.",
    );
    await page.getByRole("button", {
      name: "Open scratch.tmp",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "scratch.tmp" });
    const textAssetViewer = page.getByRole("region", {
      name: "scratch.tmp file",
    });
    expect(
      await textAssetViewer.getByText(
        "preserved in the browser copy",
        { exact: true },
      ).isVisible() &&
        await page.getByRole("button", {
          name: "Copy contents",
          exact: true,
        }).isVisible() &&
        await page.getByRole("button", {
          name: "Download",
          exact: true,
        }).isVisible() &&
        (await page.locator(".workspace-asset-header").count()) === 0 &&
        (await page.locator(".workspace-asset-footer").count()) === 0 &&
        (await page.locator(".cm-content").count()) === 0,
      "Text assets should reuse quiet document chrome without becoming Markdown editors.",
    );
    await page.getByRole("button", {
      name: "Open diagram.png",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "diagram.png" });
    const imageAssetViewer = page.getByRole("region", {
      name: "diagram.png file",
    });
    const imageLocator = imageAssetViewer.getByRole("img", {
      name: "diagram.png preview",
    });
    const imageState = await imageLocator.evaluate((image) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));
    expect(
      imageState.complete &&
        imageState.naturalWidth > 0 &&
        imageState.naturalHeight > 0 &&
        await page.getByRole("button", {
          name: "Download",
          exact: true,
        }).isVisible(),
      `Safe raster assets should open as images instead of encoded text. `
        + `imageState=${JSON.stringify(imageState)}`,
    );
    await page.getByRole("button", {
      name: "Knowledge attention legend",
      exact: true,
    }).click();
    const attentionLegend = page.locator(".right-file-knowledge-legend");
    expect(
      await attentionLegend.getByText(
        "Dot: Tabula found an error or maintenance action for this document.",
        { exact: true },
      ).isVisible() &&
        await attentionLegend.getByText(
          "No dot: no attention was found, or the file is not an OKF concept.",
          { exact: true },
        ).isVisible(),
      "Files should explain both the presence and absence of a knowledge attention dot.",
    );
    await page.keyboard.press("Escape");
    const runtimeKnowledgeStatus = page.locator(
      '.right-file-tree-row[data-file-name="runtime.md"] '
      + ".right-file-knowledge-status",
    );
    expect(
      (await runtimeKnowledgeStatus.count()) === 0,
      "Files should not turn an ordinary draft, unverified document, or missing review date into an issue by itself.",
    );
    await page.getByRole("button", {
      name: "Open runtime.md",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "runtime.md" });
    await page.getByRole("button", { name: "Knowledge", exact: true }).click();
    await waitForPanelTab(page, "Knowledge");
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    const sidePanelNavigation = page.getByRole("navigation", {
      name: "Side panel sections",
    });
    const documentKnowledgeContext = page.getByRole("region", {
      name: "Knowledge context",
    });
    await documentKnowledgeContext.getByRole("heading", {
      name: "Runtime architecture",
      exact: true,
    }).waitFor();
    expect(
      await documentKnowledgeContext.getByRole("heading", {
        name: "Runtime architecture",
        exact: true,
      }).isVisible() &&
        !(await documentKnowledgeContext.getByText(
          "How application services fit together at runtime.",
          { exact: true },
        ).isVisible()) &&
        (await documentKnowledgeContext.getByText(
          "Needs attention",
          { exact: true },
        ).count()) === 0,
      "Knowledge should lead with the active document and stay quiet when it has no actionable issue.",
    );
    const knowledgePassport = documentKnowledgeContext.getByRole("region", {
      name: "Knowledge passport",
    });
    expect(
      await knowledgePassport.getByText("Lifecycle", { exact: true }).isVisible() &&
        await knowledgePassport.getByText("Stable", { exact: true }).isVisible() &&
        await knowledgePassport.getByText("Trust", { exact: true }).isVisible() &&
        await knowledgePassport.getByText("Unverified", { exact: true }).isVisible() &&
        await knowledgePassport.getByText("Freshness", { exact: true }).isVisible() &&
        await knowledgePassport.getByText("Unscheduled", { exact: true }).isVisible(),
      "Knowledge should keep lifecycle, trust, and freshness as independent document axes.",
    );
    await documentKnowledgeContext.locator(
      ".right-knowledge-context-details > summary",
    ).click();
    expect(
      await documentKnowledgeContext.getByText(
        "How application services fit together at runtime.",
        { exact: true },
      ).isVisible() &&
        await documentKnowledgeContext.getByText("Architecture", { exact: true }).isVisible() &&
        await documentKnowledgeContext.getByText("runtime, platform", { exact: true }).isVisible() &&
        await documentKnowledgeContext.getByText(
          "Additional metadata",
          { exact: true },
        ).isVisible() &&
        await documentKnowledgeContext.getByText(
          "review_policy",
          { exact: true },
        ).isVisible() &&
        await documentKnowledgeContext.getByText(
          "quarterly-platform-review",
          { exact: true },
        ).isVisible(),
      "Knowledge should keep descriptive and provenance metadata available in optional details.",
    );
    expect(
      (await documentKnowledgeContext.getByRole("link", {
        name: /Open source/,
      }).getAttribute("href")) ===
          "https://github.com/acme/example/tree/main/src",
      "The active document context should keep its canonical source actionable.",
    );
    const workspaceKnowledge = page.getByRole("region", {
      name: "Workspace knowledge",
    });
    expect(
      await workspaceKnowledge.getByText(
        "OKF 0.1 · 3 concepts",
        { exact: true },
      ).isVisible() &&
        await workspaceKnowledge.getByText(
          "No workspace issues",
          { exact: true },
        ).isVisible() &&
        (await workspaceKnowledge.getByRole("button", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0 &&
        (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0 &&
        (await page.locator(".right-graph-panel").count()) === 0,
      "Knowledge should report workspace issue facts without prescribing a review workflow.",
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
    const runtimeSearchResult = page.getByRole("button", {
      name: "architecture/runtime",
      exact: true,
    });
    await runtimeSearchResult.waitFor({ state: "visible", timeout: 5_000 });
    expect(
      await runtimeSearchResult.isVisible() &&
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
      name: "Workspace issues",
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
    await page.getByRole("button", { name: "Close workspace issues", exact: true }).click();
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
    await page.locator('input[aria-label="Import folder"]').evaluate(
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
    await page.getByRole("dialog", { name: "Import folder" }).waitFor();
    await page.getByRole("button", { name: "Import and replace", exact: true }).click();
    const migrationToast = page.locator(".app-toast");
    await migrationToast.waitFor();
    expect(
      /2 OKF concepts imported(?: · \d+ issues)?/.test(await migrationToast.textContent()) &&
        (await page.getByRole("dialog", {
          name: "OKF workspace imported",
        }).count()) === 0,
      "OKF 0.2 imports should also remain non-blocking.",
    );
    await migrationToast.getByRole("button", {
      name: "Import details",
      exact: true,
    }).click();
    const migrationImportResult = page.getByRole("dialog", {
      name: "OKF workspace imported",
    });
    await migrationImportResult.waitFor();
    expect(
      (await migrationImportResult.getByText(
        "This workspace declares OKF 0.1. OKF 0.2 metadata and lifecycle practices may require compatibility changes.",
        { exact: true },
      ).count()) === 0,
      "An OKF 0.2 import should not show 0.1 transition guidance.",
    );
    await migrationImportResult.getByRole("button", {
      name: "Open root index",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "index.md" });
    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await waitForPanelTab(page, "Files");
    const sourceKnowledgeStatus = page.locator(
      '.right-file-tree-row[data-file-name="source.md"] '
      + ".right-file-knowledge-status",
    );
    expect(
      (await sourceKnowledgeStatus.count()) === 1 &&
        (await sourceKnowledgeStatus.getAttribute("data-knowledge-priority")) ===
          "attention",
      "Files should use an attention dot only when a document has a concrete maintenance action.",
    );
    await sourceKnowledgeStatus.click();
    const sourceAttention = page.locator(".right-file-knowledge-popover");
    expect(
      await sourceAttention.getByText(
        "Review due since 2020-01-01",
        { exact: true },
      ).isVisible(),
      "The file dot should explain the concrete issue on demand.",
    );
    await sourceAttention.getByRole("button", {
      name: "View workspace issues",
      exact: true,
    }).click();
    await waitForPanelTab(page, "Knowledge");
    const workspaceIssues = page.getByRole("region", {
      name: "Workspace issues",
      exact: true,
    });
    expect(
      await workspaceIssues.getByText("source", { exact: true }).isVisible() &&
        (await workspaceIssues.getByRole("button", {
          name: "Next review document",
          exact: true,
        }).count()) === 0,
      "Workspace issues should be an on-demand issue list rather than a review-session wizard.",
    );
    await workspaceIssues.getByRole("button", {
      name: "Back to document",
      exact: true,
    }).click();
    await openExportPreflight(page, openProjectMenu);
    const exportIssues = page.getByRole("dialog", {
      name: "Workspace issues",
      exact: true,
    });
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
    const expectedHealthMessages = [
      "Refresh after 2020-01-01",
      "Deprecated concept still has 1 references",
      "Citation has no matching source: missing",
      "Relationship target does not exist: missing.md",
      "Source id is duplicated: policy",
      "Source resource is duplicated: https://example.com/policy",
    ];
    const missingHealthMessages = [];
    for (const message of expectedHealthMessages) {
      if ((await exportIssues.getByText(message, { exact: true }).count()) === 0) {
        missingHealthMessages.push(message);
      }
    }
    expect(
      await exportIssues.getByText("Knowledge health", { exact: true }).isVisible() &&
        missingHealthMessages.length === 0,
      `OKF compatibility should remain separate from read-only knowledge maintenance signals (missing: ${missingHealthMessages.join(", ")}).`,
    );
    await exportIssues.getByRole("button").filter({
      hasText: "Refresh after 2020-01-01",
    }).click();
    await selectDocumentViewMode(page, "Edit");
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
    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    await openExportPreflight(page, openProjectMenu);
    await exportIssues.getByRole("button").filter({
      hasText: "Relationship target does not exist: missing.md",
    }).click();
    await selectDocumentViewMode(page, "Edit");
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
