import fs from "node:fs/promises";
import path from "node:path";

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
    restartRoomServer,
    roomDataDir,
    startRoomServer,
    stopRoomServer,
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
      const roomUrl = new URL(firstPage.url());
      const roomId = roomUrl.pathname.split("/").filter(Boolean).at(-1);
      const roomKey = new URLSearchParams(roomUrl.hash.replace(/^#/, "")).get("key");
      const snapshotRecord = await waitForSnapshotRecord(roomDataDir, roomId);
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
      expect(
        !snapshotRecord.raw.includes("Room sync check") && !snapshotRecord.raw.includes("**Room sync check**"),
        "Room snapshot storage should not contain plaintext Markdown.",
      );
      expect(!roomKey || !snapshotRecord.raw.includes(roomKey), "Room snapshot storage should not contain room keys.");
      expect(snapshotRecord.json.snapshot.kind === "snapshot", "Room snapshot storage should contain snapshot envelopes.");
      expect(
        typeof snapshotRecord.json.snapshot.ciphertext === "string" &&
          snapshotRecord.json.snapshot.ciphertext.length > 0,
        "Room snapshot storage should contain ciphertext.",
      );

      const restoredPage = await context.newPage();
      await restoredPage.goto(`${baseUrl}${sharedPath}`);
      await restoredPage.waitForSelector(".tab-item.live.active");
      await waitForText(restoredPage.locator(".cm-content"), "**Room sync check**");
      await restoredPage.close();

      let snapshotBeforeWrongKey = await waitForStableSnapshotRecord(roomDataDir, roomId);
      expect(typeof stopRoomServer === "function", "Collaboration smoke should be able to stop the room server.");
      expect(typeof startRoomServer === "function", "Collaboration smoke should be able to start the room server.");
      await stopRoomServer();
      await firstPage.waitForSelector(".share-status-dot.offline", { timeout: 8_000 });
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.press("ArrowRight");
      await firstPage.keyboard.press("End");
      await firstPage.keyboard.type("\n\nOffline edit survived");
      await startRoomServer();
      await waitForText(secondPage.locator(".cm-content"), "Offline edit survived", 12_000);

      snapshotBeforeWrongKey = await waitForStableSnapshotRecord(roomDataDir, roomId);
      expect(typeof restartRoomServer === "function", "Collaboration smoke should be able to restart the room server.");
      await restartRoomServer();

      const restartContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const restartPage = await restartContext.newPage();
      try {
        await restartPage.goto(`${baseUrl}${sharedPath}`);
        await restartPage.waitForSelector(".tab-item.live.active");
        await waitForText(restartPage.locator(".cm-content"), "Offline edit survived");
        await restartPage.locator(".share-trigger").click();
        await waitForText(restartPage.locator(".share-modal"), "Encrypted room snapshot restored.");
      } finally {
        await restartContext.close();
      }

      snapshotBeforeWrongKey = await waitForStableSnapshotRecord(roomDataDir, roomId);
      const wrongRoomKey = roomKey === "A".repeat(43) ? "B".repeat(43) : "A".repeat(43);
      const wrongKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const wrongKeyPage = await wrongKeyContext.newPage();
      try {
        await wrongKeyPage.goto(`${baseUrl}${roomUrl.pathname}#key=${wrongRoomKey}`);
        await wrongKeyPage.waitForSelector(".tab-item.live.active");
        await wrongKeyPage.locator(".share-trigger").click();
        await waitForText(
          wrongKeyPage.locator(".share-modal"),
          "The encrypted room snapshot could not be decrypted.",
        );
        const wrongKeyText = await wrongKeyPage.locator(".cm-content").textContent();
        expect(
          !wrongKeyText?.includes("Room sync check"),
          "A room opened with the wrong key should not apply encrypted snapshot text.",
        );
      } finally {
        await wrongKeyContext.close();
      }

      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const snapshotAfterWrongKey = await waitForSnapshotRecord(roomDataDir, roomId);
      expect(
        snapshotAfterWrongKey.raw === snapshotBeforeWrongKey.raw,
        "A room opened with the wrong key should not overwrite the encrypted snapshot.",
      );
    } finally {
      await context.close();
    }
  }
}

async function waitForSnapshotRecord(roomDataDir, roomId) {
  if (!roomId) {
    throw new Error("Live collaboration smoke could not determine the room id.");
  }

  const snapshotPath = path.join(roomDataDir, roomId, "snapshot.json");
  const deadline = Date.now() + 8_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const raw = await fs.readFile(snapshotPath, "utf8");
      return { raw, json: JSON.parse(raw) };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Timed out waiting for encrypted room snapshot at ${snapshotPath}: ${lastError?.message ?? ""}`);
}

async function waitForStableSnapshotRecord(roomDataDir, roomId) {
  const deadline = Date.now() + 8_000;
  let previous = await waitForSnapshotRecord(roomDataDir, roomId);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    const next = await waitForSnapshotRecord(roomDataDir, roomId);
    if (next.raw === previous.raw) {
      return next;
    }
    previous = next;
  }

  throw new Error("Timed out waiting for encrypted room snapshot to stabilize.");
}
