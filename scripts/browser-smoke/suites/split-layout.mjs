import { selectDocumentViewMode } from "../support/view-mode.mjs";
export const id = "split-layout";
export const description = "Split mode pane geometry, responsive document rails, and mode alignment.";

export async function run(ctx) {
  const {
    browser,
    expect,
    openMarkdownFile,
    ensureSidePanelOpen,
    waitForEditorReady,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await openMarkdownFile(page);
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    const readLeftPanelModeLayout = () => {
      const workspace = document.querySelector(".workspace");
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          x: Math.round(rect.x),
          width: Math.round(rect.width),
          display: style.display,
        };
      };
      const readContentRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          width: Math.round(rect.width),
        };
      };

      return {
        scrollbarGutter:
          workspace instanceof HTMLElement
            ? Math.max(0, workspace.offsetWidth - workspace.clientWidth)
            : 0,
        workspaceClass: document.querySelector(".workspace")?.className ?? "",
        body:
          readRect(".workspace.split") ??
          readRect(".workspace.edit .editor-surface") ??
          readRect(".workspace.preview .preview-surface"),
        editor: readRect(".workspace.split .editor-surface") ?? readRect(".workspace.edit .editor-surface"),
        preview: readRect(".workspace.split .preview-surface") ?? readRect(".workspace.preview .preview-surface"),
        editorContent: readContentRect(".workspace.split .cm-content"),
        previewContent: readContentRect(".workspace.split .preview-surface p"),
        rail: readRect(".document-toolbar-row"),
        status: readRect(".file-status-bar"),
      };
    };

    const leftWriteLayout = await page.evaluate(readLeftPanelModeLayout);
    await selectDocumentViewMode(page, "Split");
    await waitForEditorReady(page, { mode: "split" });
    const leftSplitLayout = await page.evaluate(readLeftPanelModeLayout);

    for (const [name, layout] of Object.entries({ leftWriteLayout, leftSplitLayout })) {
      expect(layout.body && layout.rail && layout.status, `${name} should expose document body chrome.`);
      const bodyCenter = layout.body.x + layout.body.width / 2;
      const railCenter = layout.rail.x + layout.rail.width / 2;
      const bodyCenterTolerance = Math.ceil(layout.scrollbarGutter / 2) + 1;
      const bodyWidthTolerance = layout.scrollbarGutter + 1;
      expect(
        Math.abs(bodyCenter - railCenter) <= bodyCenterTolerance &&
          Math.abs(layout.body.width - layout.rail.width) <= bodyWidthTolerance &&
          Math.abs(layout.status.x - layout.rail.x) <= 1 &&
          Math.abs(layout.status.width - layout.rail.width) <= 1,
        `${name} rail and status should align to the document lane ` +
          `(body ${layout.body.x}/${layout.body.width}, rail ${layout.rail.x}/${layout.rail.width}, ` +
          `status ${layout.status.x}/${layout.status.width}, scrollbar gutter ${layout.scrollbarGutter}).`,
      );
    }
    const modeSwitchGutter = Math.max(
      leftWriteLayout.scrollbarGutter,
      leftSplitLayout.scrollbarGutter,
    );
    const leftWriteCenter = leftWriteLayout.body.x + leftWriteLayout.body.width / 2;
    const leftSplitCenter = leftSplitLayout.body.x + leftSplitLayout.body.width / 2;
    expect(
      leftSplitLayout.workspaceClass.includes("split") &&
        leftSplitLayout.body.display === "grid" &&
        Math.abs(leftSplitCenter - leftWriteCenter) <= Math.ceil(modeSwitchGutter / 2) + 1 &&
        Math.abs(leftSplitLayout.body.width - leftWriteLayout.body.width) <= modeSwitchGutter + 1,
      "Opening the workspace menu should not move or stack the document when switching Edit to Split " +
        `(edit ${leftWriteLayout.body.x}/${leftWriteLayout.body.width}, ` +
        `split ${leftSplitLayout.body.x}/${leftSplitLayout.body.width}, ` +
        `scrollbar gutter ${modeSwitchGutter}).`,
    );
    expect(
      leftSplitLayout.editor &&
        leftSplitLayout.preview &&
        leftSplitLayout.editor.width > leftSplitLayout.preview.width &&
        Math.abs(leftSplitLayout.editor.width + leftSplitLayout.preview.width - leftWriteLayout.body.width) <=
          modeSwitchGutter + 1,
      "Split should keep one document lane while giving the editor pane rail-aware width.",
    );
    expect(
      leftSplitLayout.editorContent &&
        leftSplitLayout.previewContent &&
        Math.abs(leftSplitLayout.editorContent.width - leftSplitLayout.previewContent.width) <= 24,
      `Split should balance the editable text column with the rendered preview content column (${leftSplitLayout.editorContent?.width ?? "missing"}px editor vs ${leftSplitLayout.previewContent?.width ?? "missing"}px preview).`,
    );

    await page.setViewportSize({ width: 1050, height: 800 });
    await ensureSidePanelOpen(page);
    const splitWithProjectContext = await page.evaluate(() => {
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      const mainPanel = document.querySelector(".main-panel");
      const rightPanel = document.querySelector(".right-panel");
      const backdrop = document.querySelector(".right-panel-backdrop");
      const workspace = document.querySelector(".workspace.split");
      return {
        mainClass: mainPanel?.className ?? "",
        mainColumns: mainPanel ? window.getComputedStyle(mainPanel).gridTemplateColumns : "",
        panelPosition: rightPanel ? window.getComputedStyle(rightPanel).position : "",
        backdropDisplay: backdrop ? window.getComputedStyle(backdrop).display : "",
        workspaceDisplay: workspace ? window.getComputedStyle(workspace).display : "",
        editor: readRect(".workspace.split .editor-surface"),
        preview: readRect(".workspace.split .preview-surface"),
      };
    });
    expect(
      splitWithProjectContext.mainClass.includes("split-view-open") &&
        splitWithProjectContext.mainColumns.split(" ").length === 1,
      "At compact desktop widths, Project Context should overlay Split instead of shrinking its document lane.",
    );
    expect(
      splitWithProjectContext.panelPosition === "fixed" && splitWithProjectContext.backdropDisplay === "block",
      "Compact Split should use the shared overlay panel behavior.",
    );
    expect(
      splitWithProjectContext.workspaceDisplay === "grid" &&
        splitWithProjectContext.editor?.height > 300 &&
        splitWithProjectContext.preview?.height > 300,
      "Opening Project Context should keep editor and preview visible side by side.",
    );
  });
}
