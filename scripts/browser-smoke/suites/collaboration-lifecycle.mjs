export const id = "collaboration-lifecycle";
export const requiresRoomService = true;
export const description = "Live room recovery after a real browser page freeze.";
export const hiddenFeature = true;
export const requiresNaturalBackgrounding = true;

export async function run(ctx) {
  const { baseUrl, browser, expect, focusMarkdownEditor, waitForEditorReady, waitForText } = ctx;
  const ensureEditMode = async (page) => {
    const editButton = page.getByRole("button", { name: "Edit", exact: true });
    if ((await editButton.count()) > 0) await editButton.click();
    await waitForEditorReady(page, { mode: "edit" });
  };
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const peerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hostPage = await hostContext.newPage();
  const peerPage = await peerContext.newPage();

  try {
    await hostPage.goto(baseUrl);
    await hostPage.waitForSelector(".tabbar");
    await hostPage.locator(".add-tab-button").click();
    await hostPage.locator('.tab-item[data-file-name="README.md"]').click();
    await ensureEditMode(hostPage);
    const activeFileName = await hostPage.locator(".tab-item.active").getAttribute("data-file-name");
    expect(Boolean(activeFileName), "Lifecycle smoke requires an active room document.");
    await hostPage.locator(".share-trigger").click();
    await hostPage.getByRole("button", { name: "Start session" }).click();
    await waitForText(hostPage.locator(".share-modal"), "Invite link");
    const shareUrl = await hostPage.locator(".share-link-display").getAttribute("title");
    expect(Boolean(shareUrl), "Lifecycle smoke requires a room invite link.");
    await hostPage.getByRole("button", { name: "Close share dialog" }).click();

    await peerPage.goto(shareUrl);
    await peerPage.waitForSelector('.tab-item.active[data-room-id]:not([data-room-id=""])');
    await peerPage.locator(`.tab-item[data-file-name="${activeFileName}"]`).click();
    await ensureEditMode(peerPage);
    const cdp = await peerContext.newCDPSession(peerPage);
    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });

    await hostPage.bringToFront();
    await focusMarkdownEditor(hostPage);
    await hostPage.keyboard.insertText("host edit while peer frozen");
    await hostPage.waitForTimeout(500);

    await cdp.send("Page.setWebLifecycleState", { state: "active" });
    await peerPage.bringToFront();
    await waitForText(peerPage.locator(".cm-content"), "host edit while peer frozen", 12_000);

    await focusMarkdownEditor(peerPage);
    await peerPage.keyboard.insertText(" peer resumed");
    await hostPage.bringToFront();
    await waitForText(hostPage.locator(".cm-content"), "peer resumed", 12_000);
  } finally {
    await hostContext.close();
    await peerContext.close();
  }
}
