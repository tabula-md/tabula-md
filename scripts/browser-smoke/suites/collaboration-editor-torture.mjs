import {
  buildLargeEditorMarkdown,
  buildOneMegabyteEditorMarkdown,
} from "../support/editor-fixtures.mjs";

export const id = "collaboration-editor-torture";
export const requiresRoomService = true;
export const description = "Deterministic live collaboration editor torture smoke.";

const longParagraph = Array.from({ length: 120 }, (_, index) => `long-segment-${index + 1}`).join(" ");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const LARGE_COLLAB_DOC_TARGET_BYTES = 150_000;

const getByteLength = (value) => new TextEncoder().encode(value).byteLength;

const buildLargeCollaborationMarkdown = () => {
  const seed = buildLargeEditorMarkdown({ sections: 70, paragraphRepeats: 2 });
  const chunks = [];
  let byteLength = 0;
  let index = 0;

  while (byteLength < LARGE_COLLAB_DOC_TARGET_BYTES) {
    const chunk = `\n\n<!-- collab-large-${index + 1} -->\n\n${seed}`;
    chunks.push(chunk);
    byteLength += getByteLength(chunk);
    index += 1;
  }

  return chunks.join("").trimStart();
};

const getInitialSoakDocument = () => {
  const size = (process.env.TABULA_COLLAB_TORTURE_DOC_SIZE ?? "").toLowerCase();
  if (size === "150kb" || size === "large") {
    return buildLargeCollaborationMarkdown();
  }
  if (size === "1mb") {
    return buildOneMegabyteEditorMarkdown();
  }
  return null;
};

const getEditorStateText = async (page) =>
  page.evaluate(() => {
    const content = document.querySelector(".cm-content");
    const view = content?.cmView?.view ?? content?.cmTile?.view;
    const docText = view?.state?.doc?.toString?.();
    return typeof docText === "string" ? docText : null;
  });

const getVisibleEditorLines = async (page) =>
  page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll(".cm-ySelectionCaret").forEach((cursor) => cursor.remove());
      return clone.textContent ?? "";
    }),
  );

const getEditorText = async (page) => (await getEditorStateText(page)) ?? (await getVisibleEditorLines(page)).join("\n");

const getPageDiagnostics = async (page) =>
  page.evaluate(() => ({
    url: window.location.href,
    bodyTextPrefix: document.body?.textContent?.slice(0, 240) ?? "",
    cmContentCount: document.querySelectorAll(".cm-content").length,
    fileShellClass: document.querySelector(".file-shell")?.className ?? null,
    activeTab: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? null,
    liveStatus: document.querySelector(".status-save-state")?.textContent?.trim() ?? null,
  }));

const getTextFingerprint = (text) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return {
    hash,
    length: text.length,
    prefix: text.slice(0, 80),
    suffix: text.slice(-160),
  };
};

const waitForEditorText = async (page, expectedText, timeout = 12_000, label = "editor") => {
  const expectedFingerprint = getTextFingerprint(expectedText);
  try {
    await page.waitForFunction(
      ({ expectedFingerprint }) => {
        const getFingerprint = (text) => {
          let hash = 2166136261;
          for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619) >>> 0;
          }
          return {
            hash,
            length: text.length,
          };
        };
        const content = document.querySelector(".cm-content");
        const view = content?.cmView?.view ?? content?.cmTile?.view;
        const docText = view?.state?.doc?.toString?.();
        if (typeof docText === "string") {
          const fingerprint = getFingerprint(docText);
          return fingerprint.length === expectedFingerprint.length && fingerprint.hash === expectedFingerprint.hash;
        }

        const lines = Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => {
          const clone = line.cloneNode(true);
          clone.querySelectorAll(".cm-ySelectionCaret").forEach((cursor) => cursor.remove());
          return clone.textContent ?? "";
        });
        const fingerprint = getFingerprint(lines.join("\n"));
        return fingerprint.length === expectedFingerprint.length && fingerprint.hash === expectedFingerprint.hash;
      },
      { expectedFingerprint },
      { timeout },
    );
  } catch (error) {
    const actualText = await getEditorText(page).catch(() => "");
    const diagnostics = await getPageDiagnostics(page).catch((diagnosticError) => ({
      diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
    }));
    throw new Error(
      `Timed out waiting for ${label} text.\nExpected: ${JSON.stringify(expectedFingerprint)}\nActual: ${JSON.stringify(getTextFingerprint(actualText))}\nDiagnostics: ${JSON.stringify(diagnostics)}\n${error.message}`,
    );
  }
};

const ensureEditMode = async (page, waitForEditorReady) => {
  const editButton = page.getByRole("button", { name: "Edit", exact: true });
  if ((await editButton.count()) > 0) {
    await editButton.click();
  }
  await waitForEditorReady(page, { mode: "edit" });
};

const selectRoomDocument = async (page, fileName, waitForEditorReady) => {
  const tab = page.locator(`.tab-item[data-file-name="${fileName}"] .tab-select-button`);
  if ((await tab.count()) === 1) {
    await tab.click();
  } else {
    const toggleSidePanel = page.getByRole("button", { name: "Toggle side panel" });
    if ((await toggleSidePanel.count()) === 1) await toggleSidePanel.click();
    const filesTab = page.getByRole("button", { name: "Files", exact: true });
    if ((await filesTab.count()) === 1) await filesTab.click();
    await page.getByRole("button", { name: `Open ${fileName}` }).click();
  }
  await page.waitForFunction(
    ({ targetFileName }) =>
      document.querySelector(".tab-item.active")?.getAttribute("data-file-name") === targetFileName,
    { targetFileName: fileName },
  );
  await ensureEditMode(page, waitForEditorReady);
};

const startLiveSession = async ({ baseUrl, firstPage, secondPage, waitForEditorReady }) => {
  await firstPage.goto(baseUrl);
  await firstPage.waitForSelector(".tabbar");
  await firstPage.getByRole("button", { name: "New document", exact: true }).click();
  await waitForEditorReady(firstPage, { mode: "edit" });
  const targetFileName = await firstPage.locator(".tab-item.active").getAttribute("data-file-name");
  if (!targetFileName) {
    throw new Error("The collaboration torture target document was not available.");
  }
  await firstPage.locator(".share-trigger").click();
  await firstPage.getByRole("button", { name: "Start session" }).click();
  await firstPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
  await firstPage.waitForSelector(".sharing-presence");
  const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
  await firstPage.getByRole("button", { name: "Close share dialog" }).click();

  const roomUrl = new URL(shareUrl);
  await secondPage.goto(`${baseUrl}${roomUrl.pathname}${roomUrl.hash}`);
  await secondPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
  await ensureEditMode(firstPage, waitForEditorReady);
  await selectRoomDocument(secondPage, targetFileName, waitForEditorReady);
  await firstPage.waitForFunction(
    () => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 1,
    undefined,
    { timeout: 15_000 },
  );
  await secondPage.waitForFunction(
    () => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 1,
    undefined,
    { timeout: 15_000 },
  );

  return { sharedPath: roomUrl.pathname + roomUrl.hash, targetFileName };
};

const toggleLineWrapping = async (page) => {
  await page.getByRole("button", { name: "Editor controls", exact: true }).click();
  await page.getByRole("button", { name: "Line Wrapping" }).click();
};

const assertConverged = async ({ expect, firstPage, secondPage, expectedText, timeout }) => {
  await waitForEditorText(firstPage, expectedText, timeout, "first editor");
  await waitForEditorText(secondPage, expectedText, timeout, "second editor");
  expect(
    (await getEditorText(firstPage)) === (await getEditorText(secondPage)),
    "Live editors should converge to byte-level identical Markdown.",
  );
};

const assertAllConverged = async ({ expect, pages, expectedText, timeout }) => {
  for (const [index, page] of pages.entries()) {
    await waitForEditorText(page, expectedText, timeout, `editor ${index + 1}`);
  }

  const fingerprints = await Promise.all(pages.map(async (page) => getTextFingerprint(await getEditorText(page))));
  const expectedFingerprint = getTextFingerprint(expectedText);
  expect(
    fingerprints.every(
      (fingerprint) =>
        fingerprint.length === expectedFingerprint.length && fingerprint.hash === expectedFingerprint.hash,
    ),
    "All live editors should converge to byte-level identical Markdown.",
  );
};

const replaceEditorDocumentText = async (page, text) => {
  await page.evaluate((text) => {
    const content = document.querySelector(".cm-content");
    const view = content?.cmView?.view ?? content?.cmTile?.view;
    if (!view?.dispatch) {
      throw new Error("CodeMirror view was not available for collaboration fixture setup.");
    }
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: text,
      },
    });
  }, text);
};

const enableSplitMode = async (page, waitForEditorReady) => {
  const splitButton = page.getByRole("button", { name: "Split", exact: true });
  if ((await splitButton.count()) > 0) {
    await splitButton.click();
  }
  await waitForEditorReady(page, { mode: "split" });
};

const prepareLargeSoakDocument = async ({
  expect,
  firstPage,
  focusMarkdownEditor,
  waitForEditorReady,
  pages,
}) => {
  const initialDocument = getInitialSoakDocument();
  if (!initialDocument) {
    return null;
  }

  await focusMarkdownEditor(firstPage);
  await replaceEditorDocumentText(firstPage, initialDocument);
  await assertAllConverged({
    expect,
    pages,
    expectedText: initialDocument,
    timeout: Number(process.env.TABULA_COLLAB_TORTURE_INITIAL_SYNC_TIMEOUT_MS ?? 60_000),
  });

  if (process.env.TABULA_COLLAB_TORTURE_SPLIT === "1") {
    for (const page of pages) {
      await enableSplitMode(page, waitForEditorReady);
    }
  }

  console.log(
    `[collab-soak] initialDocBytes=${getByteLength(initialDocument)} initialDocLines=${initialDocument.split("\n").length}`,
  );
  return initialDocument;
};

const runDeterministicEditorTorture = async ({
  expect,
  firstPage,
  secondPage,
  focusMarkdownEditor,
}) => {
  await focusMarkdownEditor(firstPage);
  await firstPage.keyboard.press("ControlOrMeta+A");
  await firstPage.keyboard.insertText("Torture start");
  await assertConverged({ expect, firstPage, secondPage, expectedText: "Torture start" });

  await firstPage.keyboard.press("Enter");
  await firstPage.keyboard.insertText("line merge target");
  await assertConverged({
    expect,
    firstPage,
    secondPage,
    expectedText: "Torture start\nline merge target",
  });

  await firstPage.keyboard.press("Backspace");
  await assertConverged({
    expect,
    firstPage,
    secondPage,
    expectedText: "Torture start\nline merge targe",
  });
  await firstPage.keyboard.insertText("t");

  for (let index = 0; index < "line merge target".length; index += 1) {
    await firstPage.keyboard.press("ArrowLeft");
  }
  await firstPage.keyboard.press("Backspace");
  await assertConverged({
    expect,
    firstPage,
    secondPage,
    expectedText: "Torture startline merge target",
  });

  await firstPage.keyboard.press("ControlOrMeta+End");
  await firstPage.keyboard.press("Enter");
  await firstPage.keyboard.insertText(longParagraph);
  const paragraphText = `Torture startline merge target\n${longParagraph}`;
  await assertConverged({ expect, firstPage, secondPage, expectedText: paragraphText });

  await focusMarkdownEditor(secondPage);
  await secondPage.keyboard.press("ControlOrMeta+Z");
  await assertConverged({ expect, firstPage, secondPage, expectedText: paragraphText });

  await secondPage.keyboard.press("ControlOrMeta+End");
  await secondPage.keyboard.insertText(" undo-redo-token");
  const undoRedoText = `${paragraphText} undo-redo-token`;
  await assertConverged({ expect, firstPage, secondPage, expectedText: undoRedoText });
  await secondPage.keyboard.press("ControlOrMeta+Z");
  await assertConverged({ expect, firstPage, secondPage, expectedText: paragraphText });
  await secondPage.keyboard.press("ControlOrMeta+Shift+Z");
  await assertConverged({ expect, firstPage, secondPage, expectedText: undoRedoText });

  await focusMarkdownEditor(firstPage);
  await firstPage.keyboard.press("ControlOrMeta+End");
  await firstPage.keyboard.insertText(" A");
  const alternatingFirst = `${undoRedoText} A`;
  await assertConverged({ expect, firstPage, secondPage, expectedText: alternatingFirst });
  await focusMarkdownEditor(secondPage);
  await secondPage.keyboard.press("ControlOrMeta+End");
  await secondPage.keyboard.insertText(" B");
  const alternatingSecond = `${alternatingFirst} B`;
  await assertConverged({ expect, firstPage, secondPage, expectedText: alternatingSecond });

  await secondPage.keyboard.press("ControlOrMeta+A");
  await firstPage.waitForSelector(".cm-ySelection", { state: "attached", timeout: 8_000 });
  expect(
    (await getEditorText(firstPage)) === alternatingSecond,
    "Remote selection movement should not mutate Markdown text.",
  );

  await toggleLineWrapping(firstPage);
  await toggleLineWrapping(secondPage);
  await assertConverged({ expect, firstPage, secondPage, expectedText: alternatingSecond });

  return alternatingSecond;
};

const runOptionalSoak = async ({ expect, pages, focusMarkdownEditor, expectedText }) => {
  const soakMs = Number(process.env.TABULA_COLLAB_TORTURE_SOAK_MS ?? 0);
  if (!Number.isFinite(soakMs) || soakMs <= 0) {
    return expectedText;
  }
  const soakIntervalMs = Math.max(0, Number(process.env.TABULA_COLLAB_TORTURE_SOAK_INTERVAL_MS ?? 1000));
  const soakIterationTimeoutMs = Math.max(
    5_000,
    Number(process.env.TABULA_COLLAB_TORTURE_ITERATION_TIMEOUT_MS ?? 20_000),
  );
  const progressIntervalMs = Math.max(10_000, Number(process.env.TABULA_COLLAB_TORTURE_PROGRESS_MS ?? 60_000));
  const checkpointInterval = Math.max(0, Number(process.env.TABULA_COLLAB_TORTURE_CHECKPOINT_INTERVAL ?? 300));
  const writerSwitchInterval = Math.max(1, Number(process.env.TABULA_COLLAB_TORTURE_WRITER_SWITCH_INTERVAL ?? 30));

  let currentText = expectedText;
  const startedAt = Date.now();
  const deadline = startedAt + soakMs;
  let lastProgressAt = startedAt;
  let index = 0;
  let currentWriterPage = null;

  while (Date.now() < deadline) {
    const iterationStartedAt = Date.now();
    const nextIndex = index + 1;
    await Promise.race([
      (async () => {
        const page = pages[Math.floor(index / writerSwitchInterval) % pages.length];
        if (page !== currentWriterPage) {
          currentWriterPage = page;
          await focusMarkdownEditor(page);
          await page.keyboard.press("ControlOrMeta+End");
        }
        if (checkpointInterval > 0 && nextIndex % checkpointInterval === 0) {
          currentText = `Soak checkpoint ${nextIndex}\nThis document is intentionally compacted during the long-running collaboration soak.`;
          await page.keyboard.press("ControlOrMeta+A");
          await page.keyboard.insertText(currentText);
        } else if (nextIndex % 40 === 0) {
          await page.keyboard.press("Enter");
          const token = `soak-line-${nextIndex}`;
          await page.keyboard.insertText(token);
          currentText += `\n${token}`;
        } else {
          const token = ` soak-${nextIndex}`;
          await page.keyboard.insertText(token);
          currentText += token;
        }
        await assertAllConverged({
          expect,
          pages,
          expectedText: currentText,
          timeout: soakIterationTimeoutMs,
        });
      })(),
      delay(soakIterationTimeoutMs + 5_000).then(() => {
        throw new Error(`Collaboration soak iteration ${nextIndex} exceeded ${soakIterationTimeoutMs}ms.`);
      }),
    ]);
    index += 1;
    if (Date.now() - lastProgressAt >= progressIntervalMs) {
      console.log(
        `[collab-soak] elapsedMs=${Date.now() - startedAt} iterations=${index} textLength=${currentText.length}`,
      );
      lastProgressAt = Date.now();
    }
    const remainingIntervalMs = soakIntervalMs - (Date.now() - iterationStartedAt);
    if (remainingIntervalMs > 0) {
      if (Date.now() + remainingIntervalMs >= deadline) {
        break;
      }
      await delay(remainingIntervalMs);
    }
  }

  console.log(`[collab-soak] completed elapsedMs=${Date.now() - startedAt} iterations=${index} textLength=${currentText.length}`);
  return currentText;
};

const closeContextWithTimeout = async (context) => {
  await Promise.race([
    context.close(),
    delay(5_000).then(() => {
      throw new Error("Timed out closing collaboration soak browser context.");
    }),
  ]);
};

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
  } = ctx;
  const peerCount = Math.max(
    2,
    Math.min(5, Number(process.env.TABULA_COLLAB_TORTURE_PEER_COUNT ?? 2) || 2),
  );
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const extraPeerContexts = [];
  const extraPeerPages = [];
  let primaryContextsClosed = false;
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    const { sharedPath, targetFileName } = await startLiveSession({
      baseUrl,
      firstPage,
      secondPage,
      waitForEditorReady,
    });
    for (let peerIndex = 3; peerIndex <= peerCount; peerIndex += 1) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      extraPeerContexts.push(context);
      extraPeerPages.push(page);
      await page.goto(`${baseUrl}${sharedPath}`);
      await page.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
      await selectRoomDocument(page, targetFileName, waitForEditorReady);
    }
    const pages = [firstPage, secondPage, ...extraPeerPages];
    if (peerCount > 2) {
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            ({ expectedPeers }) =>
              document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= expectedPeers - 1,
            { expectedPeers: peerCount },
            { timeout: 15_000 },
          ),
        ),
      );
      const baselineText = await getEditorText(firstPage);
      await assertAllConverged({
        expect,
        pages,
        expectedText: baselineText,
        timeout: 30_000,
      });
    }

    let expectedText = await runDeterministicEditorTorture({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
    });
    const largeInitialText = await prepareLargeSoakDocument({
      expect,
      firstPage,
      focusMarkdownEditor,
      waitForEditorReady,
      pages,
    });
    if (largeInitialText) {
      expectedText = largeInitialText;
    }

    const finalText = await runOptionalSoak({
      expect,
      pages,
      focusMarkdownEditor,
      expectedText,
    });
    await assertAllConverged({
      expect,
      pages,
      expectedText: finalText,
      timeout: Number(process.env.TABULA_COLLAB_TORTURE_FINAL_SYNC_TIMEOUT_MS ?? 60_000),
    });
    if (process.env.TABULA_COLLAB_TORTURE_VERIFY_REENTRY === "1") {
      await Promise.all(extraPeerContexts.map(closeContextWithTimeout));
      extraPeerContexts.length = 0;
      await Promise.all([closeContextWithTimeout(firstContext), closeContextWithTimeout(secondContext)]);
      primaryContextsClosed = true;
      const recoveryContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      try {
        const recoveryPage = await recoveryContext.newPage();
        await recoveryPage.goto(`${baseUrl}${sharedPath}`);
        await recoveryPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
        await selectRoomDocument(recoveryPage, targetFileName, waitForEditorReady);
        await waitForEditorText(recoveryPage, finalText, 60_000, "reopened recovery editor");
      } finally {
        await closeContextWithTimeout(recoveryContext);
      }
      return;
    }
  } finally {
    await Promise.all([
      ...extraPeerContexts.map(closeContextWithTimeout),
      ...(primaryContextsClosed ? [] : [closeContextWithTimeout(firstContext), closeContextWithTimeout(secondContext)]),
    ]);
  }
}
