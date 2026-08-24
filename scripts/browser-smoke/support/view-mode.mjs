const requestedModes = {
  Edit: { viewMode: "edit" },
  Preview: { viewMode: "preview" },
  Read: { viewMode: "preview" },
  Source: { viewMode: "edit" },
  Split: { sourcePreview: true, viewMode: "split" },
  Visual: { viewMode: "visual" },
  Write: { viewMode: "visual" },
};

const getActiveViewMode = (page) =>
  page.locator(".tab-item.active").getAttribute("data-view-mode");

export const selectDocumentViewMode = async (page, label) => {
  const requested = requestedModes[label] ?? {
    label,
    viewMode: label.toLowerCase(),
  };

  if ((await getActiveViewMode(page)) === requested.viewMode) {
    return;
  }

  const button = page.locator(
    `.document-view-mode-control [data-view-mode="${requested.viewMode}"]`,
  );

  if (requested.sourcePreview) {
    await page.locator('.document-view-mode-control [data-view-mode="edit"]').click();
    await page.locator(".document-options-button").click();
    await page.locator('.document-controls-popover [data-view-mode="split"]').click();
    return;
  }

  await button.click();
};

export const getViewModeActionLabels = (page) =>
  page.$$eval(
    ".document-view-mode-control [data-view-mode]",
    (buttons) =>
      buttons.map(
        (button) =>
          button.getAttribute("aria-label") ??
          button.getAttribute("title") ??
          "",
      ),
  );

export const getViewModeSlots = (page) =>
  page.$$eval(
    ".document-view-mode-control [data-view-mode]",
    (items) =>
      items.map((item) => ({
        viewMode: item.getAttribute("data-view-mode") ?? "",
        label: item.getAttribute("aria-label") ?? "",
        active: item.getAttribute("aria-pressed") === "true",
      })),
  );
