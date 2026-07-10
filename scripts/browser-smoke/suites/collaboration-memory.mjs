export const id = "collaboration-memory";
export const description = "Live collaboration connect/disconnect heap regression smoke.";

const CONNECT_DISCONNECT_CYCLES = 5;
const MAX_HEAP_GROWTH_BYTES = 10 * 1024 * 1024;

const measureHeap = async (page, cdpSession) => {
  await cdpSession.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(100);
  const { metrics } = await cdpSession.send("Performance.getMetrics");
  const usedHeap = metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
  if (typeof usedHeap !== "number") {
    throw new Error("Chromium did not expose JSHeapUsedSize for the collaboration memory smoke.");
  }
  return usedHeap;
};

const runLiveCycle = async ({ page, focusMarkdownEditor, cycle }) => {
  await page.locator(".share-trigger").click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
  await page.waitForSelector(".sharing-presence");
  await page.getByRole("button", { name: "Close share dialog" }).click();

  await focusMarkdownEditor(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText(` memory-cycle-${cycle}`);
  await page.waitForFunction(
    ({ token }) => document.querySelector(".cm-content")?.textContent?.includes(token),
    { token: `memory-cycle-${cycle}` },
  );

  await page.locator(".share-trigger").click();
  await page.getByRole("button", { name: "Stop session" }).click();
  await page.locator(".tab-item[data-room-id]:not([data-room-id=''])").waitFor({ state: "detached" });
  await page.waitForFunction(() => !window.location.hash.startsWith("#room="));
  if ((await page.locator(".share-modal").count()) > 0) {
    await page.getByRole("button", { name: "Close share dialog" }).click();
    await page.locator(".share-modal").waitFor({ state: "detached" });
  }
};

export async function run(ctx) {
  const { baseUrl, browser, expect, focusMarkdownEditor, waitForEditorReady } = ctx;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);

  try {
    await cdpSession.send("Performance.enable");
    await cdpSession.send("HeapProfiler.enable");
    await page.goto(baseUrl);
    await page.waitForSelector(".tabbar");
    await page.getByTitle("New document").click();
    await waitForEditorReady(page, { mode: "edit" });

    await runLiveCycle({ page, focusMarkdownEditor, cycle: "warmup" });
    const baselineHeap = await measureHeap(page, cdpSession);

    for (let cycle = 1; cycle <= CONNECT_DISCONNECT_CYCLES; cycle += 1) {
      await runLiveCycle({ page, focusMarkdownEditor, cycle });
    }

    const finalHeap = await measureHeap(page, cdpSession);
    const heapGrowth = finalHeap - baselineHeap;
    expect(
      heapGrowth <= MAX_HEAP_GROWTH_BYTES,
      `Five live connect/edit/disconnect cycles should grow the retained JS heap by at most 10 MiB. ` +
        `baseline=${baselineHeap} final=${finalHeap} growth=${heapGrowth}`,
    );
    expect(
      (await page.locator(".cm-content").count()) === 1 &&
        (await page.locator(".sharing-presence").count()) === 0 &&
        (await page.locator(".cm-ySelectionCaret").count()) === 0,
      "Stopping the final session should leave one local editor and no collaboration presence DOM.",
    );

    console.log(
      `[collab-memory] baselineBytes=${baselineHeap} finalBytes=${finalHeap} growthBytes=${heapGrowth}`,
    );
  } finally {
    await cdpSession.detach().catch(() => undefined);
    await context.close();
  }
}
