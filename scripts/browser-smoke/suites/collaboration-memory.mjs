export const id = "collaboration-memory";
export const requiresRoomService = true;
export const description = "Live collaboration connect/disconnect heap regression smoke.";

const CONNECT_DISCONNECT_CYCLES = 5;
const MAX_HEAP_GROWTH_BYTES = 10 * 1024 * 1024;
const MAX_LISTENER_BALANCE_GROWTH = 2;
const MAX_TRANSIENT_HANDLE_GROWTH = 1;

const installLifecycleInstrumentation = async (context) => {
  await context.addInitScript(() => {
    const lifecycle = {
      listenerAdds: 0,
      listenerRemoves: 0,
      timeouts: new Set(),
      intervals: new Set(),
      animationFrames: new Set(),
      idleCallbacks: new Set(),
    };
    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const nativeRequestIdleCallback = window.requestIdleCallback?.bind(window);
    const nativeCancelIdleCallback = window.cancelIdleCallback?.bind(window);

    const isGlobalListenerTarget = (target) => target === window || target === document;

    EventTarget.prototype.addEventListener = function (...args) {
      if (isGlobalListenerTarget(this)) lifecycle.listenerAdds += 1;
      return nativeAddEventListener.apply(this, args);
    };
    EventTarget.prototype.removeEventListener = function (...args) {
      if (isGlobalListenerTarget(this)) lifecycle.listenerRemoves += 1;
      return nativeRemoveEventListener.apply(this, args);
    };
    window.setTimeout = (handler, delay, ...args) => {
      let handle;
      const wrappedHandler = typeof handler === "function"
        ? (...callbackArgs) => {
            lifecycle.timeouts.delete(handle);
            return handler(...callbackArgs);
          }
        : handler;
      handle = nativeSetTimeout(wrappedHandler, delay, ...args);
      lifecycle.timeouts.add(handle);
      return handle;
    };
    window.clearTimeout = (handle) => {
      lifecycle.timeouts.delete(handle);
      return nativeClearTimeout(handle);
    };
    window.setInterval = (handler, delay, ...args) => {
      const handle = nativeSetInterval(handler, delay, ...args);
      lifecycle.intervals.add(handle);
      return handle;
    };
    window.clearInterval = (handle) => {
      lifecycle.intervals.delete(handle);
      return nativeClearInterval(handle);
    };
    window.requestAnimationFrame = (callback) => {
      let handle;
      handle = nativeRequestAnimationFrame((time) => {
        lifecycle.animationFrames.delete(handle);
        callback(time);
      });
      lifecycle.animationFrames.add(handle);
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      lifecycle.animationFrames.delete(handle);
      return nativeCancelAnimationFrame(handle);
    };
    if (nativeRequestIdleCallback && nativeCancelIdleCallback) {
      window.requestIdleCallback = (callback, options) => {
        let handle;
        handle = nativeRequestIdleCallback((deadline) => {
          lifecycle.idleCallbacks.delete(handle);
          callback(deadline);
        }, options);
        lifecycle.idleCallbacks.add(handle);
        return handle;
      };
      window.cancelIdleCallback = (handle) => {
        lifecycle.idleCallbacks.delete(handle);
        return nativeCancelIdleCallback(handle);
      };
    }

    window.__tabulaLifecycleStats = () => ({
      listenerBalance: lifecycle.listenerAdds - lifecycle.listenerRemoves,
      activeTimeouts: lifecycle.timeouts.size,
      activeIntervals: lifecycle.intervals.size,
      activeAnimationFrames: lifecycle.animationFrames.size,
      activeIdleCallbacks: lifecycle.idleCallbacks.size,
    });
  });
};

const readLifecycleStats = async (page) => page.evaluate(() => window.__tabulaLifecycleStats?.());

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
  await page.getByText("Stop live collaboration?", { exact: true }).waitFor({ state: "visible" });
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
  await installLifecycleInstrumentation(context);
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);

  try {
    await cdpSession.send("Performance.enable");
    await cdpSession.send("HeapProfiler.enable");
    await page.goto(baseUrl);
    await page.waitForSelector(".tabbar");
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });

    await runLiveCycle({ page, focusMarkdownEditor, cycle: "warmup" });
    await page.waitForTimeout(250);
    const baselineHeap = await measureHeap(page, cdpSession);
    const baselineLifecycle = await readLifecycleStats(page);
    expect(Boolean(baselineLifecycle), "Lifecycle instrumentation should be available before the memory run.");

    for (let cycle = 1; cycle <= CONNECT_DISCONNECT_CYCLES; cycle += 1) {
      await runLiveCycle({ page, focusMarkdownEditor, cycle });
    }

    await page.waitForTimeout(250);
    const finalHeap = await measureHeap(page, cdpSession);
    const finalLifecycle = await readLifecycleStats(page);
    expect(Boolean(finalLifecycle), "Lifecycle instrumentation should remain available after collaboration cycles.");
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
    expect(
      finalLifecycle.listenerBalance - baselineLifecycle.listenerBalance <= MAX_LISTENER_BALANCE_GROWTH,
      `Live collaboration should release DOM listeners after disconnect. ` +
        `baseline=${baselineLifecycle.listenerBalance} final=${finalLifecycle.listenerBalance}`,
    );
    for (const key of ["activeTimeouts", "activeAnimationFrames", "activeIdleCallbacks"]) {
      expect(
        finalLifecycle[key] - baselineLifecycle[key] <= MAX_TRANSIENT_HANDLE_GROWTH,
        `Live collaboration should release ${key}. baseline=${baselineLifecycle[key]} final=${finalLifecycle[key]}`,
      );
    }
    expect(
      finalLifecycle.activeIntervals <= baselineLifecycle.activeIntervals,
      `Live collaboration should release intervals. ` +
        `baseline=${baselineLifecycle.activeIntervals} final=${finalLifecycle.activeIntervals}`,
    );

    console.log(
      `[collab-memory] baselineBytes=${baselineHeap} finalBytes=${finalHeap} growthBytes=${heapGrowth} ` +
        `baselineLifecycle=${JSON.stringify(baselineLifecycle)} finalLifecycle=${JSON.stringify(finalLifecycle)}`,
    );
  } finally {
    await cdpSession.detach().catch(() => undefined);
    await context.close();
  }
}
