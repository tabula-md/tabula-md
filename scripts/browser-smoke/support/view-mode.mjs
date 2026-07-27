const requestedModes = {
  Edit: { editingMode: "source", label: "Source edit", viewMode: "edit" },
  Preview: { label: "Preview", viewMode: "preview" },
  Source: { editingMode: "source", label: "Source edit", viewMode: "edit" },
  Split: { editingMode: "source", label: "Split", viewMode: "split" },
  Visual: { editingMode: "visual", label: "Visual edit", viewMode: "visual" },
};

const getActiveViewMode = (page) =>
  page.locator(".tab-item.active").getAttribute("data-view-mode");

const selectEditingMode = async (page, editingMode) => {
  await page.getByRole("button", { name: "Editor controls", exact: true }).click();
  await page
    .locator(".document-controls-popover")
    .locator(`[data-editing-mode="${editingMode}"]`)
    .click();
};

export const selectDocumentViewMode = async (page, label) => {
  const requested = requestedModes[label] ?? {
    label,
    viewMode: label.toLowerCase(),
  };

  if ((await getActiveViewMode(page)) === requested.viewMode) {
    return;
  }

  let button = page.locator(
    `.document-view-mode-control [data-view-mode="${requested.viewMode}"]`,
  );

  if ((await button.count()) === 0 && requested.editingMode) {
    await selectEditingMode(page, requested.editingMode);
    if ((await getActiveViewMode(page)) === requested.viewMode) {
      return;
    }
    button = page.locator(
      `.document-view-mode-control [data-view-mode="${requested.viewMode}"]`,
    );
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
