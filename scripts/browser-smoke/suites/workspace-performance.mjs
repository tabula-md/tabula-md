import { buildLargeEditorMarkdown } from "../support/editor-fixtures.mjs";
import { selectDocumentViewMode } from "../support/view-mode.mjs";

export const id = "workspace-performance";
export const description = "Workspace interaction and lazy-renderer performance budgets.";
export const scenarios = [
  "keeps first input and local persistence responsive",
  "keeps large-document navigation and workspace controls responsive",
  "loads math and diagram renderers on demand",
];

const FIRST_INPUT_MAX_MS = 600;
const LOCAL_PERSISTENCE_MAX_MS = 2_000;
const LARGE_VISUAL_ENTRY_MAX_MS = 6_000;
const LARGE_PREVIEW_ENTRY_MAX_MS = 7_000;
const LARGE_VISUAL_RETURN_MAX_MS = 3_000;
// CI includes the Node-to-browser round trip for each of the 40 key presses and
// has measurably higher variance than the local product budget.
const LONG_DOCUMENT_ARROW_MAX_MS = process.env.CI ? 5_000 : 2_500;
const LARGE_SEARCH_MAX_MS = 2_500;
const RIGHT_PANEL_OPEN_MAX_MS = 1_500;
const ASYNC_RENDERERS_MAX_MS = 10_000;

const measureElapsed = async (action) => {
  const startedAt = performance.now();
  await action();
  return performance.now() - startedAt;
};

const reportPerformanceMetric = (name, metrics) => {
  console.log(`[performance] ${name}: ${JSON.stringify(metrics)}`);
};

const waitForEditorDocumentText = async (page, text, timeout = 8_000) => {
  await page.waitForFunction(
    ({ text }) => {
      const content = document.querySelector(".cm-content");
      const view =
        content?.cmView?.view ??
        content?.cmTile?.view ??
        content?.parentElement?.cmView?.view ??
        content?.parentElement?.cmTile?.view ??
        document.querySelector(".cm-editor")?.cmView?.view;
      return typeof view?.state?.doc?.toString === "function"
        ? view.state.doc.toString().includes(text)
        : content?.textContent?.includes(text);
    },
    { text },
    { timeout },
  );
};

const importMarkdownFixture = async (page, markdown, name) => {
  await page.locator('input[aria-label="Open Markdown file"]').setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
};

const readAsyncRendererResources = (page) =>
  page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => !name.endsWith(".css") && /(?:katex|mermaid)/i.test(name)),
  );

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForPanelTab,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.getByRole("button", { name: "New document", exact: true }).click();
      await waitForEditorReady(page, { mode: "visual" });
      await page.waitForSelector(".top-chrome", { state: "visible" });
      await focusMarkdownEditor(page);
      await page.evaluate(() => {
        const originalPut = IDBObjectStore.prototype.put;
        window.__tabulaIndexedDbPerformanceProbe = {
          completedAt: null,
          startedAt: null,
          restore() {
            IDBObjectStore.prototype.put = originalPut;
            delete window.__tabulaIndexedDbPerformanceProbe;
          },
          start() {
            this.completedAt = null;
            this.startedAt = performance.now();
          },
        };
        IDBObjectStore.prototype.put = function put(...args) {
          const request = originalPut.apply(this, args);
          request.addEventListener("success", () => {
            const probe = window.__tabulaIndexedDbPerformanceProbe;
            if (probe?.startedAt !== null && probe?.completedAt === null) {
              probe.completedAt = performance.now();
            }
          }, { once: true });
          return request;
        };
      });
      await page.evaluate(() => window.__tabulaIndexedDbPerformanceProbe.start());

      const firstInputElapsed = await measureElapsed(async () => {
        await page.keyboard.insertText("first-input-probe");
        await waitForEditorDocumentText(page, "first-input-probe");
      });
      await page.waitForFunction(
        () => window.__tabulaIndexedDbPerformanceProbe?.completedAt !== null,
        {},
        { timeout: LOCAL_PERSISTENCE_MAX_MS },
      );
      const persistenceElapsed = await page.evaluate(() => {
        const probe = window.__tabulaIndexedDbPerformanceProbe;
        const elapsed = probe.completedAt - probe.startedAt;
        probe.restore();
        return elapsed;
      });

      reportPerformanceMetric("new-document-input-and-save", {
        firstInputElapsedMs: Math.round(firstInputElapsed),
        persistenceElapsedMs: Math.round(persistenceElapsed),
      });
      expect(
        firstInputElapsed < FIRST_INPUT_MAX_MS,
        `The first new-document input should render within budget. Elapsed: ${Math.round(firstInputElapsed)}ms.`,
      );
      expect(
        persistenceElapsed < LOCAL_PERSISTENCE_MAX_MS,
        `IndexedDB persistence should confirm the first input within budget. Elapsed: ${Math.round(persistenceElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      const markdown = buildLargeEditorMarkdown({
        sections: 500,
        paragraphRepeats: 1,
      });
      const visualEntryElapsed = await measureElapsed(async () => {
        await importMarkdownFixture(
          page,
          markdown,
          "workspace-interaction-performance.md",
        );
        await waitForEditorReady(page, { mode: "visual" });
      });

      const previewEntryElapsed = await measureElapsed(async () => {
        await selectDocumentViewMode(page, "Preview");
        await waitForEditorReady(page, { mode: "preview" });
      });
      const visualReturnElapsed = await measureElapsed(async () => {
        await selectDocumentViewMode(page, "Visual");
        await waitForEditorReady(page, { mode: "visual" });
      });

      await focusMarkdownEditor(page);
      await page.keyboard.press("ControlOrMeta+Home");
      const arrowNavigationElapsed = await measureElapsed(async () => {
        for (let index = 0; index < 40; index += 1) {
          await page.keyboard.press("ArrowDown");
        }
        await waitForRenderFrame(page);
      });

      await selectDocumentViewMode(page, "Source");
      await waitForEditorReady(page, { mode: "edit" });
      const searchElapsed = await measureElapsed(async () => {
        await page.keyboard.press("ControlOrMeta+F");
        await page.getByRole("searchbox", { name: "Search" }).fill(
          "Large Document Section 500",
        );
        await page.waitForSelector(".cm-search-match.active");
      });
      await page.getByRole("button", { name: "Close search" }).click();

      const panelOpenElapsed = await measureElapsed(async () => {
        await page.getByRole("button", {
          name: "Toggle side panel",
          exact: true,
        }).click();
        await waitForPanelTab(page, "Metadata");
      });

      reportPerformanceMetric("workspace-interactions", {
        arrowNavigationElapsedMs: Math.round(arrowNavigationElapsed),
        lineCount: markdown.split("\n").length,
        panelOpenElapsedMs: Math.round(panelOpenElapsed),
        previewEntryElapsedMs: Math.round(previewEntryElapsed),
        searchElapsedMs: Math.round(searchElapsed),
        visualEntryElapsedMs: Math.round(visualEntryElapsed),
        visualReturnElapsedMs: Math.round(visualReturnElapsed),
      });
      expect(
        visualEntryElapsed < LARGE_VISUAL_ENTRY_MAX_MS,
        `A 5,000-line document should enter Visual mode within budget. Elapsed: ${Math.round(visualEntryElapsed)}ms.`,
      );
      expect(
        previewEntryElapsed < LARGE_PREVIEW_ENTRY_MAX_MS,
        `A 5,000-line document should enter Preview within budget. Elapsed: ${Math.round(previewEntryElapsed)}ms.`,
      );
      expect(
        visualReturnElapsed < LARGE_VISUAL_RETURN_MAX_MS,
        `Returning to Visual mode should reuse existing document work. Elapsed: ${Math.round(visualReturnElapsed)}ms.`,
      );
      expect(
        arrowNavigationElapsed < LONG_DOCUMENT_ARROW_MAX_MS,
        `Long-document arrow navigation should stay within budget. Elapsed: ${Math.round(arrowNavigationElapsed)}ms.`,
      );
      expect(
        searchElapsed < LARGE_SEARCH_MAX_MS,
        `Long-document search should stay within budget. Elapsed: ${Math.round(searchElapsed)}ms.`,
      );
      expect(
        panelOpenElapsed < RIGHT_PANEL_OPEN_MAX_MS,
        `The Metadata panel should open within budget. Elapsed: ${Math.round(panelOpenElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.getByRole("button", { name: "New document", exact: true }).click();
      await selectDocumentViewMode(page, "Source");
      await waitForEditorReady(page, { mode: "edit" });
      const markdown = [
        "$$",
        "E = mc^2",
        "$$",
        "",
        "```mermaid",
        "graph TD",
        "  A --> B",
        "```",
      ].join("\n");
      await page.evaluate((value) => {
        const content = document.querySelector(".cm-content");
        const view =
          content?.cmView?.view ??
          content?.cmTile?.view ??
          content?.parentElement?.cmView?.view ??
          content?.parentElement?.cmTile?.view ??
          document.querySelector(".cm-editor")?.cmView?.view;
        if (!view) {
          throw new Error("CodeMirror view was not found.");
        }
        view.dispatch({
          changes: {
            from: 0,
            insert: value,
            to: view.state.doc.length,
          },
        });
      }, markdown);
      await waitForEditorDocumentText(page, "graph TD");
      await waitForRenderFrame(page);
      await page.evaluate(() => performance.clearResourceTimings());
      const resourcesBefore = await readAsyncRendererResources(page);

      const renderElapsed = await measureElapsed(async () => {
        await selectDocumentViewMode(page, "Preview");
        await waitForEditorReady(page, { mode: "preview" });
        await page.waitForSelector(".preview-math-rendered .katex", {
          timeout: ASYNC_RENDERERS_MAX_MS,
        });
        await page.waitForSelector(".preview-mermaid-svg svg", {
          timeout: ASYNC_RENDERERS_MAX_MS,
        });
      });
      const resourcesAfter = await readAsyncRendererResources(page);

      reportPerformanceMetric("lazy-async-renderers", {
        elapsedMs: Math.round(renderElapsed),
        resources: resourcesAfter.map((resource) => new URL(resource).pathname),
      });
      expect(
        resourcesBefore.length === 0,
        "KaTeX and Mermaid JavaScript should remain unloaded before rendered content needs them.",
      );
      expect(
        resourcesAfter.some((resource) => /katex/i.test(resource)),
        "Preview should load the KaTeX renderer on demand.",
      );
      expect(
        resourcesAfter.some((resource) => /mermaid/i.test(resource)),
        "Preview should load the Mermaid renderer on demand.",
      );
      expect(
        renderElapsed < ASYNC_RENDERERS_MAX_MS,
        `KaTeX and Mermaid should render within budget after lazy loading. Elapsed: ${Math.round(renderElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );
}
