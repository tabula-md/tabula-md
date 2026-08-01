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
    await waitForActiveTab(page, { exact: "index.md" });
    const importToast = page.locator(".app-toast");
    await importToast.waitFor();
    expect(
      (await importToast.textContent())?.includes("Folder imported.") &&
        (await page.getByRole("dialog").count()) === 0,
      "A first folder import should open the root index immediately without an import report.",
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
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await page.locator(".right-panel-properties").waitFor({ state: "visible" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    const documentKnowledgeContext = page.getByRole("region", {
      name: "Properties",
    });
    await documentKnowledgeContext.getByRole("heading", {
      name: "Metadata",
      exact: true,
    }).waitFor();
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
    await page.getByRole("dialog", { name: "Search", exact: true }).waitFor({ state: "visible" });
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
    const replacementDialog = page.getByRole("dialog", {
      name: "Replace workspace?",
    });
    await replacementDialog.waitFor();
    expect(
      (await replacementDialog.getByText("OKF 0.2", { exact: true }).count()) === 0 &&
        (await replacementDialog.getByText("source.md", { exact: true }).count()) === 0,
      "Replacing an existing workspace should not require reviewing format or file inventories.",
    );
    await replacementDialog.getByRole("button", {
      name: "Import folder",
      exact: true,
    }).click();
    const migrationToast = page.locator(".app-toast");
    await migrationToast.waitFor();
    expect(
      (await migrationToast.textContent())?.includes("Folder imported.") &&
        (await migrationToast.getByRole("button", {
          name: "Import details",
          exact: true,
        }).count()) === 0,
      "A replacement import should finish with a concise notification and no report action.",
    );
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
      name: "Open Properties",
      exact: true,
    }).click();
    await page.locator(".right-panel-properties").waitFor({ state: "visible" });
    const sourceProperties = page.getByRole("region", {
      name: "Properties",
      exact: true,
    });
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
