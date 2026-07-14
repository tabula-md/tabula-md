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
    const panel = document.querySelector(".right-panel");
    const panelBody = document.querySelector(".right-panel-body.search");
    const row = document.querySelector(".document-search-row");
    const bar = document.querySelector(".document-search-bar");
    if (
      !(panel instanceof HTMLElement) ||
      !(panelBody instanceof HTMLElement) ||
      !(row instanceof HTMLElement) ||
      !(bar instanceof HTMLElement)
    ) {
      return null;
    }

    const panelRect = panel.getBoundingClientRect();
    const panelBodyRect = panelBody.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
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
      panelLeft: Math.round(panelRect.left),
      panelRight: Math.round(panelRect.right),
      panelBodyLeft: Math.round(panelBodyRect.left),
      panelBodyRight: Math.round(panelBodyRect.right),
      panelBodyWidth: Math.round(panelBodyRect.width),
      rowPosition: rowStyle.position,
      rowBorderTop: rowStyle.borderTopWidth,
      rowBorderBottom: rowStyle.borderBottomWidth,
      documentControlsSeparators: document.querySelectorAll(".document-controls > .toolbar-separator").length,
    };
  });
