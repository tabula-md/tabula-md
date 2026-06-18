export const id = "collaboration";
export const description = "Local collaboration room synchronization smoke.";

export async function run(ctx) {
  const {
    appNewFileShortcut,
    baseUrl,
    browser,
    expect,
    externalUrl,
    focusMarkdownEditor,
    getTabs,
    getViewModeActionLabels,
    getViewModeSlots,
    openProjectContext,
    closeProjectContext,
    openProjectMenu,
    waitForText,
    withPage,
  } = ctx;

  if (!externalUrl) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const firstPage = await context.newPage();
    const secondPage = await context.newPage();

    try {
      await firstPage.goto(baseUrl);
      await firstPage.waitForSelector(".tabbar");
      await firstPage.locator(".share-trigger").click();
      await firstPage.getByRole("button", { name: "Start session" }).click();
      await firstPage.waitForURL(/\/r\/.+#key=/, { timeout: 5_000 });
      await firstPage.waitForSelector(".tab-item.live.active");
      await firstPage.getByRole("button", { name: "Close share dialog" }).click();

      const sharedPath = new URL(firstPage.url()).pathname + new URL(firstPage.url()).hash;
      await secondPage.goto(`${baseUrl}${sharedPath}`);
      await secondPage.waitForSelector(".tab-item.live.active");
      await secondPage.getByRole("button", { name: "Edit" }).click();

      await firstPage.getByRole("button", { name: "Edit" }).click();
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.type("Room sync check");

      await waitForText(secondPage.locator(".cm-content"), "Room sync check");
      await firstPage.keyboard.press("Shift+Home");
      await waitForText(firstPage.locator(".status-selection"), "3 words selected");
      await firstPage.getByRole("button", { name: "Bold", exact: true }).click();
      await waitForText(secondPage.locator(".cm-content"), "**Room sync check**");
      const liveFormattingState = await firstPage.evaluate(() => ({
        selectedWords: document.querySelector(".status-selection")?.textContent?.trim() ?? "",
        editorFocused: Boolean(document.querySelector(".markdown-editor")?.contains(document.activeElement)),
      }));
      const remotePresenceState = await secondPage.evaluate(() => ({
        editorText: document.querySelector(".cm-content")?.textContent ?? "",
      }));
      expect(
        liveFormattingState.selectedWords === "3 words selected",
        "Live formatting commands should keep selection presence state current after dispatch.",
      );
      expect(liveFormattingState.editorFocused, "Live formatting commands should keep focus in the editor.");
      expect(
        remotePresenceState.editorText.includes("**Room sync check**"),
        "Remote live page should receive Markdown formatting command text.",
      );
    } finally {
      await context.close();
    }
  }
}
