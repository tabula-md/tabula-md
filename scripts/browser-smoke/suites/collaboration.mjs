export const id = "collaboration";
export const description = "Live collaboration room synchronization smoke.";

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    externalUrl,
    focusMarkdownEditor,
    openMarkdownFile,
    openProjectMenu,
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

  const collectPageDiagnostics = (page) => {
    const diagnostics = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        diagnostics.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      diagnostics.push(`pageerror: ${error.stack ?? error.message}`);
    });
    page.on("requestfailed", (request) => {
      diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });
    return diagnostics;
  };

  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  const firstPageDiagnostics = collectPageDiagnostics(firstPage);
  const secondPageDiagnostics = collectPageDiagnostics(secondPage);

  try {
    await firstPage.goto(baseUrl);
    try {
      await firstPage.waitForSelector(".tabbar");
    } catch (error) {
      throw new Error(
        `Timed out waiting for the workspace shell.\n${firstPageDiagnostics.join("\n")}\n${error.message}`,
      );
    }
    await openMarkdownFile(firstPage, {
      content: "# Shared workspace\n\nPrimary collaboration document.",
    });
    await firstPage.waitForSelector('.tab-item[data-file-name="README.md"].active');
    await firstPage.locator(".add-tab-button").click();
    await firstPage.waitForFunction(() => {
      const activeTab = document.querySelector(".tab-item.active");
      return activeTab && activeTab.getAttribute("data-file-name") !== "README.md";
    });
    const secondaryFileName = await firstPage.locator(".tab-item.active").getAttribute("data-file-name");
    expect(Boolean(secondaryFileName), "Creating a second workspace document should open a non-README tab.");
    await clickTabByFileName(firstPage, "README.md");
    await firstPage.waitForSelector('.tab-item[data-file-name="README.md"].active');
    await firstPage.locator(".share-trigger").click();
    const liveSurfaceStartedAt = Date.now();
    await firstPage.getByRole("button", { name: "Start session" }).click();
    await firstPage.getByRole("button", { name: "Stop session" }).waitFor({
      state: "visible",
      timeout: 1_000,
    });
    expect(
      Date.now() - liveSurfaceStartedAt < 1_000,
      "Start session should enter the live surface without waiting for relay or checkpoint round trips.",
    );
    try {
      await firstPage.waitForSelector('.tab-item.active[data-room-id]:not([data-room-id=""])');
    } catch (error) {
      const state = await getTabDiagnostics(firstPage);
      throw new Error(
        `Timed out waiting for the initial live session.\n${JSON.stringify(state, null, 2)}\n${[
          ...firstPageDiagnostics,
          ...secondPageDiagnostics,
        ].join("\n")}\n${error.message}`,
      );
    }
    await firstPage.waitForSelector(".share-trigger.live .share-live-dot");
    await firstPage.waitForSelector(".sharing-presence");
    const firstPageUrl = new URL(firstPage.url());
    expect(
      firstPageUrl.pathname === "/" && firstPageUrl.hash.startsWith("#room="),
      "Starting a live session should move the current tab to the canonical room URL.",
    );
    await waitForText(firstPage.locator(".share-modal"), "Invite link");
    const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
    expect(
      Boolean(shareUrl && new URL(shareUrl).pathname === "/" && new URL(shareUrl).hash.startsWith("#room=")),
      "Live sessions should expose the canonical hash room invite link.",
    );
    expect(
      shareUrl === firstPage.url(),
      "The live invite link should match the current room URL after starting a session.",
    );
    const sharingPresenceLabel = await firstPage.locator(".sharing-presence").getAttribute("aria-label");
    const sharingPresenceText = await firstPage.locator(".sharing-presence").textContent();
    expect(
      sharingPresenceLabel?.startsWith("Live"),
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
      (await firstPage.locator(".avatar.self").getAttribute("aria-label"))?.length > 0,
      "Self avatar should expose the collaborator name through its accessible label.",
    );
    await firstPage.getByRole("button", { name: "Close share dialog" }).click();
    await openProjectMenu(firstPage);
    expect(
      (await firstPage.getByRole("button", { name: "Clear local workspace…", exact: true }).count()) === 0,
      "Live rooms should not expose the local workspace clear action.",
    );
    expect(
      (await firstPage.getByRole("button", { name: "Import workspace…", exact: true }).count()) === 0,
      "Live rooms should not replace the shared workspace through folder import.",
    );
    expect(
      (await firstPage.getByRole("button", { name: "Export document (.md)", exact: true }).count()) === 1 &&
        (await firstPage.getByRole("button", { name: "Export workspace (.zip)", exact: true }).count()) === 1,
      "Live rooms should allow local document and workspace exports.",
    );
    await firstPage.keyboard.press("Escape");
    await clickTabByFileName(firstPage, secondaryFileName);
    await firstPage.waitForFunction(
      ({ secondaryFileName }) => {
        const activeTab = document.querySelector(".tab-item.active");
        return activeTab?.getAttribute("data-file-name") === secondaryFileName && Boolean(activeTab.getAttribute("data-room-id"));
      },
      { secondaryFileName },
    );
    await firstPage.waitForSelector(".share-trigger.live .share-live-dot");
    expect(
      new URL(firstPage.url()).hash === firstPageUrl.hash,
      "Switching to another included workspace document should keep the same live room URL.",
    );
    await firstPage.locator(".share-trigger").click();
    await waitForText(firstPage.locator(".share-modal"), "Invite link");
    const untitledShareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
    expect(
      untitledShareUrl === firstPage.url(),
      "Included workspace documents should expose the same live invite link after tab switching.",
    );
    await firstPage.getByRole("button", { name: "Close share dialog" }).click();
    await clickTabByFileName(firstPage, "README.md");
    await firstPage.waitForSelector('.tab-item[data-file-name="README.md"].active[data-room-id]:not([data-room-id=""])');
    await firstPage.getByRole("button", { name: "Toggle side panel" }).click();
    await firstPage.waitForSelector(".right-panel-tab .right-panel-tab-status-dot.live");
    expect(
      (await firstPage.locator(".right-file-icon-live-dot").count()) === 0,
      "Live state should be shown on the Files tab, not repeated in the file tree.",
    );
    await firstPage.getByRole("button", { name: "Toggle side panel" }).click();
    await firstPage.locator(".avatar.self").hover();
    await firstPage.waitForFunction(() => {
      const avatar = document.querySelector(".avatar.self");
      return avatar && getComputedStyle(avatar, "::after").opacity === "1";
    });

    const roomUrl = new URL(shareUrl);
    const sharedPath = roomUrl.pathname + roomUrl.hash;
    await secondPage.goto(baseUrl);
    await secondPage.waitForSelector(".tabbar");
    await secondPage.locator(".add-tab-button").click();
    await secondPage.waitForSelector(".tab-item.active");
    await secondPage.goto(`${baseUrl}${sharedPath}`);
    await secondPage.waitForSelector('.tab-item.active[data-room-id]:not([data-room-id=""])');
    await ensureEditMode(secondPage);
    await ensureEditMode(firstPage);

    const sameBrowserTab = await firstContext.newPage();
    await sameBrowserTab.goto(`${baseUrl}${sharedPath}`);
    await sameBrowserTab.waitForSelector('.tab-item.active[data-room-id]:not([data-room-id=""])');
    await firstPage.waitForFunction(() => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 2);
    await sameBrowserTab.close();
    await firstPage.waitForFunction(() => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length === 1);
    expect(
      (await firstPage.locator(".sharing-presence .avatar:not(.self)").count()) === 1,
      "Presence should remove a collaborator avatar after that browser tab leaves the live room.",
    );
    await secondPage.waitForSelector('.tab-item[data-file-name="README.md"].active[data-room-id]:not([data-room-id=""])');
    const joinedRoomTabs = await secondPage.evaluate(() =>
      Array.from(document.querySelectorAll(".tab-item")).map((tab) => ({
        fileName: tab.getAttribute("data-file-name"),
        roomId: tab.getAttribute("data-room-id"),
      })),
    );
    expect(
      joinedRoomTabs.length > 0 && joinedRoomTabs.every((tab) => Boolean(tab.roomId)),
      `Opening a room link should show only room-owned tabs, not pre-existing local tabs.\n${JSON.stringify(joinedRoomTabs, null, 2)}`,
    );
    expect(
      joinedRoomTabs.some((tab) => tab.fileName === "README.md"),
      "The joined room should include the shared README document.",
    );
    expect(
      !joinedRoomTabs.some((tab) => tab.fileName === secondaryFileName),
      "A room document should not become an open tab until this participant opens it.",
    );
    await openFileFromRightPanel(secondPage, secondaryFileName);
    await secondPage.waitForSelector(`.tab-item.active[data-file-name="${secondaryFileName}"]`);
    await clickTabByFileName(secondPage, "README.md");
    await ensureEditMode(secondPage);
    await ensureEditMode(firstPage);

    const syncedText = await runLiveEditingCorrectnessSmoke({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
    });
    await runLiveWorkspaceDocumentCreationSmoke({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
      waitForEditorReady,
      waitForText,
    });
    await clickTabByFileName(firstPage, "README.md");
    await firstPage.waitForSelector('.tab-item[data-file-name="README.md"].active[data-room-id]:not([data-room-id=""])');
    await clickTabByFileName(secondPage, "README.md");
    await secondPage.waitForSelector('.tab-item[data-file-name="README.md"].active[data-room-id]:not([data-room-id=""])');
    const roomValue = new URLSearchParams(roomUrl.hash.replace(/^#/, "")).get("room") ?? "";
    const [roomId, roomKey] = roomValue.split(",");

    await clickTabByFileName(secondPage, secondaryFileName);
    await secondPage.waitForSelector(`.tab-item[data-file-name="${secondaryFileName}"].active`);
    await focusMarkdownEditor(secondPage);
    await secondPage.keyboard.press("ControlOrMeta+A");
    await secondPage.keyboard.insertText(
      Array.from({ length: 120 }, (_, index) => `Follow viewport line ${index + 1}`).join("\n"),
    );
    await secondPage.locator(".workspace").evaluate((workspace) => {
      const codeMirrorScroller = document.querySelector(".cm-scroller");
      const scrollOwner = codeMirrorScroller &&
        codeMirrorScroller.scrollHeight - codeMirrorScroller.clientHeight > 1
        ? codeMirrorScroller
        : workspace;
      scrollOwner.scrollTop = scrollOwner.scrollHeight;
      scrollOwner.dispatchEvent(new Event("scroll"));
    });
    await secondPage.waitForFunction(
      () => Math.max(
        document.querySelector(".workspace")?.scrollTop ?? 0,
        document.querySelector(".cm-scroller")?.scrollTop ?? 0,
      ) > 0,
    );
    const remoteAvatar = firstPage.locator(".sharing-presence .avatar.participant").first();
    await remoteAvatar.waitFor({ state: "visible" });
    expect(
      (await remoteAvatar.getAttribute("aria-label"))?.length > 0,
      "Remote participant avatars should expose their follow action through an accessible label.",
    );
    await remoteAvatar.click();
    await firstPage.waitForSelector(`.tab-item[data-file-name="${secondaryFileName}"].active`);
    await firstPage.waitForFunction(
      () => Math.max(
        document.querySelector(".workspace")?.scrollTop ?? 0,
        document.querySelector(".cm-scroller")?.scrollTop ?? 0,
      ) > 0,
    );
    expect(
      (await remoteAvatar.getAttribute("aria-pressed")) === "true",
      "Clicking a participant avatar should immediately follow that participant.",
    );
    expect(
      (await firstPage.locator(".presence-popover").count()) === 0,
      "Participant avatars should not open a separate participant popover.",
    );
    await remoteAvatar.click();
    expect(
      (await remoteAvatar.getAttribute("aria-pressed")) === "false",
      "Clicking the followed participant again should stop following.",
    );
    await clickTabByFileName(firstPage, "README.md");
    await clickTabByFileName(secondPage, "README.md");

    const restoredContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const restoredPage = await restoredContext.newPage();
    const restoredDiagnostics = collectPageDiagnostics(restoredPage);
    await restoredPage.goto(`${baseUrl}${sharedPath}`);
    await restoredPage.waitForSelector('.tab-item.active[data-room-id]:not([data-room-id=""])');
    try {
      await restoredPage.waitForSelector('.tab-item[data-file-name="README.md"].active[data-room-id]:not([data-room-id=""])');
    } catch (error) {
      const tabs = await restoredPage.evaluate(() =>
        ({
          bodyText: document.body.textContent?.slice(0, 1000) ?? "",
          tabs: Array.from(document.querySelectorAll(".tab-item")).map((tab) => ({
            className: tab.className,
            fileName: tab.getAttribute("data-file-name"),
            text: tab.textContent,
          })),
          url: window.location.href,
        }),
      );
      throw new Error(
        `${error.message}\nRestored diagnostics:\n${JSON.stringify(restoredDiagnostics, null, 2)}\nRestored tabs:\n${JSON.stringify(tabs, null, 2)}`,
      );
    }
    await ensureEditMode(restoredPage);
    try {
      await waitForText(restoredPage.locator(".cm-content"), "Second browser edit");
    } catch (error) {
      const restoredState = await restoredPage.evaluate(() => ({
        url: window.location.href,
        activeTab: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
        status: document.querySelector(".file-status-bar")?.textContent ?? "",
        editorLines: Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => line.textContent ?? ""),
      }));
      throw new Error(
        `${error.message}\nRestored diagnostics:\n${JSON.stringify(restoredDiagnostics, null, 2)}\nRestored state:\n${JSON.stringify(restoredState, null, 2)}`,
      );
    }
    const restoredText = await getEditorDocumentText(restoredPage);
    expect(
      restoredText === syncedText,
      `Reloading the invite link should restore the latest live Markdown.\nExpected: ${JSON.stringify(syncedText)}\nActual: ${JSON.stringify(restoredText)}`,
    );
    await restoredContext.close();

    if (!externalUrl) {
      expect(typeof stopRoomServer === "function", "Collaboration smoke should be able to stop the room server.");
      expect(typeof startRoomServer === "function", "Collaboration smoke should be able to start the room server.");
      await stopRoomServer();
      await firstPage.waitForSelector(".share-trigger.live.reconnecting", { timeout: 8_000 });
      const offlineNoticeCount = await firstPage.locator(".live-room-notice").count();
      expect(offlineNoticeCount === 0, "Recoverable reconnecting state should not show a document-level notice.");
      await firstPage.locator(".share-trigger").click();
      await firstPage.waitForSelector(".share-live-status.reconnecting");
      expect(
        (await firstPage.locator(".share-modal .live-room-status").count()) === 0,
        "Recoverable reconnecting state should not show routine status copy in Share.",
      );
      await firstPage.getByRole("button", { name: "Close share dialog" }).click();
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.press("ControlOrMeta+End");
      await firstPage.keyboard.press("Enter");
      await firstPage.keyboard.press("Enter");
      await firstPage.keyboard.insertText("Offline edit survived");
      await waitForText(firstPage.locator(".cm-content"), "Offline edit survived");
      await startRoomServer();
      await firstPage.waitForSelector(".share-trigger.live.connected", { timeout: 20_000 });
      await secondPage.waitForSelector(".share-trigger.live.connected", { timeout: 20_000 });
      await ensureEditMode(secondPage);
      try {
        await waitForText(secondPage.locator(".cm-content"), "Offline edit survived", 12_000);
      } catch (error) {
        const reconnectDiagnostics = await Promise.all([firstPage, secondPage].map((page) => page.evaluate(() => ({
          editorText: document.querySelector(".cm-content")?.textContent ?? "",
          shareClass: document.querySelector(".share-trigger")?.className ?? "",
          participants: document.querySelector(".presence-summary")?.textContent ?? "",
          toast: document.querySelector(".app-toast")?.textContent ?? "",
        }))));
        throw new Error(`${error.message}\nReconnect diagnostics:\n${JSON.stringify(reconnectDiagnostics, null, 2)}`);
      }
    }

    {
      const wrongRoomKey = roomKey === "A".repeat(43) ? "B".repeat(43) : "A".repeat(43);
      const wrongKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const wrongKeyPage = await wrongKeyContext.newPage();
      try {
        await wrongKeyPage.goto(`${baseUrl}/#room=${roomId},${wrongRoomKey}`);
        await wrongKeyPage.waitForSelector(".live-room-loading-surface");
        await wait(500);
        expect(
          (await wrongKeyPage.locator(".live-room-notice").count()) === 0,
          "A room opened with the wrong key should not show document-level recovery UI.",
        );
        expect(
          (await wrongKeyPage.locator('.tab-item[data-room-id]:not([data-room-id=""])').count()) === 0,
          "A room opened with the wrong key should not expose a placeholder live document tab.",
        );
        const wrongKeyText =
          (await wrongKeyPage.locator(".cm-content").count()) > 0
            ? await wrongKeyPage.locator(".cm-content").textContent()
            : "";
        expect(
          !wrongKeyText?.includes("Room sync check"),
          "A room opened with the wrong key should not apply encrypted snapshot text.",
        );
      } finally {
        await wrongKeyContext.close();
      }

      const missingKeyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const missingKeyPage = await missingKeyContext.newPage();
      try {
        await missingKeyPage.goto(`${baseUrl}/#room=${roomId}`);
        await missingKeyPage.waitForSelector(".tabbar");
        expect(
          (await missingKeyPage.locator('.tab-item.active[data-room-id]:not([data-room-id=""])').count()) === 0,
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
      expect(
        (await firstPage.locator(".share-trigger.live").count()) === 1,
        "The workspace should still be live before stopping the session.",
      );
      await firstPage.getByRole("button", { name: "Stop session" }).click();
      await waitForText(firstPage.locator(".share-modal"), "Stop live collaboration?");
      await firstPage.getByRole("button", { name: "Cancel" }).click();
      expect(
        (await firstPage.locator(".share-trigger.live").count()) === 1,
        "Canceling Stop session should keep the browser in the live room.",
      );
      await firstPage.getByRole("button", { name: "Stop session" }).click();
      await firstPage.getByRole("button", { name: "Stop session" }).click();
      await firstPage.locator(".share-trigger.live").waitFor({ state: "detached", timeout: 5_000 });
    }
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}

async function getEditorLines(page) {
  return page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll(".cm-ySelectionCaret").forEach((cursor) => cursor.remove());
      return clone.textContent ?? "";
    }),
  );
}

async function getEditorDocumentText(page) {
  return (await getEditorLines(page)).join("\n");
}

async function clickTabByFileName(page, fileName) {
  await page.evaluate((fileName) => {
    const tab = Array.from(document.querySelectorAll(".tab-item")).find(
      (item) => item.getAttribute("data-file-name") === fileName,
    );
    const button = tab?.querySelector(".tab-select-button");
    if (!(button instanceof HTMLElement)) {
      throw new Error(`Could not find tab: ${fileName}`);
    }
    button.click();
  }, fileName);
}

async function waitForTabByFileName(page, fileName, timeout = 8_000) {
  await page.waitForFunction(
    ({ fileName }) =>
      Array.from(document.querySelectorAll(".tab-item")).some(
        (item) => item.getAttribute("data-file-name") === fileName,
      ),
    { fileName },
    { timeout },
  );
}

async function waitForEditorLines(page, expectedLines, timeout = 8_000) {
  try {
    await page.waitForFunction(
      ({ expectedLines }) => {
        const lines = Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => {
          const clone = line.cloneNode(true);
          clone.querySelectorAll(".cm-ySelectionCaret").forEach((cursor) => cursor.remove());
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

  await focusMarkdownEditor(secondPage);
  await secondPage.locator(".cm-content").click();
  await secondPage.keyboard.press("ControlOrMeta+End");
  await secondPage.keyboard.press("Enter");
  await secondPage.keyboard.insertText("Second browser edit");
  const expectedLines = ["Room sync checkSecond line", longParagraph, "Second browser edit"];
  await waitForEditorLines(secondPage, expectedLines, 12_000);
  await waitForEditorLines(firstPage, expectedLines, 12_000);
  const firstPageText = await getEditorDocumentText(firstPage);
  const secondPageText = await getEditorDocumentText(secondPage);
  expect(
    firstPageText === secondPageText && firstPageText === expectedLines.join("\n"),
    "Two live browsers should converge to byte-level identical Markdown after remote edits.",
  );

  try {
    await firstPage.waitForSelector(".cm-ySelectionCaret", { state: "attached", timeout: 8_000 });
    await firstPage.waitForSelector(".cm-ySelectionInfo", { state: "attached", timeout: 8_000 });
    const remoteCursorLayout = await firstPage.evaluate(() => {
      const cursor = document.querySelector(".cm-ySelectionCaret");
      const label = document.querySelector(".cm-ySelectionInfo");
      const cursorStyle = cursor instanceof HTMLElement ? getComputedStyle(cursor) : null;
      const labelStyle = label instanceof HTMLElement ? getComputedStyle(label) : null;
      const remoteAvatar = document.querySelector(".sharing-presence .avatar:not(.self)");
      const remoteAvatarStyle = remoteAvatar instanceof HTMLElement ? getComputedStyle(remoteAvatar) : null;
      const cursorRect = cursor instanceof HTMLElement ? cursor.getBoundingClientRect() : null;
      return {
        cursorWidth: cursorRect?.width ?? -1,
        cursorDisplay: cursorStyle?.display ?? "",
        cursorMarginLeft: cursorStyle?.marginLeft ?? "",
        cursorMarginRight: cursorStyle?.marginRight ?? "",
        labelPosition: labelStyle?.position ?? "",
        labelZIndex: labelStyle?.zIndex ?? "",
        labelBackground: labelStyle?.backgroundColor ?? "",
        labelColor: labelStyle?.color ?? "",
        remoteAvatarBackground: remoteAvatarStyle?.backgroundColor ?? "",
        remoteLineCount: document.querySelectorAll(".cm-yLineSelection").length,
      };
    });
    expect(
      remoteCursorLayout.cursorWidth <= 2 &&
        remoteCursorLayout.cursorMarginLeft === "-1px" &&
        remoteCursorLayout.cursorMarginRight === "-1px",
      "Remote cursor marker should not consume editor text width or move Markdown text.",
    );
    expect(remoteCursorLayout.cursorDisplay === "inline", "Remote cursor marker should stay inline with text.");
    expect(remoteCursorLayout.labelPosition === "absolute", "Remote cursor label should not affect line layout.");
    expect(Number(remoteCursorLayout.labelZIndex) >= 1, "Remote cursor label should render above editor text.");
    expect(
      remoteCursorLayout.labelBackground === remoteCursorLayout.remoteAvatarBackground &&
        remoteCursorLayout.labelBackground !== "rgba(0, 0, 0, 0)",
      "Remote cursor labels should use the participant color in light and dark themes.",
    );
    expect(remoteCursorLayout.labelColor === "rgb(255, 255, 255)", "Remote cursor names should remain readable on participant colors.");
    expect(remoteCursorLayout.remoteLineCount === 0, "Remote cursor should not add a line-level presence rail.");
  } catch (error) {
    const remotePresenceDebug = await firstPage.evaluate(() => ({
      collaboratorAvatars: document.querySelectorAll(".sharing-presence .avatar:not(.self)").length,
      remoteCursorCount: document.querySelectorAll(".cm-ySelectionCaret").length,
      remoteLineCount: document.querySelectorAll(".cm-yLineSelection").length,
      remoteSelectionCount: document.querySelectorAll(".cm-ySelection").length,
      presenceText: document.querySelector(".sharing-presence")?.textContent ?? "",
      collaboratorLabels: Array.from(document.querySelectorAll(".sharing-presence .avatar:not(.self)")).map(
        (avatar) => avatar.getAttribute("aria-label") ?? "",
      ),
      editorText: Array.from(document.querySelectorAll(".cm-content .cm-line")).map(
        (line) => line.textContent ?? "",
      ),
    }));
    throw new Error(
      `Timed out waiting for remote cursor.\n${JSON.stringify(remotePresenceDebug, null, 2)}\n${error.message}`,
    );
  }

  await focusMarkdownEditor(firstPage);
  await firstPage.locator(".cm-content").click();
  await firstPage.keyboard.press("ControlOrMeta+Home");
  await firstPage.keyboard.insertText("Local cursor map prefix");
  await firstPage.keyboard.press("Enter");
  const remappedExpectedLines = ["Local cursor map prefix", ...expectedLines];
  await waitForEditorLines(firstPage, remappedExpectedLines, 4_000);
  await waitForEditorLines(secondPage, remappedExpectedLines, 12_000);
  await firstPage.waitForSelector(".cm-ySelectionCaret", { state: "attached" });

  return remappedExpectedLines.join("\n");
}

async function runLiveWorkspaceDocumentCreationSmoke({
  expect,
  firstPage,
  secondPage,
  focusMarkdownEditor,
  waitForEditorReady,
  waitForText,
}) {
  await firstPage.locator(".add-tab-button").click();
  await firstPage.waitForFunction(() => {
    const activeTab = document.querySelector(".tab-item.active");
    return activeTab && Boolean(activeTab.getAttribute("data-room-id")) && activeTab.getAttribute("data-file-name") !== "README.md";
  });
  const createdFileName = await firstPage.locator(".tab-item.active").getAttribute("data-file-name");
  const createdFileId = await firstPage.locator(".tab-item.active").getAttribute("data-file-id");
  expect(Boolean(createdFileName), "Creating a document during live collaboration should keep a named active tab.");
  expect(Boolean(createdFileId), "Creating a document during live collaboration should keep a stable file id.");
  await waitForRightPanelFile(secondPage, createdFileName, 12_000);
  expect(
    (await secondPage.locator(`.tab-item[data-file-name="${createdFileName}"]`).count()) === 0,
    "A document created by another participant should appear in Files without opening a tab.",
  );
  await openFileFromRightPanel(secondPage, createdFileName);
  await secondPage.waitForSelector(`.tab-item.active[data-file-name="${createdFileName}"]`);
  await waitForEditorReady(secondPage, { mode: "edit" });
  await focusMarkdownEditor(firstPage);
  await wait(250);
  const visibleEmptyDocumentRemoteCursors = await secondPage.locator(".cm-ySelectionCaret").evaluateAll(
    (cursors) => cursors.filter((cursor) => getComputedStyle(cursor).display !== "none").length,
  );
  expect(
    visibleEmptyDocumentRemoteCursors === 0,
    "An empty document should not draw a remote cursor or name over the placeholder.",
  );
  await firstPage.keyboard.insertText("New live document body");
  await waitForText(secondPage.locator(".cm-content"), "New live document body", 12_000);

  await focusMarkdownEditor(secondPage);
  await secondPage.keyboard.press("ControlOrMeta+End");
  await secondPage.keyboard.press("Enter");
  await secondPage.keyboard.insertText("Second browser writes live document");
  await waitForText(firstPage.locator(".cm-content"), "Second browser writes live document", 12_000);

  const renamedFileName = "Live Workspace Smoke.md";
  await openRightFileMenu(firstPage, createdFileName);
  await firstPage.getByRole("menuitem", { name: "Rename" }).click();
  await firstPage.getByRole("textbox", { name: `Rename ${createdFileName} in Files` }).fill("Live Workspace Smoke");
  await firstPage.keyboard.press("Enter");
  await waitForTabByFileName(firstPage, renamedFileName);
  await waitForTabByFileName(secondPage, renamedFileName, 12_000);
  await secondPage.waitForFunction(
    ({ createdFileName, renamedFileName }) =>
      !document.querySelector(`.tab-item[data-file-name="${createdFileName}"]`) &&
      Boolean(document.querySelector(`.tab-item[data-file-name="${renamedFileName}"].active`)),
    { createdFileName, renamedFileName },
    { timeout: 12_000 },
  );

  await openRightFileMenu(firstPage, renamedFileName);
  await firstPage.getByRole("menuitem", { name: "Delete" }).click();
  try {
    await firstPage.waitForFunction(
      ({ createdFileId }) => !document.querySelector(`.tab-item[data-file-id="${createdFileId}"]`),
      { createdFileId },
      { timeout: 12_000 },
    );
  } catch (error) {
    const localDeleteState = await getTabDiagnostics(firstPage);
    throw new Error(
      `Timed out waiting for local live document delete.\n${JSON.stringify(localDeleteState, null, 2)}\n${error.message}`,
    );
  }
  try {
    await secondPage.waitForFunction(
      ({ createdFileId }) =>
        !document.querySelector(`.tab-item[data-file-id="${createdFileId}"]`) &&
        Boolean(document.querySelector(`.tab-item.active:not([data-file-id="${createdFileId}"])`)),
      { createdFileId },
      { timeout: 12_000 },
    );
  } catch (error) {
    const localDeleteState = await getTabDiagnostics(firstPage);
    const remoteDeleteState = await getTabDiagnostics(secondPage);
    throw new Error(
      `Timed out waiting for remote active document fallback after live delete.\nDeleted target: ${createdFileName} (${createdFileId}) -> ${renamedFileName}\nLocal:\n${JSON.stringify(localDeleteState, null, 2)}\nRemote:\n${JSON.stringify(remoteDeleteState, null, 2)}\n${error.message}`,
    );
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openFilesPanel(page) {
  if ((await page.locator(".right-panel").count()) === 0) {
    await page.getByRole("button", { name: "Toggle side panel" }).click();
  }
  if ((await page.getByRole("button", { name: "Files", exact: true }).count()) > 0) {
    await page.getByRole("button", { name: "Files", exact: true }).click();
  }
}

async function waitForRightPanelFile(page, fileName, timeout = 8_000) {
  await openFilesPanel(page);
  await page.getByRole("button", { name: `Open ${fileName}` }).waitFor({ state: "visible", timeout });
}

async function openFileFromRightPanel(page, fileName) {
  await waitForRightPanelFile(page, fileName);
  await page.getByRole("button", { name: `Open ${fileName}` }).click();
}

async function openRightFileMenu(page, fileName) {
  await openFilesPanel(page);
  await page.getByRole("button", { name: `Open ${fileName}` }).hover();
  await page.getByRole("button", { name: `More actions for ${fileName}` }).click();
}

async function getTabDiagnostics(page) {
  return page.evaluate(() => ({
    activeTab: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
    bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 800) ?? "",
    tabs: Array.from(document.querySelectorAll(".tab-item")).map((tab) => ({
      className: tab.className,
      fileId: tab.getAttribute("data-file-id"),
      fileName: tab.getAttribute("data-file-name"),
      roomId: tab.getAttribute("data-room-id"),
      text: tab.textContent,
    })),
    url: window.location.href,
  }));
}
