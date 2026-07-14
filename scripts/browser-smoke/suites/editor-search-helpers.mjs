export const readEditorText = async (page) =>
  (await page.evaluate(() => {
    const content = document.querySelector(".cm-content");
    const view = content?.cmView?.view ?? content?.cmTile?.view;
    const docText = view?.state?.doc?.toString?.();
    return typeof docText === "string" ? docText : null;
  })) ??
  (await page.$$eval(".cm-line", (lines) =>
    lines
      .map((line) => {
        const clone = line.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
          return line.textContent ?? "";
        }
        clone.querySelectorAll(".cm-placeholder, .cm-widgetBuffer").forEach((element) => element.remove());
        return clone.textContent ?? "";
      })
      .join("\n"),
  ));

export const readSearchRowLayout = (page) =>
  page.evaluate(() => {
    const row = document.querySelector(".document-search-row");
    const bar = document.querySelector(".document-search-bar");
    const toolbar = document.querySelector(".document-toolbar-row");
    if (!(row instanceof HTMLElement) || !(bar instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) {
      return null;
    }

    const rowRect = row.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    return {
      rowLeft: Math.round(rowRect.left),
      rowRight: Math.round(rowRect.right),
      rowTop: Math.round(rowRect.top),
      rowBottom: Math.round(rowRect.bottom),
      rowWidth: Math.round(rowRect.width),
      barLeft: Math.round(barRect.left),
      barRight: Math.round(barRect.right),
      barWidth: Math.round(barRect.width),
      toolbarLeft: Math.round(toolbarRect.left),
      toolbarRight: Math.round(toolbarRect.right),
      rightPanelOpen: Boolean(document.querySelector(".right-panel")),
      workspaceSearchOpen: Boolean(document.querySelector(".right-panel-body.search")),
      rowPosition: rowStyle.position,
      rowBorderTop: rowStyle.borderTopWidth,
      rowBorderBottom: rowStyle.borderBottomWidth,
      documentControlsSeparators: document.querySelectorAll(".document-controls > .toolbar-separator").length,
    };
  });
