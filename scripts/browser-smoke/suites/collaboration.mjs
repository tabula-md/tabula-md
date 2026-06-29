import fs from "node:fs/promises";
import path from "node:path";

export const id = "collaboration";
export const description = "Live collaboration room synchronization smoke.";

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    externalUrl,
    focusMarkdownEditor,
    restartRoomServer,
    roomDataDir,
    roomSnapshotMode,
    roomUrl,
    startRoomServer,
    stopRoomServer,
    waitForEditorReady,
    waitForText,
  } = ctx;

  const ensureEditMode = async (page) => {
    const editButton = page.getByRole("button", { name: "Edit", exact: true });
    if ((await editButton.count()) > 0) {
      await editButton.click();
    }
    await waitForEditorReady(page, { mode: "edit" });
  };
  const snapshotSource = { mode: roomSnapshotMode, roomDataDir, roomUrl };

  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await firstPage.goto(baseUrl);
    await firstPage.waitForSelector(".tabbar");
    await firstPage.locator(".share-trigger").click();
    await firstPage.getByRole("button", { name: "Start session" }).click();
    await firstPage.waitForSelector(".tab-item.live.active");
    await firstPage.waitForSelector(".sharing-presence");
    const firstPageUrl = new URL(firstPage.url());
    expect(
      firstPageUrl.pathname === "/" && !firstPageUrl.hash,
      "Starting a live session should keep the current workspace URL separate from the invite link.",
    );
    await waitForText(firstPage.locator(".share-modal"), "Invite link");
    const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
    expect(
      Boolean(shareUrl && new URL(shareUrl).pathname === "/" && new URL(shareUrl).hash.startsWith("#room=")),
      "Live sessions should expose a hash room invite link without navigating the current tab.",
    );
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
    const liveStatusBarText = (await firstPage.locator(".file-status-bar").textContent()) ?? "";
    expect(
      !/\b(?:Connecting|Live session)\b/.test(liveStatusBarText),
      "Live collaboration status should live in top presence, not the bottom status bar.",
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

    const roomUrl = new URL(shareUrl);
    const sharedPath = roomUrl.pathname + roomUrl.hash;
    await secondPage.goto(`${baseUrl}${sharedPath}`);
    await secondPage.waitForSelector(".tab-item.live.active");
    await ensureEditMode(secondPage);
    await ensureEditMode(firstPage);

    const sameBrowserTab = await firstContext.newPage();
    await sameBrowserTab.goto(`${baseUrl}${sharedPath}`);
    await sameBrowserTab.waitForSelector(".tab-item.live.active");
    await firstPage.waitForFunction(() => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 2);
    await sameBrowserTab.close();
    await firstPage.waitForFunction(() => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length === 1);
    expect(
      (await firstPage.locator(".sharing-presence .avatar:not(.self)").count()) === 1,
      "Presence should remove a collaborator avatar after that browser tab leaves the live room.",
    );

    const syncedText = await runLiveEditingCorrectnessSmoke({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
    });
    const roomValue = new URLSearchParams(roomUrl.hash.replace(/^#/, "")).get("room") ?? "";
    const [roomId, roomKey] = roomValue.split(",");

    await firstPage.locator(".sharing-presence").click();
    await firstPage.waitForSelector(".presence-popover");
    expect(
      (await firstPage.locator(".presence-popover .presence-row").count()) >= 1,
      "Presence popover should list live collaborators.",
    );
    await firstPage.keyboard.press("Escape");
    await firstPage.locator(".presence-popover").waitFor({ state: "detached" });

    await waitForStableSnapshotRecord(snapshotSource, roomId);

    const restoredContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const restoredPage = await restoredContext.newPage();
    await restoredPage.goto(`${baseUrl}${sharedPath}`);
    await restoredPage.waitForSelector(".tab-item.live.active");
    await waitForText(restoredPage.locator(".cm-content"), "Second browser edit");
    expect(
      (await getEditorDocumentText(restoredPage)) === syncedText,
      "Reloading the invite link should restore the latest live Markdown.",
    );
    await restoredContext.close();

    if (!externalUrl) {
      const snapshotRecord = await waitForStableSnapshotRecord(snapshotSource, roomId);
      expect(
        !snapshotRecord.raw.includes("Room sync check") && !snapshotRecord.raw.includes("Second browser edit"),
        "Room snapshot storage should not contain plaintext Markdown.",
      );
      expect(!roomKey || !snapshotRecord.raw.includes(roomKey), "Room snapshot storage should not contain room keys.");
      expect(snapshotRecord.json.snapshot.kind === "snapshot", "Room snapshot storage should contain snapshot envelopes.");
      expect(
        typeof snapshotRecord.json.snapshot.ciphertext === "string" &&
          snapshotRecord.json.snapshot.ciphertext.length > 0,
        "Room snapshot storage should contain ciphertext.",
      );

      let snapshotBeforeWrongKey = await waitForStableSnapshotRecord(snapshotSource, roomId);
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
      await firstPage.keyboard.press("ControlOrMeta+End");
      await firstPage.keyboard.press("Enter");
      await firstPage.keyboard.press("Enter");
      await firstPage.keyboard.type("Offline edit survived");
      await startRoomServer();
      await waitForText(secondPage.locator(".cm-content"), "Offline edit survived", 12_000);

      snapshotBeforeWrongKey = await waitForStableSnapshotRecord(snapshotSource, roomId);
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

      snapshotBeforeWrongKey = await waitForStableSnapshotRecord(snapshotSource, roomId);
      const wrongRoomKey = roomKey === "A".repeat(43) ? "B".repeat(43) : "A".repeat(43);
      const wrongKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const wrongKeyPage = await wrongKeyContext.newPage();
      try {
        await wrongKeyPage.goto(`${baseUrl}/#room=${roomId},${wrongRoomKey}`);
        await wrongKeyPage.waitForSelector(".tab-item.live.active");
        await waitForText(wrongKeyPage.locator(".file-status-bar"), "Room offline");
        expect(
          (await wrongKeyPage.locator(".live-room-notice").count()) === 0,
          "A room opened with the wrong key should not show document-level recovery UI.",
        );
        await wrongKeyPage.locator(".share-trigger").click();
        expect(
          (await wrongKeyPage.locator(".share-modal .live-room-status").count()) === 0,
          "A room opened with the wrong key should not show technical key state in Share.",
        );
        const wrongKeyText = await wrongKeyPage.locator(".cm-content").textContent();
        expect(
          !wrongKeyText?.includes("Room sync check"),
          "A room opened with the wrong key should not apply encrypted snapshot text.",
        );
      } finally {
        await wrongKeyContext.close();
      }

      await waitForSnapshotRecordToRemainUnchanged(snapshotSource, roomId, snapshotBeforeWrongKey.raw);

      const missingKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const missingKeyPage = await missingKeyContext.newPage();
      try {
        await missingKeyPage.goto(`${baseUrl}/#room=${roomId}`);
        await missingKeyPage.waitForSelector(".tabbar");
        expect(
          (await missingKeyPage.locator(".tab-item.live.active").count()) === 0,
          "A room path without a client-only key should not open a live room.",
        );
        expect(
          (await missingKeyPage.locator(".live-room-notice").count()) === 0,
          "A room path without a client-only key should stay out of live-room recovery UI.",
        );
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
    }
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}

async function getEditorLines(page) {
  return page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll(".cm-remote-cursor").forEach((cursor) => cursor.remove());
      return clone.textContent ?? "";
    }),
  );
}

async function getEditorDocumentText(page) {
  return (await getEditorLines(page)).join("\n");
}

async function waitForEditorLines(page, expectedLines, timeout = 8_000) {
  try {
    await page.waitForFunction(
      ({ expectedLines }) => {
        const lines = Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => {
          const clone = line.cloneNode(true);
          clone.querySelectorAll(".cm-remote-cursor").forEach((cursor) => cursor.remove());
          return clone.textContent ?? "";
        });
        return lines.length === expectedLines.length && lines.every((line, index) => line === expectedLines[index]);
      },
      { expectedLines },
      { timeout },
    );
  } catch (error) {
    const actualLines = await getEditorLines(page);
    throw new Error(
      `Timed out waiting for editor lines.\nExpected: ${JSON.stringify(expectedLines)}\nActual: ${JSON.stringify(actualLines)}\n${error.message}`,
    );
  }
}

async function runLiveEditingCorrectnessSmoke({ expect, firstPage, secondPage, focusMarkdownEditor }) {
  const longParagraph = Array.from({ length: 90 }, (_, index) => `segment-${index + 1}`).join(" ");

  await focusMarkdownEditor(firstPage);
  await firstPage.keyboard.press("ControlOrMeta+A");
  await firstPage.keyboard.type("Room sync check");
  await waitForEditorLines(secondPage, ["Room sync check"]);

  await firstPage.keyboard.press("Enter");
  await firstPage.keyboard.type("Second line");
  await waitForEditorLines(secondPage, ["Room sync check", "Second line"]);

  await firstPage.keyboard.press("Backspace");
  await waitForEditorLines(secondPage, ["Room sync check", "Second lin"]);
  await firstPage.keyboard.type("e");
  await waitForEditorLines(secondPage, ["Room sync check", "Second line"]);

  for (let index = 0; index < "Second line".length; index += 1) {
    await firstPage.keyboard.press("ArrowLeft");
  }
  await firstPage.keyboard.press("Backspace");
  await waitForEditorLines(secondPage, ["Room sync checkSecond line"]);

  await firstPage.keyboard.press("End");
  await firstPage.keyboard.press("Enter");
  await firstPage.keyboard.insertText(longParagraph);
  await waitForEditorLines(secondPage, ["Room sync checkSecond line", longParagraph], 12_000);

  const secondPageSyncedText = await getEditorDocumentText(secondPage);
  await focusMarkdownEditor(secondPage);
  await secondPage.keyboard.press("ControlOrMeta+Z");
  await waitForEditorLines(secondPage, ["Room sync checkSecond line", longParagraph]);
  expect(
    (await getEditorDocumentText(secondPage)) === secondPageSyncedText,
    "Remote updates should not enter the local undo stack.",
  );

  await secondPage.keyboard.press("ControlOrMeta+End");
  await secondPage.keyboard.press("Enter");
  await secondPage.keyboard.insertText("Second browser edit");
  const expectedLines = ["Room sync checkSecond line", longParagraph, "Second browser edit"];
  await waitForEditorLines(firstPage, expectedLines, 12_000);

  try {
    await firstPage.waitForSelector(".cm-remote-cursor", { timeout: 8_000 });
  } catch (error) {
    const remotePresenceDebug = await firstPage.evaluate(() => ({
      collaboratorAvatars: document.querySelectorAll(".sharing-presence .avatar:not(.self)").length,
      remoteCursorCount: document.querySelectorAll(".cm-remote-cursor").length,
      remoteLineCount: document.querySelectorAll(".cm-remote-presence-line").length,
      remoteSelectionCount: document.querySelectorAll(".cm-remote-selection").length,
      presenceText: document.querySelector(".sharing-presence")?.textContent ?? "",
      collaboratorTooltips: Array.from(document.querySelectorAll(".sharing-presence .avatar:not(.self)")).map(
        (avatar) => avatar.getAttribute("data-tooltip") ?? "",
      ),
      editorText: Array.from(document.querySelectorAll(".cm-content .cm-line")).map(
        (line) => line.textContent ?? "",
      ),
    }));
    throw new Error(
      `Timed out waiting for remote cursor.\n${JSON.stringify(remotePresenceDebug, null, 2)}\n${error.message}`,
    );
  }

  return expectedLines.join("\n");
}

async function waitForSnapshotRecord(snapshotSource, roomId) {
  if (!roomId) {
    throw new Error("Live collaboration smoke could not determine the room id.");
  }

  const deadline = Date.now() + 8_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      if (snapshotSource.mode === "http") {
        const response = await fetch(`${snapshotSource.roomUrl}/v1/rooms/${encodeURIComponent(roomId)}/snapshot`);
        if (response.status === 404) {
          throw new Error("Snapshot not found");
        }
        if (!response.ok) {
          throw new Error(`Snapshot endpoint returned ${response.status}`);
        }
        const envelope = await response.json();
        const raw = JSON.stringify(envelope);
        return { raw, json: { snapshot: envelope } };
      }

      const snapshotPath = path.join(snapshotSource.roomDataDir, roomId, "snapshot.json");
      const raw = await fs.readFile(snapshotPath, "utf8");
      return { raw, json: JSON.parse(raw) };
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }

  throw new Error(`Timed out waiting for encrypted room snapshot: ${lastError?.message ?? ""}`);
}

async function waitForStableSnapshotRecord(snapshotSource, roomId) {
  const deadline = Date.now() + 8_000;
  let previous = await waitForSnapshotRecord(snapshotSource, roomId);
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    await wait(100);
    const next = await waitForSnapshotRecord(snapshotSource, roomId);
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

async function waitForSnapshotRecordToRemainUnchanged(snapshotSource, roomId, expectedRaw) {
  const deadline = Date.now() + 1_500;
  let latest = await waitForSnapshotRecord(snapshotSource, roomId);

  while (Date.now() < deadline) {
    latest = await waitForSnapshotRecord(snapshotSource, roomId);
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
