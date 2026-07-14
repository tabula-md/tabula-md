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
    const controls = document.querySelector(".document-toolbar-row");
    const row = document.querySelector(".document-search-row");
    const bar = document.querySelector(".document-search-bar");
    const workspace = document.querySelector(".workspace");
    if (
      !(controls instanceof HTMLElement) ||
      !(row instanceof HTMLElement) ||
      !(bar instanceof HTMLElement) ||
      !(workspace instanceof HTMLElement)
    ) {
      return null;
    }

    const controlsRect = controls.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
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
      controlsLeft: Math.round(controlsRect.left),
      controlsRight: Math.round(controlsRect.right),
      controlsBottom: Math.round(controlsRect.bottom),
      controlsWidth: Math.round(controlsRect.width),
      workspaceTop: Math.round(workspaceRect.top),
      rowPosition: rowStyle.position,
      rowBorderTop: rowStyle.borderTopWidth,
      rowBorderBottom: rowStyle.borderBottomWidth,
      documentControlsSeparators: document.querySelectorAll(".document-controls > .toolbar-separator").length,
    };
  });
