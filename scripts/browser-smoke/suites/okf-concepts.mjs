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

export async function run(ctx) {
  const {
    browser,
    ensureSidePanelOpen,
    expect,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForLeftPanel,
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

    if ((await page.locator(".left-panel").count()) === 0) {
      await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    }
    await waitForLeftPanel(page, "Workspace panel");
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
    const runtimeKnowledgeStatus = page.locator(
      '.workspace-file-tree-row[data-file-name="runtime.md"] '
      + ".workspace-file-knowledge-status",
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
    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Metadata", exact: true }).click();
    await page.locator(".right-panel-properties").waitFor({ state: "visible" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    const documentKnowledgeContext = page.locator(".right-properties-context");
    await documentKnowledgeContext.waitFor({ state: "visible" });
    expect(
      await documentKnowledgeContext.getByText(
          "How application services fit together at runtime.",
          { exact: true },
        ).isVisible() &&
        (await documentKnowledgeContext.getByText(
          "Needs attention",
          { exact: true },
        ).count()) === 0,
      "Properties should show the active document metadata and stay quiet when it has no actionable issue.",
    );
    for (const label of [
      "Metadata",
      "Lifecycle",
      "Stable",
      "Trust",
      "Unverified",
      "Freshness",
      "Unscheduled",
      "Architecture",
      "runtime, platform",
      "review_policy",
      "quarterly-platform-review",
    ]) {
      expect(
        await documentKnowledgeContext.getByText(label, { exact: true }).isVisible(),
        `Properties should expose ${label} as a named document field.`,
      );
    }
    expect(
      (await documentKnowledgeContext.getByRole("link", {
        name: /Open source/,
      }).getAttribute("href")) ===
          "https://github.com/acme/example/tree/main/src",
      "The active document context should keep its canonical source actionable.",
    );
    expect(
      (await page.getByText("OKF 0.1 · 3 concepts", { exact: true }).count()) === 0 &&
        (await page.locator(".workspace-issues-button").count()) === 0 &&
        (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0 &&
        (await page.locator(".right-graph-panel").count()) === 0,
      "Document Properties should not contain a workspace summary or workspace workflow.",
    );

    await page.locator('.workspace-search-trigger[aria-label="Search"]').click();
    await page.getByRole("dialog", { name: "Workspace search", exact: true }).waitFor({
      state: "visible",
    });
    const conceptSearch = page.getByRole("combobox", {
      name: "Search documents or type > for commands",
      exact: true,
    });
    expect(
      (await page.getByRole("heading", { name: "Explore", exact: true }).count()) === 1 &&
        (await page.getByRole("option", { name: "Type: Architecture", exact: true }).count()) === 1,
      "The launcher should expose metadata facets as wiki navigation before a query is entered.",
    );
    await page.getByRole("option", { name: "Type: Architecture", exact: true }).click();
    expect(
      await conceptSearch.inputValue() === "type:Architecture",
      "Choosing a metadata facet should turn it into an inspectable structured query.",
    );
    await conceptSearch.fill("dispatches work");
    const runtimeSearchResult = page.locator(".command-palette-result").filter({
      hasText: "architecture/runtime",
    });
    await runtimeSearchResult.waitFor({ state: "visible", timeout: 5_000 });
    expect(
      await runtimeSearchResult.isVisible() &&
        (await page.locator(".command-palette-result").count()) === 1,
      "The unified launcher should retrieve concept body text without opening another search surface.",
    );
    await conceptSearch.fill("type:architecture runtime");
    expect(
      await runtimeSearchResult.isVisible() &&
        (await page.locator(".command-palette-result").count()) === 1 &&
        (await page.getByRole("button", { name: "Filters", exact: true }).count()) === 0,
      "Structured metadata clauses should narrow the same document search surface.",
    );
    await page.keyboard.press("Escape");

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
        await exportReview.getByText("Handoff log", { exact: true }).isVisible() &&
        (await exportReview.getByRole("button", {
          name: "Review issues",
          exact: true,
        }).count()) === 0 &&
        (await page.locator(".workspace-issues-button").count()) === 0 &&
        (await page.getByRole("dialog", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0,
      "Knowledge workspace export should own the handoff summary without opening a global issue dashboard.",
    );
    const reviewedDownloadPromise = page.waitForEvent("download");
    await exportReview.getByRole("button", {
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
    if ((await page.locator(".left-panel").count()) === 0) {
      await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    }
    await waitForLeftPanel(page, "Workspace panel");
    const sourceKnowledgeStatus = page.locator(
      '.workspace-file-tree-row[data-file-name="source.md"] '
      + ".workspace-file-knowledge-status",
    );
    expect(
      (await sourceKnowledgeStatus.count()) === 1 &&
        (await sourceKnowledgeStatus.getAttribute("data-knowledge-priority")) ===
          "attention",
      "Files should use an attention dot only when a document has a concrete maintenance action.",
    );
    expect(
      (await sourceKnowledgeStatus.getAttribute("aria-label"))?.includes(
        "Review due since 2020-01-01",
      ),
      "The file dot should expose the concrete issue to assistive technology.",
    );
    await sourceKnowledgeStatus.click();
    await page.locator(".right-panel-properties").waitFor({ state: "visible" });
    const sourceProperties = page.locator(".right-properties-context");
    expect(
      await sourceProperties.getByRole("heading", {
        name: "Metadata",
        exact: true,
      }).isVisible() &&
        await sourceProperties.getByText("Needs attention", { exact: true }).isVisible(),
      "A file attention dot should open that document's Properties rather than a workspace queue.",
    );
    expect(
      (await page.locator(".workspace-issues-button").count()) === 0 &&
        (await page.getByRole("dialog", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0,
      "Document maintenance should remain in Files and Properties without a global issue dashboard.",
    );
    await openProjectMenu(page);
    await page.getByRole("button", {
      name: "Export workspace (.zip)",
      exact: true,
    }).click();
    const boundaryReview = page.getByRole("dialog", {
      name: "Review workspace export",
    });
    await boundaryReview.waitFor();
    expect(
      await boundaryReview.getByText("Compatibility", { exact: true }).isVisible() &&
        await boundaryReview.getByText("Knowledge health", { exact: true }).isVisible() &&
        await boundaryReview.getByText("Handoff log", { exact: true }).isVisible() &&
        (await boundaryReview.getByRole("button", {
          name: "Review issues",
          exact: true,
        }).count()) === 0,
      "Workspace-wide checks should appear only as a concise export-boundary summary.",
    );
    await boundaryReview.getByRole("button", {
      name: "Cancel",
      exact: true,
    }).click();
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
