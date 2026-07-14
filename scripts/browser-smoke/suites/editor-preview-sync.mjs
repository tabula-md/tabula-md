export const id = "editor-preview-sync";
export const description = "Split preview scroll ownership and source-anchor follow behavior.";

const FRONTMATTER_SYNC_FIXTURE = [
  "---",
  "title: Frontmatter Sync",
  "status: Draft",
  "owner: Product",
  "---",
  "",
  "# Body Start",
  "",
  ...Array.from({ length: 42 }, (_, index) => `Body paragraph ${index + 1}.`),
].join("\n\n");

const createLongScrollTransferFixture = () => {
  const lines = [
    "---",
    "title: Long Transfer Fixture",
    "status: Draft",
    "owner: Editor QA",
    "---",
    "",
    "# Documentation",
    "",
  ];

  for (let index = lines.length + 1; index <= 3168; index += 1) {
    if (index % 137 === 0) {
      lines.push("| Option | Value |", "| --- | --- |", `| transfer-${index} | ${index} |`);
      continue;
    }

    if (index % 89 === 0) {
      lines.push("```html", `<div data-line="${index}">virtual block ${index}</div>`, "```");
      continue;
    }

    if (index % 61 === 0) {
      lines.push(`<hr data-sidebar-group="Group ${index}" />`);
      continue;
    }

    if (index % 41 === 0) {
      lines.push(`## Section ${index}`);
      continue;
    }

    if (index % 17 === 0) {
      lines.push("", `- list item ${index}`, `- list item ${index + 1}`);
      continue;
    }

    lines.push(`Long transfer paragraph line ${index}.`);
  }

  lines.push(
    "### Config keys",
    "",
    "| Key | Description |",
    "| --- | --- |",
    "| `htmx.config.defaultSwap` | default swap behavior |",
    "| `htmx.config.implicitInheritance` | inherited attributes behavior |",
    "",
    "You can set most options directly in JavaScript, or you can use a `meta` tag.",
    "",
    "> **Note:** Some options are read only once during initialization.",
    "",
    "```html",
    "<meta name=\"htmx-config\" content='{\"defaultSwap\":\"innerHTML\"}'>",
    "```",
    "",
    "### Conclusion",
    "",
    "And that's it!",
    "",
    "Have fun with htmx!",
    "",
    "You can accomplish [quite a bit](https://four.htmx.org/patterns) without writing a lot of code!",
    "",
    "<hr data-sidebar-group=\"Editor Support\" />",
    "",
    "## VS Code",
    "",
    "The [HTMX Toolkit](https://marketplace.visualstudio.com/items?itemName=atoolz.htmx-vscode-toolkit) extension adds htmx support to Visual Studio Code with autocomplete, hover documentation, and snippets.",
    "",
    "### Features",
    "",
    "- Attribute autocomplete for all htmx attributes (`hx-get`, `hx-post`, `hx-target`, etc.)",
    "- Hover documentation with links to the official docs",
    "- Snippets for common htmx patterns",
    "- Support for htmx 2.x and 4.x",
    "",
    "### Installing",
    "",
    "Search for **HTMX Toolkit** in the VS Code Extensions panel, or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=atoolz.htmx-vscode-toolkit).",
    "",
    "### Source",
    "",
    "The extension source code is maintained at [atoolz/htmx-vscode-toolkit](https://github.com/atoolz/htmx-vscode-toolkit).",
    "",
    "<style>{`[data-sidebar-group] { display: none; }`}</style>",
  );

  return lines.join("\n");
};

const LONG_SCROLL_TRANSFER_FIXTURE = createLongScrollTransferFixture();

const INLINE_MDX_SCROLL_TRANSFER_FIXTURE = [
  "> ## Documentation Index",
  "> Fetch the complete documentation index at: https://docs.example.test/index",
  "",
  "# X API pay-per-usage pricing and credits",
  "",
  "The X API uses **pay-per-usage** pricing. No subscriptions - pay only for what you use.",
  "",
  "<Button href=\"https://developer.x.com/#pricing\">View pricing & purchase credits</Button>",
  "",
  "***",
  "",
  "## How it works",
  "",
  "<CardGroup cols={2}>",
  "  <Card title=\"Credit-based\" icon=\"coins\">",
  "    Purchase credits upfront in the Developer Console. Credits are deducted as you make API requests.",
  "  </Card>",
  "",
  "  <Card title=\"Per-endpoint pricing\" icon=\"code\">",
  "    Different endpoints have different costs. View current rates in the Developer Console.",
  "  </Card>",
  "",
  "  <Card title=\"No commitments\" icon=\"unlock\">",
  "    No contracts, subscriptions, or minimum spend. Start and stop anytime.",
  "  </Card>",
  "",
  "  <Card title=\"Real-time tracking\" icon=\"gauge-high\">",
  "    Monitor usage and costs live in the Developer Console.",
  "  </Card>",
  "</CardGroup>",
  "",
  "<Tip>",
  "  Earn free [xAI API](https://docs.x.ai) credits when you purchase X API credits - up to 20% back based on your spend.",
  "</Tip>",
  "",
  "***",
  "",
  "## Credit consumption details",
  "",
  "All prices are per resource fetched or per request. Purchase credits in the Developer Console.",
  "",
  "### Read operations",
  "",
  "Charged per resource returned in the response.",
  "",
  "| Resource | Unit cost |",
  "| :--- | :--- |",
  "| **Posts: Read** | $0.005 per resource |",
  "| **User: Read** | $0.010 per resource |",
  "| **Search: Read** | $0.020 per resource |",
  "",
  "### Write operations",
  "",
  "Charged per request.",
  "",
  "| Operation | Unit cost |",
  "| :--- | :--- |",
  "| **Post: Create** | $0.050 per request |",
  "| **Post: Delete** | $0.020 per request |",
  "",
  ...Array.from({ length: 72 }, (_, index) => `Follow-up pricing note ${index + 1}.`),
].join("\n");

const getFixtureLineNumber = (fixture, text) =>
  fixture.split("\n").findIndex((line) => line.includes(text)) + 1;

const INLINE_MDX_HOW_IT_WORKS_LINE = getFixtureLineNumber(
  INLINE_MDX_SCROLL_TRANSFER_FIXTURE,
  "## How it works",
);
const INLINE_MDX_CREDIT_DETAILS_LINE = getFixtureLineNumber(
  INLINE_MDX_SCROLL_TRANSFER_FIXTURE,
  "## Credit consumption details",
);

const readSplitPreviewState = async (page) =>
  page.evaluate(() => {
    const editorScroller = document.querySelector(".workspace.split .cm-scroller");
    const previewSurface = document.querySelector(".workspace.split .preview-surface");
    const previewDocument = document.querySelector(".workspace.split .preview-document");
    const editorRect = editorScroller?.getBoundingClientRect();
    const visibleEditorLineNumbers =
      editorScroller && editorRect
        ? Array.from(editorScroller.querySelectorAll(".cm-lineNumbers .cm-gutterElement"))
            .map((element) => {
              const lineNumber = Number(element.textContent?.trim());
              if (!Number.isFinite(lineNumber)) {
                return null;
              }

              const rect = element.getBoundingClientRect();
              return {
                lineNumber,
                top: Math.round(rect.top - editorRect.top),
                visible: rect.bottom > editorRect.top && rect.top < editorRect.bottom,
              };
            })
            .filter((entry) => entry?.visible)
            .sort((first, second) => first.top - second.top)
        : [];
    const previewRect = previewSurface?.getBoundingClientRect();
    const visiblePreviewAnchors = previewSurface
      ? Array.from(previewSurface.querySelectorAll("[data-preview-line-start], [data-preview-block-start-line]"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              bottom: Math.round(rect.bottom - (previewRect?.top ?? 0)),
              end: Number(element.getAttribute("data-preview-line-end") ?? element.getAttribute("data-preview-block-end-line")),
              start: Number(element.getAttribute("data-preview-line-start") ?? element.getAttribute("data-preview-block-start-line")),
              text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
              top: Math.round(rect.top - (previewRect?.top ?? 0)),
            };
          })
          .filter((anchor) => anchor.bottom > 0 && anchor.top < previewSurface.clientHeight)
      : [];

    return {
      editorAtEnd: editorScroller
        ? editorScroller.scrollHeight - editorScroller.clientHeight - editorScroller.scrollTop <= 1
        : false,
      editorScrollTop: Math.round(editorScroller?.scrollTop ?? 0),
      editorTopLine: visibleEditorLineNumbers[0]?.lineNumber ?? null,
      previewIndexSource: previewDocument?.getAttribute("data-preview-index-source") ?? null,
      previewMaxScrollTop: previewSurface
        ? Math.round(previewSurface.scrollHeight - previewSurface.clientHeight)
        : 0,
      previewScrollTop: Math.round(previewSurface?.scrollTop ?? 0),
      visiblePreviewAnchors,
    };
  });

const getEditorMaxScrollTop = async (page) =>
  page.evaluate(() => {
    const editorScroller = document.querySelector(".workspace.split .cm-scroller");
    if (!(editorScroller instanceof HTMLElement)) {
      return 0;
    }

    return Math.max(0, editorScroller.scrollHeight - editorScroller.clientHeight);
  });

const getVisiblePreviewSourceRange = (state) => {
  const anchors = state.visiblePreviewAnchors.filter(
    (anchor) => Number.isFinite(anchor.start) && Number.isFinite(anchor.end),
  );
  if (anchors.length === 0) {
    return null;
  }

  return {
    maxEnd: Math.max(...anchors.map((anchor) => anchor.end)),
    minStart: Math.min(...anchors.map((anchor) => anchor.start)),
  };
};

const setEditorScrollTop = async (page, scrollTop) => {
  await page.evaluate((scrollTop) => {
    const editorScroller = document.querySelector(".workspace.split .cm-scroller");
    if (!(editorScroller instanceof HTMLElement)) {
      return;
    }

    editorScroller.scrollTop = scrollTop;
    editorScroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, scrollTop);
};

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    openMarkdownFile,
    openProjectMenu,
    waitForEditorReady,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(FRONTMATTER_SYNC_FIXTURE);
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    await waitForRenderFrame(page);

    const frontmatterEntryState = await readSplitPreviewState(page);
    const frontmatterAnchor = frontmatterEntryState.visiblePreviewAnchors.find((anchor) => anchor.start === 1);
    expect(
      Boolean(frontmatterAnchor) && frontmatterAnchor.text.includes("status") && frontmatterAnchor.top <= 96,
      "Split preview should map source line 1 to the rendered frontmatter block.",
    );

    await setEditorScrollTop(page, 10_000);
    await waitForRenderFrame(page);
    const bodyBottomState = await readSplitPreviewState(page);
    expect(
      bodyBottomState.visiblePreviewAnchors.some((anchor) => anchor.text.includes("Body paragraph")),
      "Frontmatter documents should still follow body source lines after scrolling away from metadata.",
    );

    await setEditorScrollTop(page, 0);
    await waitForRenderFrame(page);
    const frontmatterReturnState = await readSplitPreviewState(page);
    const returnedFrontmatterAnchor = frontmatterReturnState.visiblePreviewAnchors.find((anchor) => anchor.start === 1);
    expect(
      Boolean(returnedFrontmatterAnchor) && returnedFrontmatterAnchor.top <= 96,
      "Split preview should return to the rendered frontmatter block when the editor scrolls back to the top.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openMarkdownFile(page, {
      content: Array.from(
        { length: 48 },
        (_, index) => `## Section ${index + 1}\n\nBody paragraph ${index + 1} for scroll synchronization.`,
      ).join("\n\n"),
    });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await page.waitForSelector(".workspace.preview .preview-surface", { timeout: 5_000 });
    await page.evaluate(() => {
      const previewWorkspace = document.querySelector(".workspace.preview");
      if (previewWorkspace instanceof HTMLElement) {
        previewWorkspace.scrollTop = previewWorkspace.scrollHeight;
        previewWorkspace.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await waitForRenderFrame(page);

    const previewOnlyScrollTop = await page.evaluate(() => {
      const previewWorkspace = document.querySelector(".workspace.preview");
      return previewWorkspace instanceof HTMLElement ? Math.round(previewWorkspace.scrollTop) : 0;
    });
    expect(previewOnlyScrollTop > 0, "Starter README preview should be scrolled before split-entry regression check.");

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    await waitForRenderFrame(page);
    const splitEntryState = await readSplitPreviewState(page);
    const firstEntryAnchor = splitEntryState.visiblePreviewAnchors[0];
    expect(splitEntryState.editorScrollTop <= 1, "Split entry should keep the README editor at the top.");
    expect(
      Boolean(firstEntryAnchor) && firstEntryAnchor.start <= 2 && firstEntryAnchor.top <= 64,
      "Split entry should follow the editor top instead of preserving the previous preview-only scroll.",
    );

    await setEditorScrollTop(page, 10_000);
    await waitForRenderFrame(page);
    const bottomState = await readSplitPreviewState(page);
    expect(bottomState.editorAtEnd, "README editor should be at document end for bottom follow smoke.");
    expect(
      bottomState.visiblePreviewAnchors.some((anchor) => anchor.end >= 21),
      "README split preview should show the final rendered source lines at editor document end.",
    );

    await setEditorScrollTop(page, Math.max(0, bottomState.editorScrollTop - 280));
    await waitForRenderFrame(page);
    const upwardState = await readSplitPreviewState(page);
    expect(upwardState.editorScrollTop < bottomState.editorScrollTop, "README editor should scroll upward from the bottom.");
    expect(
      upwardState.previewScrollTop < bottomState.previewScrollTop || bottomState.previewMaxScrollTop <= 0,
      `README split preview should not remain stuck at the bottom when the editor scrolls upward. ${JSON.stringify({ bottomState, upwardState })}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(INLINE_MDX_SCROLL_TRANSFER_FIXTURE);
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    await waitForRenderFrame(page);
    await page.waitForFunction(() => {
      const previewDocument = document.querySelector(".workspace.split .preview-document");
      return previewDocument?.getAttribute("data-preview-index-source") === "inline";
    });

    const editorMaxScrollTop = await getEditorMaxScrollTop(page);
    expect(editorMaxScrollTop > 0, "Inline MDX fixture should create an editor scroll range.");

    const samples = [];
    const maxSampleScrollTop = Math.min(editorMaxScrollTop, 2_600);
    for (let scrollTop = 0; scrollTop <= maxSampleScrollTop; scrollTop += 120) {
      await setEditorScrollTop(page, scrollTop);
      await waitForRenderFrame(page);
      samples.push(await readSplitPreviewState(page));
    }

    const transitionSamples = samples.filter(
      (sample) =>
        typeof sample.editorTopLine === "number" &&
        sample.editorTopLine >= INLINE_MDX_HOW_IT_WORKS_LINE &&
        sample.editorTopLine <= INLINE_MDX_CREDIT_DETAILS_LINE,
    );
    expect(
      transitionSamples.length >= 3,
      `Inline MDX scroll smoke should sample the How it works to Credit details range. samples=${JSON.stringify(samples.map((sample) => ({ line: sample.editorTopLine, preview: sample.previewScrollTop })))}`,
    );

    const transitionPreviewTops = transitionSamples.map((sample) => sample.previewScrollTop);
    const previewTopBuckets = new Set(transitionPreviewTops.map((scrollTop) => Math.round(scrollTop / 48)));
    expect(
      previewTopBuckets.size >= 3,
      `Inline MDX preview should keep moving through a tall component block instead of pinning and jumping. samples=${JSON.stringify(transitionSamples.map((sample) => ({ line: sample.editorTopLine, preview: sample.previewScrollTop })))}`,
    );

    const largestTransitionJump = transitionPreviewTops
      .slice(1)
      .reduce(
        (largestJump, scrollTop, index) =>
          Math.max(largestJump, Math.abs(scrollTop - transitionPreviewTops[index])),
        0,
      );
    expect(
      largestTransitionJump <= 360,
      `Inline MDX preview should not jump abruptly between adjacent editor scroll samples. jump=${largestTransitionJump} samples=${JSON.stringify(transitionSamples.map((sample) => ({ line: sample.editorTopLine, preview: sample.previewScrollTop })))}`,
    );
  }, { viewport: { width: 1600, height: 900 } });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(LONG_SCROLL_TRANSFER_FIXTURE);
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    await waitForRenderFrame(page);
    await page.waitForFunction(() => {
      const previewDocument = document.querySelector(".preview-document.virtualized");
      return previewDocument?.getAttribute("data-preview-index-pending") === "false";
    });

    const editorMaxScrollTop = await getEditorMaxScrollTop(page);
    expect(editorMaxScrollTop > 0, "Long transfer fixture should create an editor scroll range.");

    const downRanges = [];
    for (const ratio of [0, 0.18, 0.36, 0.54, 0.72, 1]) {
      await setEditorScrollTop(page, editorMaxScrollTop * ratio);
      await waitForRenderFrame(page);
      const state = await readSplitPreviewState(page);
      const range = getVisiblePreviewSourceRange(state);
      expect(Boolean(range), `Long transfer preview should not be blank while scrolling down at ratio ${ratio}.`);
      downRanges.push(range);
    }

    for (let index = 1; index < downRanges.length; index += 1) {
      expect(
        downRanges[index].minStart >= downRanges[index - 1].minStart,
        "Long transfer preview visible source range should progress monotonically while editor scrolls down.",
      );
    }

    const beforeIdleState = await readSplitPreviewState(page);
    const beforeIdleRange = getVisiblePreviewSourceRange(beforeIdleState);
    await page.waitForTimeout(2_000);
    const afterIdleState = await readSplitPreviewState(page);
    const afterIdleRange = getVisiblePreviewSourceRange(afterIdleState);
    expect(
      Boolean(beforeIdleRange) &&
        Boolean(afterIdleRange) &&
        Math.abs(afterIdleRange.minStart - beforeIdleRange.minStart) <= 8,
      `Long transfer preview should not perform a delayed visible source jump after editor scrolling stops. before=${JSON.stringify(beforeIdleRange)} after=${JSON.stringify(afterIdleRange)}`,
    );

    const editorScrollTopBeforePreviewScroll = afterIdleState.editorScrollTop;
    await page.evaluate(() => {
      const previewSurface = document.querySelector(".workspace.split .preview-surface");
      if (previewSurface instanceof HTMLElement) {
        previewSurface.scrollTop = Math.max(0, previewSurface.scrollTop - 320);
        previewSurface.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await waitForRenderFrame(page);
    const afterPreviewManualScrollState = await readSplitPreviewState(page);
    expect(
      Math.abs(afterPreviewManualScrollState.editorScrollTop - editorScrollTopBeforePreviewScroll) <= 1,
      "Manual preview scrolling in split should not move the editor.",
    );

    const upRanges = [];
    for (const ratio of [0.86, 0.68, 0.5]) {
      await setEditorScrollTop(page, editorMaxScrollTop * ratio);
      await waitForRenderFrame(page);
      const state = await readSplitPreviewState(page);
      const range = getVisiblePreviewSourceRange(state);
      expect(Boolean(range), `Long transfer preview should not be blank while scrolling up at ratio ${ratio}.`);
      upRanges.push(range);
    }

    for (let index = 1; index < upRanges.length; index += 1) {
      expect(
        upRanges[index].minStart <= upRanges[index - 1].minStart,
        "Long transfer preview visible source range should move upward when editor scrolls upward.",
      );
    }
  }, { viewport: { width: 1600, height: 900 } });
}
