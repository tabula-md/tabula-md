export const id = "collaboration-editor-torture";
export const description = "Deterministic live collaboration editor torture smoke.";

const longParagraph = Array.from({ length: 120 }, (_, index) => `long-segment-${index + 1}`).join(" ");

const getEditorLines = async (page) =>
  page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll(".cm-remote-cursor").forEach((cursor) => cursor.remove());
      return clone.textContent ?? "";
    }),
  );

const getEditorText = async (page) => (await getEditorLines(page)).join("\n");

const waitForEditorText = async (page, expectedText, timeout = 12_000) => {
  try {
    await page.waitForFunction(
      ({ expectedText }) => {
        const lines = Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => {
          const clone = line.cloneNode(true);
          clone.querySelectorAll(".cm-remote-cursor").forEach((cursor) => cursor.remove());
          return clone.textContent ?? "";
        });
        return lines.join("\n") === expectedText;
      },
      { expectedText },
      { timeout },
    );
  } catch (error) {
    throw new Error(
      `Timed out waiting for editor text.\nExpected: ${JSON.stringify(expectedText)}\nActual: ${JSON.stringify(await getEditorText(page))}\n${error.message}`,
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

const startLiveSession = async ({ baseUrl, firstPage, secondPage, waitForEditorReady }) => {
  await firstPage.goto(baseUrl);
  await firstPage.waitForSelector(".tabbar");
  await firstPage.getByTitle("New tab").click();
  await waitForEditorReady(firstPage, { mode: "edit" });
  await firstPage.locator(".share-trigger").click();
  await firstPage.getByRole("button", { name: "Start session" }).click();
  await firstPage.waitForSelector(".tab-item.live.active");
  await firstPage.waitForSelector(".sharing-presence");
  const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
  await firstPage.getByRole("button", { name: "Close share dialog" }).click();

  const roomUrl = new URL(shareUrl);
  await secondPage.goto(`${baseUrl}${roomUrl.pathname}${roomUrl.hash}`);
  await secondPage.waitForSelector(".tab-item.live.active");
  await ensureEditMode(firstPage, waitForEditorReady);
  await ensureEditMode(secondPage, waitForEditorReady);
};

const toggleLineWrapping = async (page) => {
  await page.getByRole("button", { name: "Editor controls", exact: true }).click();
  await page.getByRole("button", { name: "Line Wrapping" }).click();
};

const assertConverged = async ({ expect, firstPage, secondPage, expectedText }) => {
  await waitForEditorText(firstPage, expectedText);
  await waitForEditorText(secondPage, expectedText);
  expect(
    (await getEditorText(firstPage)) === (await getEditorText(secondPage)),
    "Live editors should converge to byte-level identical Markdown.",
  );
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
  await firstPage.waitForSelector(".cm-remote-selection", { state: "attached", timeout: 8_000 });
  expect(
    (await getEditorText(firstPage)) === alternatingSecond,
    "Remote selection movement should not mutate Markdown text.",
  );

  await toggleLineWrapping(firstPage);
  await toggleLineWrapping(secondPage);
  await assertConverged({ expect, firstPage, secondPage, expectedText: alternatingSecond });

  return alternatingSecond;
};

const runOptionalSoak = async ({ expect, firstPage, secondPage, focusMarkdownEditor, expectedText }) => {
  const soakMs = Number(process.env.TABULA_COLLAB_TORTURE_SOAK_MS ?? 0);
  if (!Number.isFinite(soakMs) || soakMs <= 0) {
    return expectedText;
  }

  let currentText = expectedText;
  const deadline = Date.now() + soakMs;
  let index = 0;

  while (Date.now() < deadline) {
    const page = index % 2 === 0 ? firstPage : secondPage;
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+End");
    const token = ` soak-${index + 1}`;
    await page.keyboard.insertText(token);
    currentText += token;
    await assertConverged({ expect, firstPage, secondPage, expectedText: currentText });
    index += 1;
  }

  return currentText;
};

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
  } = ctx;
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await startLiveSession({ baseUrl, firstPage, secondPage, waitForEditorReady });
    const expectedText = await runDeterministicEditorTorture({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
    });
    await runOptionalSoak({
      expect,
      firstPage,
      secondPage,
      focusMarkdownEditor,
      expectedText,
    });
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}
