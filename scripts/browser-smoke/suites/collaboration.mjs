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
      await firstPage.waitForSelector(".sharing-presence");
      const sharingPresenceTitle = await firstPage.locator(".sharing-presence").getAttribute("data-tooltip");
      const sharingPresenceText = await firstPage.locator(".sharing-presence").textContent();
      expect(
        sharingPresenceTitle?.startsWith("Live"),
        "Sharing presence should keep accessible live-session context without native title UI.",
      );
      expect(
        !sharingPresenceText?.includes("Sharing"),
        "Sharing presence should not add a visible text label to the top chrome.",
      );
      expect(
        (await firstPage.locator(".share-status-dot").count()) === 0,
        "Share trigger should not use a corner status dot for active sharing.",
      );
      expect(
        (await firstPage.locator(".avatar.self").getAttribute("data-tooltip"))?.length > 0,
        "Self avatar should expose the collaborator name through the custom hover tooltip.",
      );
      await firstPage.getByRole("button", { name: "Close share dialog" }).click();
      await firstPage.locator(".avatar.self").hover();
      await firstPage.waitForFunction(() => {
        const avatar = document.querySelector(".avatar.self");
        return avatar && getComputedStyle(avatar, "::after").opacity === "1";
      });

      const sharedPath = new URL(firstPage.url()).pathname + new URL(firstPage.url()).hash;
      await secondPage.goto(`${baseUrl}${sharedPath}`);
      await secondPage.waitForSelector(".tab-item.live.active");
      await secondPage.getByRole("button", { name: "Edit", exact: true }).click();

      await firstPage.getByRole("button", { name: "Edit", exact: true }).click();
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.type("Room sync check");

      await waitForText(secondPage.locator(".cm-content"), "Room sync check");
      await firstPage.keyboard.press("Shift+Home");
      await waitForText(firstPage.locator(".status-cursor-position"), "(15 characters)");
      await firstPage.getByRole("button", { name: "Bold", exact: true }).click();
      await waitForText(secondPage.locator(".cm-content"), "**Room sync check**");
      const roomUrl = new URL(firstPage.url());
      const roomId = roomUrl.pathname.split("/").filter(Boolean).at(-1);
      const roomKey = new URLSearchParams(roomUrl.hash.replace(/^#/, "")).get("key");
      const snapshotRecord = await waitForStableSnapshotRecord(roomDataDir, roomId);
      const liveFormattingState = await firstPage.evaluate(() => ({
        cursorPosition: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
        editorFocused: Boolean(document.querySelector(".markdown-editor")?.contains(document.activeElement)),
      }));
      const remotePresenceState = await secondPage.evaluate(() => ({
        editorText: document.querySelector(".cm-content")?.textContent ?? "",
      }));
      expect(
        liveFormattingState.cursorPosition.includes("(15 characters)"),
        "Live formatting commands should keep selection character state current after dispatch.",
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
      await firstPage.waitForSelector(".tab-live-dot.offline", { timeout: 8_000 });
      const offlineNoticeCount = await firstPage.locator(".live-room-notice").count();
      expect(offlineNoticeCount === 0, "Recoverable server offline state should not show a document-level notice.");
      await firstPage.locator(".share-trigger").click();
      expect(
        (await firstPage.locator(".share-modal .live-room-status").count()) === 0,
        "Recoverable server offline state should not show routine status copy in Share.",
      );
      await firstPage.getByRole("button", { name: "Close share dialog" }).click();
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
        expect(
          (await restartPage.locator(".share-modal .live-room-status").count()) === 0,
          "Successful snapshot restore should not show routine status copy in Share.",
        );
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
        await waitForText(wrongKeyPage.locator(".live-room-notice"), "Room key does not match");
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

      await waitForSnapshotRecordToRemainUnchanged(roomDataDir, roomId, snapshotBeforeWrongKey.raw);

      const missingKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const missingKeyPage = await missingKeyContext.newPage();
      try {
        await missingKeyPage.goto(`${baseUrl}${roomUrl.pathname}`);
        await missingKeyPage.waitForSelector(".tab-item.live.active");
        await waitForText(missingKeyPage.locator(".live-room-notice"), "Room key missing");
      } finally {
        await missingKeyContext.close();
      }

      await firstPage.locator(".share-trigger").click();
      const dismissedStopDialogMessage = new Promise((resolve) => {
        firstPage.once("dialog", async (dialog) => {
          const message = dialog.message();
          await dialog.dismiss();
          resolve(message);
        });
      });
      await firstPage.getByRole("button", { name: "Stop session" }).click();
      const dismissedStopDialog = await dismissedStopDialogMessage;
      expect(
        dismissedStopDialog.includes("Stop sharing this file?"),
        "Stop session should ask for native confirmation before leaving the live room.",
      );
      expect(
        (await firstPage.locator(".tab-item.live.active").count()) === 1,
        "Dismissing stop session confirmation should keep the file live.",
      );
      const acceptedStopDialogMessage = new Promise((resolve) => {
        firstPage.once("dialog", async (dialog) => {
          const message = dialog.message();
          await dialog.accept();
          resolve(message);
        });
      });
      await firstPage.getByRole("button", { name: "Stop session" }).click();
      const acceptedStopDialog = await acceptedStopDialogMessage;
      expect(
        acceptedStopDialog.includes("This tab will leave the live room"),
        "Stop session confirmation should explain that this tab leaves the live room.",
      );
      await firstPage.locator(".tab-live-dot").waitFor({ state: "detached", timeout: 5_000 });
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
      await wait(100);
    }
  }

  throw new Error(`Timed out waiting for encrypted room snapshot at ${snapshotPath}: ${lastError?.message ?? ""}`);
}

async function waitForStableSnapshotRecord(roomDataDir, roomId) {
  const deadline = Date.now() + 8_000;
  let previous = await waitForSnapshotRecord(roomDataDir, roomId);
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    await wait(100);
    const next = await waitForSnapshotRecord(roomDataDir, roomId);
    if (next.raw === previous.raw) {
      if (Date.now() - stableSince >= 1_300) {
        return next;
      }
    } else {
      stableSince = Date.now();
    }
    previous = next;
  }

  throw new Error("Timed out waiting for encrypted room snapshot to stabilize.");
}

async function waitForSnapshotRecordToRemainUnchanged(roomDataDir, roomId, expectedRaw) {
  const deadline = Date.now() + 1_500;
  let latest = await waitForSnapshotRecord(roomDataDir, roomId);

  while (Date.now() < deadline) {
    latest = await waitForSnapshotRecord(roomDataDir, roomId);
    if (latest.raw !== expectedRaw) {
      throw new Error("A room opened with the wrong key overwrote the encrypted snapshot.");
    }

    await wait(Math.min(100, Math.max(0, deadline - Date.now())));
  }

  return latest;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
