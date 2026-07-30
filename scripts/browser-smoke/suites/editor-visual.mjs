import { selectDocumentViewMode } from "../support/view-mode.mjs";
export const id = "editor-visual";
export const description =
  "Visual Markdown rendering, atomic block navigation, source reveal, and selection.";
export const scenarios = [
  "renders atomic blocks and preserves keyboard navigation",
  "renders consistent code block styles",
  "reveals math source without layout jumps",
  "keeps wrapped image source editable on narrow screens",
  "reveals separator source as plain Markdown",
  "maps pointer clicks to safe source cursors",
  "reveals inline Markdown source without style leaks",
  "inserts inline toolbar syntax into editable source",
  "keeps the cursor visible through long documents",
  "keeps user-owned Visual scrolling stable while widgets resize",
  "renders supported Markdown and MDX components",
  "navigates long documents without mounting every widget",
  "keeps toolbar insertions editable in Visual mode",
  "virtualizes large Visual documents",
];

const NAVIGATION_FIXTURE = [
  "before",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "![Sample](https://placehold.co/160x80/png)",
  "",
  "after",
].join("\n");

const SEPARATOR_FIXTURE = [
  "before",
  "",
  "---",
  "",
  "after",
].join("\n");

const MATH_FIXTURE = [
  "before",
  "",
  "$$",
  String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2}`,
  "$$",
  "",
  "after",
].join("\n");

const WRAPPED_IMAGE_FIXTURE = [
  "before",
  "",
  "![Navigation sample](https://placehold.co/320x120/png?text=Navigation+Block)",
  "",
  "after",
].join("\n");

const COMPONENT_FIXTURE = [
  "# Components",
  "",
  "Inline math: $E = mc^2$ with a footnote.[^visual]",
  "",
  "| Name | Value |",
  "| :--- | ---: |",
  "| **Total** | `12` |",
  "",
  '<Callout type="warning" title="A > B">',
  "Outer body",
  "",
  '<Accordion title="Nested details">',
  "Nested body",
  "</Accordion>",
  "</Callout>",
  "",
  "<Tabs>",
  '<Tab title="First > second">',
  "**Rich** body",
  "</Tab>",
  '<Tab title="Second">',
  "Second body",
  "</Tab>",
  "</Tabs>",
  "",
  "[^visual]: Visual footnote content.",
].join("\n");

const POINTER_FIXTURE = [
  "Plain before text",
  "Formatted **strong target** tail",
  "",
  "```js",
  "const alpha = 1;",
  "const beta = 2;",
  "const gamma = 3;",
  "```",
  "",
  "after",
].join("\n");

const INLINE_SOURCE_FIXTURE = [
  "before",
  "",
  "**bold text**, *italic text*, `code`, ~~strike~~, [link](https://example.com), and $formula$.[^note]",
  "",
  "[^note]: Footnote body.",
  "",
  "after",
].join("\n");

const INLINE_TOOLBAR_FIXTURE = [
  "**existing bold**",
  "*existing italic*",
  "`existing code`",
  "$existing formula$",
  "",
].join("\n");

const CODE_STYLE_FIXTURE = [
  "## Code styles",
  "",
  "```javascript",
  "const ready = true;",
  "```",
  "",
  "```bash",
  "npm run build",
  "```",
  "",
  "```",
  "plain text",
  "```",
  "",
  "```mermaid",
  "graph TD",
  "  A --> B",
  "```",
  "",
  "Selection tail",
].join("\n");

const SCROLL_FIXTURE = Array.from(
  { length: 240 },
  (_, index) => index % 12 === 0 ? `## Section ${index + 1}` : `Body line ${index + 1}`,
).join("\n");

const USER_SCROLL_FIXTURE = [
  "Cursor remains at the document start.",
  "",
  "![Delayed visual media](https://tabula.test/tabula-visual-delayed-media.svg)",
  "",
  ...Array.from(
    { length: 320 },
    (_, index) => index % 12 === 0
      ? `## Scroll section ${index + 1}`
      : `Scrollable Visual body line ${index + 1}`,
  ),
].join("\n");

const LONG_NAVIGATION_FIXTURE = [
  ...Array.from({ length: 24 }, (_, index) => [
    `## Section ${index + 1}`,
    "",
    "```js",
    `const section = ${index + 1};`,
    "console.log(section);",
    "```",
    "",
    "| Name | Value |",
    "| --- | ---: |",
    `| Section | ${index + 1} |`,
    "",
  ]).flat(),
  "before",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "![Sample](https://placehold.co/160x80/png)",
  "",
  "after",
].join("\n");

const readCursorLine = async (page) => {
  const label = (await page.locator(".status-cursor-position").textContent())?.trim() ?? "";
  return Number(/^(\d+):/.exec(label)?.[1] ?? 0);
};

const readCursorPosition = async (page) => {
  const label = (await page.locator(".status-cursor-position").textContent())?.trim() ?? "";
  const match = /^(\d+):(\d+)$/.exec(label);
  return {
    column: Number(match?.[2] ?? 0),
    line: Number(match?.[1] ?? 0),
  };
};

const readCursorVisibility = async (page) => page.evaluate(() => {
  const cursor = document.querySelector(".cm-cursor");
  const workspace = document.querySelector(".workspace");
  if (!(cursor instanceof HTMLElement) || !(workspace instanceof HTMLElement)) return null;
  const cursorRect = cursor.getBoundingClientRect();
  const workspaceRect = workspace.getBoundingClientRect();
  return {
    bottomGap: workspaceRect.bottom - cursorRect.bottom,
    scrollTop: workspace.scrollTop,
    topGap: cursorRect.top - workspaceRect.top,
    visible:
      cursorRect.bottom >= workspaceRect.top &&
      cursorRect.top <= workspaceRect.bottom,
  };
});

const observeRuntimeErrors = (page) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    errors.push(`page: ${error.stack ?? error.message}`);
  });
  return errors;
};

const enterVisualMode = async (page, waitForEditorReady) => {
  await selectDocumentViewMode(page, "Visual");
  await waitForEditorReady(page, { mode: "visual" });
  await page.waitForSelector(".cm-visual-editor");
};

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    openMarkdownFile,
    waitForEditorReady,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-navigation.md",
      content: NAVIGATION_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await page.getByRole("group", { name: "Edit code block Markdown" }).waitFor();
    await page.getByRole("group", { name: "Edit image Markdown" }).waitFor();
    const renderedCodeHeight =
      (await page.getByRole("group", { name: "Edit code block Markdown" }).boundingBox())?.height;
    const renderedCodeStyle = await page
      .getByRole("group", { name: "Edit code block Markdown" })
      .locator("code")
      .evaluate((code) => {
        const style = getComputedStyle(code);
        return { color: style.color, fontFamily: style.fontFamily };
      });

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    const sourceCodeHeight = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll(
        ".cm-line.cm-visual-source-code",
      ));
      if (lines.length === 0) return null;
      const first = lines[0].getBoundingClientRect();
      const last = lines.at(-1).getBoundingClientRect();
      return last.bottom - first.top;
    });
    const sourceCodeStyle = await page
      .locator(".cm-line.cm-visual-source-code")
      .nth(1)
      .evaluate((line) => {
        const style = getComputedStyle(line);
        return { color: style.color, fontFamily: style.fontFamily };
      });
    expect(
      typeof renderedCodeHeight === "number" &&
        typeof sourceCodeHeight === "number" &&
        Math.abs(renderedCodeHeight - sourceCodeHeight) <= 1.5,
      `Rendered and editable code blocks should keep the same height. rendered=${renderedCodeHeight} source=${sourceCodeHeight}`,
    );
    expect(
      JSON.stringify(renderedCodeStyle) === JSON.stringify(sourceCodeStyle),
      `Rendered and editable code should share their base font and color. rendered=${JSON.stringify(renderedCodeStyle)} source=${JSON.stringify(sourceCodeStyle)}`,
    );
    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    const downwardStates = [];
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press("ArrowDown");
      await waitForRenderFrame(page);
      downwardStates.push({
        codeRendered:
          await page.getByRole("group", { name: "Edit code block Markdown" }).count(),
        imageRendered:
          await page.getByRole("group", { name: "Edit image Markdown" }).count(),
        line: await readCursorLine(page),
      });
    }
    expect(
      JSON.stringify(downwardStates) === JSON.stringify([
        { codeRendered: 1, imageRendered: 1, line: 2 },
        { codeRendered: 1, imageRendered: 1, line: 3 },
        { codeRendered: 0, imageRendered: 1, line: 3 },
        { codeRendered: 0, imageRendered: 1, line: 4 },
        { codeRendered: 0, imageRendered: 1, line: 5 },
        { codeRendered: 1, imageRendered: 1, line: 6 },
        { codeRendered: 1, imageRendered: 1, line: 7 },
        { codeRendered: 1, imageRendered: 0, line: 7 },
        { codeRendered: 1, imageRendered: 1, line: 8 },
        { codeRendered: 1, imageRendered: 1, line: 9 },
      ]),
      `Visual ArrowDown should reveal a block's Markdown on entry, traverse every source line, and restore rendering on exit. states=${JSON.stringify(downwardStates)}`,
    );

    await page.keyboard.press("ControlOrMeta+End");
    const upwardStates = [];
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press("ArrowUp");
      await waitForRenderFrame(page);
      upwardStates.push({
        codeRendered:
          await page.getByRole("group", { name: "Edit code block Markdown" }).count(),
        imageRendered:
          await page.getByRole("group", { name: "Edit image Markdown" }).count(),
        line: await readCursorLine(page),
      });
    }
    expect(
      JSON.stringify(upwardStates) === JSON.stringify([
        { codeRendered: 1, imageRendered: 1, line: 8 },
        { codeRendered: 1, imageRendered: 1, line: 7 },
        { codeRendered: 1, imageRendered: 0, line: 7 },
        { codeRendered: 1, imageRendered: 1, line: 6 },
        { codeRendered: 1, imageRendered: 1, line: 5 },
        { codeRendered: 0, imageRendered: 1, line: 5 },
        { codeRendered: 0, imageRendered: 1, line: 4 },
        { codeRendered: 0, imageRendered: 1, line: 3 },
        { codeRendered: 1, imageRendered: 1, line: 2 },
        { codeRendered: 1, imageRendered: 1, line: 1 },
      ]),
      `Visual ArrowUp should reveal a block's Markdown on entry, traverse every source line, and restore rendering on exit. states=${JSON.stringify(upwardStates)}`,
    );

    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("ArrowDown");
      await waitForRenderFrame(page);
    }
    expect(
      (await readCursorLine(page)) === 6,
      "Navigation should arrive at the blank line before the rendered image.",
    );
    await page.keyboard.press("ArrowRight");
    await waitForRenderFrame(page);
    expect(
      (await readCursorLine(page)) === 7 &&
        (await page.getByRole("group", { name: "Edit image Markdown" }).count()) === 0 &&
        (await page.locator(".cm-content").textContent())?.includes("![Sample]"),
      "ArrowRight into a rendered image should immediately reveal its canonical Markdown source.",
    );

    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    expect(
      (await page.getByRole("group", { name: "Edit image Markdown" }).count()) === 1 &&
        (await readCursorLine(page)) === 8,
      "Moving from revealed image Markdown should preserve the following blank line and restore rendering.",
    );

    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    expect((await page.locator('img[alt="Sample"]').count()) === 1, "Preview should retain the image.");
    await enterVisualMode(page, waitForEditorReady);

    const dragPoints = await page.evaluate(() => {
      const image = document.querySelector('[role="group"][aria-label="Edit image Markdown"]');
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const after = lines.find((line) => line.textContent?.includes("after"));
      if (!(image instanceof HTMLElement) || !(after instanceof HTMLElement)) return null;
      const imageRect = image.getBoundingClientRect();
      const afterRect = after.getBoundingClientRect();
      return {
        from: { x: imageRect.left + 8, y: imageRect.top + 8 },
        to: { x: afterRect.left + 24, y: afterRect.top + afterRect.height / 2 },
      };
    });
    expect(Boolean(dragPoints), "Visual image and trailing text should expose drag coordinates.");
    await page.mouse.move(dragPoints.from.x, dragPoints.from.y);
    await page.mouse.down();
    await page.mouse.move(dragPoints.to.x, dragPoints.to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground").length > 0,
    );
    expect(
      (await page.locator(".cm-selectionLayer .cm-selectionBackground").count()) > 0,
      "Dragging from a visual block into text should create an editor selection.",
    );

    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    const shiftClickPoint = await page
      .getByRole("group", { name: "Edit image Markdown" })
      .boundingBox();
    expect(Boolean(shiftClickPoint), "Rendered image should expose Shift+Click geometry.");
    await page.keyboard.down("Shift");
    await page.mouse.click(
      shiftClickPoint.x + shiftClickPoint.width / 2,
      shiftClickPoint.y + shiftClickPoint.height / 2,
    );
    await page.keyboard.up("Shift");
    await waitForRenderFrame(page);
    expect(
      (await page.locator(".cm-selectionLayer .cm-selectionBackground").count()) > 0 &&
        (await page.locator(".cm-content").textContent())?.includes("![Sample]") &&
        (await page.getByRole("group", { name: "Edit image Markdown" }).count()) === 0,
      "Shift+Clicking an atomic block should extend one canonical source selection through it.",
    );

    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("Shift+ArrowDown");
    await waitForRenderFrame(page);
    expect(
      (await page.locator(".cm-selectionLayer .cm-selectionBackground").count()) > 0,
      "Shift+Arrow should keep selection in CodeMirror's canonical source range.",
    );

    for (let index = 0; index < 12; index += 1) {
      await selectDocumentViewMode(page, "Preview");
      await waitForEditorReady(page, { mode: "preview" });
      await enterVisualMode(page, waitForEditorReady);
    }
    expect(
      runtimeErrors.length === 0,
      `Visual mode lifecycle should not emit runtime errors while reconfiguring. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-code-style.md",
      content: CODE_STYLE_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    const codeBlocks = page.getByRole("group", { name: "Edit code block Markdown" });
    await codeBlocks.nth(2).waitFor();
    const renderedStyles = await codeBlocks.locator("code").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        };
      }));
    const sourceStyles = [];
    const sourceInlineSurfaces = [];
    for (const { index, sourceText } of [
      { index: 2, sourceText: "plain text" },
      { index: 1, sourceText: "npm run build" },
      { index: 0, sourceText: "const ready = true;" },
    ]) {
      await codeBlocks.nth(index).click();
      await waitForRenderFrame(page);
      sourceStyles[index] = await page.evaluate((text) => {
        const line = Array.from(document.querySelectorAll(
          ".cm-line.cm-visual-source-code",
        )).find((candidate) => candidate.textContent === text);
        if (!(line instanceof HTMLElement)) return null;
        const leaf = line.querySelector("span") ?? line;
        const style = getComputedStyle(leaf);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        };
      }, sourceText);
      sourceInlineSurfaces[index] = await page.evaluate((text) => {
        const line = Array.from(document.querySelectorAll(
          ".cm-line.cm-visual-source-code",
        )).find((candidate) => candidate.textContent === text);
        const inlineCode = line?.querySelector(".cm-visual-inline-code");
        if (!(inlineCode instanceof HTMLElement)) return null;
        const style = getComputedStyle(inlineCode);
        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
        };
      }, sourceText);
    }
    expect(
      renderedStyles.length === 3 &&
        sourceStyles.every((style, index) =>
          JSON.stringify(style) === JSON.stringify(renderedStyles[index])),
      `JavaScript, bash, and plain code should keep identical typography while entering source. rendered=${JSON.stringify(renderedStyles)} source=${JSON.stringify(sourceStyles)}`,
    );
    expect(
      sourceInlineSurfaces.filter(Boolean).every((style) =>
        style.backgroundColor === "rgba(0, 0, 0, 0)" &&
        style.borderRadius === "0px" &&
        style.paddingLeft === "0px" &&
        style.paddingRight === "0px"),
      `Fenced code source should not inherit inline-code pills. styles=${JSON.stringify(sourceInlineSurfaces)}`,
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await waitForRenderFrame(page);
    await page.context().grantPermissions(
      ["clipboard-read", "clipboard-write"],
      { origin: new URL(page.url()).origin },
    );
    await page.keyboard.press("ControlOrMeta+C");
    const copiedMarkdown = await page.evaluate(() =>
      navigator.clipboard.readText());
    const selectAllState = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const codeLines = lines.filter((line) =>
        line.classList.contains("cm-visual-source-code"));
      const inlineCodeMarks = codeLines.flatMap((line) =>
        Array.from(line.querySelectorAll(".cm-visual-inline-code")));
      const mermaidSourceLines = [
        "```mermaid",
        "graph TD",
        "  A --> B",
        "```",
      ].filter((text) => lines.some((line) => line.textContent === text));
      const heading = lines.find((line) => line.textContent === "## Code styles");
      const headingText = heading?.firstChild;
      const headingRange = document.createRange();
      if (headingText) {
        headingRange.selectNodeContents(headingText);
      }
      const selectionRects = Array.from(
        document.querySelectorAll(".cm-selectionBackground"),
      ).map((element) => element.getBoundingClientRect());
      const headingRect = headingText ? headingRange.getBoundingClientRect() : null;
      const headingSelectionLeft = headingRect
        ? Math.min(
          ...selectionRects
            .filter((rect) =>
              rect.bottom > headingRect.top && rect.top < headingRect.bottom)
            .map((rect) => rect.left),
        )
        : Number.NaN;
      return {
        codeLineCount: codeLines.length,
        mermaidSourceLineCount: mermaidSourceLines.length,
        inlineCodeMarkCount: inlineCodeMarks.length,
        styledInlineCodeMarkCount: inlineCodeMarks.filter((mark) => {
          const style = getComputedStyle(mark);
          return style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            style.borderRadius !== "0px" ||
            style.paddingLeft !== "0px" ||
            style.paddingRight !== "0px";
        }).length,
        opaqueCodeLineCount: codeLines.filter((line) =>
          getComputedStyle(line).backgroundColor !== "rgba(0, 0, 0, 0)").length,
        selectedCodeLineCount: codeLines.filter((line) =>
          line.classList.contains("cm-visual-selected-code")).length,
        sourceBlockLineCount: codeLines.filter((line) =>
          line.classList.contains("cm-visual-source-block")).length,
        headingLeft: headingRect?.left ?? null,
        headingSelectionLeft: Number.isFinite(headingSelectionLeft)
          ? headingSelectionLeft
          : null,
      };
    });
    expect(
      copiedMarkdown === CODE_STYLE_FIXTURE,
      `Select all should copy the canonical Markdown source. copied=${JSON.stringify(copiedMarkdown)}`,
    );
    expect(
      selectAllState.codeLineCount === 9 &&
        selectAllState.selectedCodeLineCount === 9 &&
        selectAllState.mermaidSourceLineCount === 4 &&
        selectAllState.sourceBlockLineCount === 0 &&
        selectAllState.opaqueCodeLineCount === 0 &&
        selectAllState.inlineCodeMarkCount > 0 &&
        selectAllState.styledInlineCodeMarkCount === 0,
      `Select all should expose every code source line without covering the native selection. state=${JSON.stringify(selectAllState)}`,
    );
    expect(
      typeof selectAllState.headingLeft === "number" &&
        typeof selectAllState.headingSelectionLeft === "number" &&
        selectAllState.headingLeft >= selectAllState.headingSelectionLeft - 0.5,
      `Selected heading text should remain inside the selection surface. state=${JSON.stringify(selectAllState)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Code typography and select-all should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-math.md",
      content: MATH_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    const math = page.getByRole("group", { name: /Edit math Markdown/ });
    await math.locator(".katex").waitFor();
    const renderedMathHeight = (await math.boundingBox())?.height;

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    const sourceMathHeight = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const first = lines.find((line) => line.textContent === "$$");
      const expression = lines.find((line) => line.textContent?.includes("\\sum_"));
      const last = expression
        ? lines.slice(lines.indexOf(expression) + 1).find((line) => line.textContent === "$$")
        : null;
      if (!first || !last) return null;
      return last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
    });
    expect(
      typeof renderedMathHeight === "number" &&
        typeof sourceMathHeight === "number" &&
        Math.abs(renderedMathHeight - sourceMathHeight) <= 1.5,
      `Rendered and editable display math should keep the same height. rendered=${renderedMathHeight} source=${sourceMathHeight}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Display math source reveal should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await page.setViewportSize({ width: 420, height: 720 });
    await openMarkdownFile(page, {
      name: "visual-wrapped-image.md",
      content: WRAPPED_IMAGE_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    const wrappedSource = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent?.startsWith("![Navigation sample]"));
      if (!(line instanceof HTMLElement)) return null;
      const style = getComputedStyle(line);
      return {
        height: line.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
      };
    });
    expect(
      Boolean(wrappedSource && wrappedSource.height > wrappedSource.lineHeight * 1.5),
      `The narrow viewport fixture should wrap the image Markdown source. source=${JSON.stringify(wrappedSource)}`,
    );
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    expect(
      (await readCursorLine(page)) === 4 &&
        (await page.getByRole("group", { name: "Edit image Markdown" }).count()) === 1,
      "ArrowDown should leave a wrapped atomic source in one logical-line step.",
    );
    expect(
      runtimeErrors.length === 0,
      `Wrapped atomic source navigation should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-separator.md",
      content: SEPARATOR_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    const separator = page.getByRole("group", { name: "Edit separator Markdown" });
    await separator.waitFor();
    const renderedSeparatorHeight = (await separator.boundingBox())?.height;
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);

    const separatorSource = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent === "---");
      return line
          ? {
            blockStyled: line.classList.contains("cm-visual-source-block"),
            height: line.getBoundingClientRect().height,
            text: line.textContent,
          }
        : null;
    });
    expect(
      (await readCursorLine(page)) === 3 &&
        separatorSource?.text === "---" &&
        separatorSource.blockStyled === false &&
        typeof renderedSeparatorHeight === "number" &&
        Math.abs(renderedSeparatorHeight - separatorSource.height) <= 1,
      `Entering a separator should reveal a plain Markdown line without a rounded source block. source=${JSON.stringify(separatorSource)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Separator source reveal should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-pointer.md",
      content: POINTER_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    const inlineClickPoint = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent?.includes("Formatted"));
      if (!(line instanceof HTMLElement)) return null;
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.textContent?.indexOf("target") ?? -1;
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index + 2);
        range.setEnd(node, index + 3);
        const rect = range.getBoundingClientRect();
        return {
          x: (rect.left + rect.right) / 2,
          y: (rect.top + rect.bottom) / 2,
        };
      }
      return null;
    });
    expect(Boolean(inlineClickPoint), "Formatted Visual text should expose click coordinates.");
    await page.mouse.move(inlineClickPoint.x, inlineClickPoint.y);
    await page.mouse.down();
    await waitForRenderFrame(page);
    const genericPointerCursorHeight = await page.locator(".cm-cursor-primary").evaluate(
      (cursor) => cursor.getBoundingClientRect().height,
    );
    await page.mouse.up();
    await waitForRenderFrame(page);
    const inlinePosition = await readCursorPosition(page);
    const targetColumn = POINTER_FIXTURE.split("\n")[1].indexOf("target") + 3;
    expect(
      inlinePosition.line === 2 &&
        inlinePosition.column >= targetColumn &&
        inlinePosition.column <= targetColumn + 1,
      `Clicking formatted Visual text should resolve to the underlying Markdown character. expected=2:${targetColumn}-${targetColumn + 1} actual=${inlinePosition.line}:${inlinePosition.column}`,
    );
    expect(
      genericPointerCursorHeight <= 48,
      `Visual pointer selection should never create block-height cursor geometry. height=${genericPointerCursorHeight}`,
    );

    const codeBlock = page.getByRole("group", { name: "Edit code block Markdown" });
    await codeBlock.waitFor();
    const codeClickPoint = await codeBlock.evaluate((block) => {
      const code = block.querySelector("code");
      if (!code) return null;
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      let renderedOffset = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.textContent?.indexOf("gamma") ?? -1;
        if (index >= 0) {
          const range = document.createRange();
          range.setStart(node, index + 2);
          range.setEnd(node, index + 3);
          const rect = range.getBoundingClientRect();
          return {
            column: "const gamma = 3;".indexOf("gamma") + 3,
            line: 7,
            renderedOffset: renderedOffset + index + 2,
            x: (rect.left + rect.right) / 2,
            y: (rect.top + rect.bottom) / 2,
          };
        }
        renderedOffset += node.textContent?.length ?? 0;
      }
      return null;
    });
    expect(Boolean(codeClickPoint), "Visual code block should expose exact text geometry.");
    await page.mouse.move(codeClickPoint.x, codeClickPoint.y);
    await page.mouse.down();
    await waitForRenderFrame(page);
    const primaryCursor = page.locator(".cm-cursor-primary");
    const pointerDownCursorHeight = await primaryCursor.evaluate(
      (cursor) => cursor.getBoundingClientRect().height,
    );
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector(".status-cursor-position")?.textContent?.trim().startsWith("7:"));
    const settledCursorHeight = await primaryCursor.evaluate(
      (cursor) => cursor.getBoundingClientRect().height,
    );
    const pointerPosition = await readCursorPosition(page);
    expect(
      pointerPosition.line === codeClickPoint.line &&
        pointerPosition.column >= codeClickPoint.column &&
        pointerPosition.column <= codeClickPoint.column + 1,
      `Clicking rendered code text should resolve to the exact underlying Markdown character. expected=${codeClickPoint.line}:${codeClickPoint.column}-${codeClickPoint.column + 1} renderedOffset=${codeClickPoint.renderedOffset} actual=${pointerPosition.line}:${pointerPosition.column}`,
    );
    expect(
      pointerDownCursorHeight <= 48,
      `Pointer entry should preserve a line-height cursor before source reveal. height=${pointerDownCursorHeight}`,
    );
    expect(
      settledCursorHeight <= 48,
      `Pointer release should reveal only a settled line-height cursor. height=${settledCursorHeight}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Pointer source mapping should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-inline-source.md",
      content: INLINE_SOURCE_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await page.waitForSelector(".cm-visual-inline-math .katex");
    await page.waitForSelector(".cm-visual-footnote-reference");

    const renderedStyles = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          fontSynthesis: style.fontSynthesis,
          fontStyle: style.fontStyle,
          fontWeight: style.fontWeight,
          textDecoration: style.textDecorationLine,
        };
      };
      return {
        bold: read(".cm-visual-strong"),
        code: read(".cm-visual-inline-code"),
        italic: read(".cm-visual-emphasis"),
        strike: read(".cm-visual-strikethrough"),
      };
    });
    expect(
      Number(renderedStyles.bold?.fontWeight ?? 0) >= 600 &&
        renderedStyles.italic?.fontStyle === "italic" &&
        renderedStyles.italic?.fontSynthesis.includes("style") &&
        renderedStyles.strike?.textDecoration.includes("line-through") &&
        renderedStyles.code?.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        /Mono|monospace/i.test(renderedStyles.code?.fontFamily ?? ""),
      `Inactive inline Markdown should use rendered typography. styles=${JSON.stringify(renderedStyles)}`,
    );
    const footnoteDefinitionHeight = await page
      .locator(".cm-visual-footnote-definition")
      .evaluate((definition) => definition.getBoundingClientRect().height);
    expect(
      footnoteDefinitionHeight <= 40,
      `A one-line footnote definition should not retain paragraph margins. height=${footnoteDefinitionHeight}`,
    );
    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    const previewItalicStyle = await page.locator(".preview-surface em").evaluate(
      (element) => {
        const style = getComputedStyle(element);
        return {
          fontStyle: style.fontStyle,
          fontSynthesis: style.fontSynthesis,
        };
      },
    );
    expect(
      previewItalicStyle.fontStyle === "italic" &&
        previewItalicStyle.fontSynthesis.includes("style"),
      `Preview emphasis should remain visibly italic with Geist Sans. style=${JSON.stringify(previewItalicStyle)}`,
    );
    await enterVisualMode(page, waitForEditorReady);

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    const activeLine = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent?.includes("bold text"));
      return line?.textContent ?? null;
    });
    expect(
      activeLine ===
        "**bold text**, *italic text*, `code`, ~~strike~~, [link](https://example.com), and $formula$.[^note]" &&
        (await page.locator(".cm-visual-inline-math").count()) === 0 &&
        (await page.locator(".cm-visual-footnote-reference").count()) === 0,
      `The active Visual line should expose all canonical inline Markdown at once. line=${activeLine}`,
    );

    await page.keyboard.press("ArrowDown");
    await waitForRenderFrame(page);
    await page.waitForSelector(".cm-visual-inline-math .katex");

    const dragPoints = await page.evaluate(() => {
      const sourceLine = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent?.includes("bold text"));
      const afterLine = Array.from(document.querySelectorAll(".cm-line"))
        .find((candidate) => candidate.textContent === "after");
      if (!(sourceLine instanceof HTMLElement) || !(afterLine instanceof HTMLElement)) {
        return null;
      }
      const sourceRect = sourceLine.getBoundingClientRect();
      const afterRect = afterLine.getBoundingClientRect();
      return {
        from: {
          x: sourceRect.left + Math.min(72, sourceRect.width * 0.15),
          y: sourceRect.top + sourceRect.height / 2,
        },
        to: {
          x: afterRect.left + Math.min(24, afterRect.width),
          y: afterRect.top + afterRect.height / 2,
        },
      };
    });
    expect(Boolean(dragPoints), "Inline source and trailing text should expose drag coordinates.");
    await page.mouse.move(dragPoints.from.x, dragPoints.from.y);
    await page.mouse.down();
    await page.mouse.move(dragPoints.to.x, dragPoints.to.y, { steps: 12 });
    await page.mouse.up();
    await waitForRenderFrame(page);
    const selectedSource = await page.evaluate(() => {
      const visualSurfaces = Array.from(document.querySelectorAll(
        ".cm-visual-inline-code, .cm-visual-source-block, .cm-visual-selected-code",
      ));
      const activeLine = document.querySelector(".cm-activeLine");
      return {
        content: document.querySelector(".cm-content")?.textContent ?? "",
        selectionRects:
          document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground").length,
        opaqueSurfaceCount: visualSurfaces.filter((surface) =>
          getComputedStyle(surface).backgroundColor !== "rgba(0, 0, 0, 0)").length,
        activeLineBackground: activeLine
          ? getComputedStyle(activeLine).backgroundColor
          : null,
      };
    });
    expect(
      selectedSource.selectionRects > 0 &&
        selectedSource.opaqueSurfaceCount === 0 &&
        selectedSource.activeLineBackground === "rgba(0, 0, 0, 0)" &&
        selectedSource.content.includes("**bold text**") &&
        selectedSource.content.includes("$formula$") &&
        selectedSource.content.includes("[^note]: Footnote body.") &&
        (await page.locator(".cm-visual-inline-math").count()) === 0 &&
        (await page.locator(".cm-visual-footnote-definition").count()) === 0,
      `Dragging across rendered inline and footnote content should expose one selectable Markdown source. state=${JSON.stringify(selectedSource)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Inline source reveal should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-inline-toolbar.md",
      content: INLINE_TOOLBAR_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+End");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await waitForRenderFrame(page);

    const insertionState = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const activeLine = lines.find((line) => line.classList.contains("cm-activeLine"));
      const activeStyle = activeLine ? getComputedStyle(activeLine) : null;
      return {
        activeBackground: activeStyle?.backgroundColor ?? null,
        activeText: activeLine?.textContent ?? null,
        existingLineHtml: lines.slice(0, 3).map((line) => line.innerHTML),
        existingLineText: lines.slice(0, 3).map((line) => line.textContent),
        inlineMathCount: document.querySelectorAll(".cm-visual-inline-math").length,
      };
    });
    expect(
      insertionState.activeText === "**bold text**" &&
        insertionState.activeBackground === "rgba(0, 0, 0, 0)" &&
        JSON.stringify(insertionState.existingLineText) ===
          JSON.stringify(["existing bold", "existing italic", "existing code"]) &&
        insertionState.existingLineHtml.some((html) => html.includes("cm-visual-strong")) &&
        insertionState.existingLineHtml.some((html) => html.includes("cm-visual-emphasis")) &&
        insertionState.existingLineHtml.some((html) => html.includes("cm-visual-inline-code")) &&
        insertionState.inlineMathCount === 1,
      `A toolbar insertion should reveal and highlight only its active source line. state=${JSON.stringify(insertionState)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Inline toolbar insertion should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-cursor-scroll.md",
      content: SCROLL_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    const downwardSamples = [];
    for (let index = 0; index < 190; index += 1) {
      await page.keyboard.press("ArrowDown");
      if (index % 20 === 19) {
        await waitForRenderFrame(page);
        downwardSamples.push(await readCursorVisibility(page));
      }
    }
    expect(
      downwardSamples.every((sample) =>
        sample?.visible &&
        sample.topGap >= 32 &&
        sample.bottomGap >= 32),
      `Visual ArrowDown should keep the cursor inside the safe viewport. samples=${JSON.stringify(downwardSamples)}`,
    );
    expect(
      (downwardSamples.at(-1)?.scrollTop ?? 0) > 0,
      "Visual ArrowDown should move the outer workspace scroll owner.",
    );

    const upwardSamples = [];
    for (let index = 0; index < 150; index += 1) {
      await page.keyboard.press("ArrowUp");
      if (index % 20 === 19) {
        await waitForRenderFrame(page);
        upwardSamples.push(await readCursorVisibility(page));
      }
    }
    expect(
      upwardSamples.every((sample) =>
        sample?.visible &&
        sample.topGap >= 32 &&
        sample.bottomGap >= 32),
      `Visual ArrowUp should keep the cursor inside the safe viewport. samples=${JSON.stringify(upwardSamples)}`,
    );
    expect(
      (upwardSamples.at(-1)?.scrollTop ?? Number.POSITIVE_INFINITY) <
        (downwardSamples.at(-1)?.scrollTop ?? 0),
      "Visual ArrowUp should bring the outer workspace back toward the document start.",
    );
    expect(
      runtimeErrors.length === 0,
      `Cursor visibility correction should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    let releaseDelayedImage;
    let markImageFulfilled;
    let markImageRequested;
    const delayedImage = new Promise((resolve) => {
      releaseDelayedImage = resolve;
    });
    const imageRequested = new Promise((resolve) => {
      markImageRequested = resolve;
    });
    const imageFulfilled = new Promise((resolve) => {
      markImageFulfilled = resolve;
    });
    await page.route("**/tabula-visual-delayed-media.svg", async (route) => {
      markImageRequested();
      await delayedImage;
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: [
          '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="980" viewBox="0 0 1200 980">',
          '<rect width="1200" height="980" fill="#dce6ee"/>',
          '<text x="80" y="160" font-family="Arial, sans-serif" font-size="64">Delayed Visual media</text>',
          "</svg>",
        ].join(""),
      });
      markImageFulfilled();
    });
    await openMarkdownFile(page, {
      name: "visual-user-scroll.md",
      content: USER_SCROLL_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await imageRequested;
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+Home");
    await waitForRenderFrame(page);
    const beforeLoad = await page.evaluate(() => {
      const workspace = document.querySelector(".workspace.visual");
      if (!(workspace instanceof HTMLElement)) return null;
      const maximum = Math.max(0, workspace.scrollHeight - workspace.clientHeight);
      workspace.scrollTop = maximum * 0.55;
      workspace.dispatchEvent(new Event("scroll"));
      return {
        maximum,
        scrollTop: workspace.scrollTop,
      };
    });
    expect(
      Boolean(beforeLoad && beforeLoad.maximum > 1_000 && beforeLoad.scrollTop > 500),
      `The Visual fixture should expose a meaningful manual scroll range. state=${JSON.stringify(beforeLoad)}`,
    );
    releaseDelayedImage();
    await imageFulfilled;
    await waitForRenderFrame(page);
    await page.waitForTimeout(120);
    const afterLoad = await page.evaluate(() => {
      const workspace = document.querySelector(".workspace.visual");
      return workspace instanceof HTMLElement
        ? {
            maximum: Math.max(0, workspace.scrollHeight - workspace.clientHeight),
            scrollTop: workspace.scrollTop,
          }
        : null;
    });
    expect(
      Boolean(
        beforeLoad &&
        afterLoad &&
        afterLoad.scrollTop >= beforeLoad.scrollTop * 0.7,
      ),
      `Async Visual widget geometry should preserve user-owned scrolling instead of returning to the cursor. before=${JSON.stringify(beforeLoad)} after=${JSON.stringify(afterLoad)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `User-owned Visual scrolling should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-components.mdx",
      content: COMPONENT_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await page.waitForSelector(".cm-visual-inline-math .katex");
    await page.waitForSelector(".cm-visual-footnote-reference");
    await page.getByRole("group", { name: /Edit footnote Markdown/ }).last().waitFor();
    await page.getByRole("group", { name: "Edit table Markdown" }).waitFor();
    await page.getByRole("group", { name: "Edit callout Markdown" }).waitFor();
    const tabs = page.getByRole("group", { name: "Edit tabs Markdown" });
    await tabs.waitFor();

    expect(
      (await page.locator(".cm-visual-table-frame strong").textContent()) === "Total",
      "Visual tables should render inline Markdown with the Preview renderer.",
    );
    expect(
      (await page.locator(".cm-visual-callout").textContent())?.includes("Nested body"),
      "MDX-tree parsing should preserve nested component source.",
    );
    expect(
      (await page.locator(".cm-visual-footnote-reference").textContent()) === "1" &&
        (await page.locator(".cm-visual-footnote-definition").textContent())
          ?.includes("Visual footnote content."),
      "Visual mode should render GFM footnote references and definitions.",
    );

    const firstTab = tabs.getByRole("tab", { name: "First > second" });
    await firstTab.focus();
    await page.keyboard.press("ArrowRight");
    expect(
      await tabs.getByRole("tab", { name: "Second", exact: true })
        .getAttribute("aria-selected") === "true",
      "Visual tabs should support the standard ArrowRight keyboard interaction.",
    );
    expect(
      runtimeErrors.length === 0,
      `Visual component rendering should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-long-navigation.md",
      content: LONG_NAVIGATION_FIXTURE,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+End");
    await waitForRenderFrame(page);
    const finalLine = await readCursorLine(page);
    const initialCodeRendered =
      await page.getByRole("group", { name: "Edit code block Markdown" }).count();
    const initialImageRendered =
      await page.getByRole("group", { name: "Edit image Markdown" }).count();
    const upwardStates = [];
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("ArrowUp");
      await waitForRenderFrame(page);
      upwardStates.push({
        codeRendered:
          await page.getByRole("group", { name: "Edit code block Markdown" }).count(),
        imageRendered:
          await page.getByRole("group", { name: "Edit image Markdown" }).count(),
        line: await readCursorLine(page),
        visible: (await readCursorVisibility(page))?.visible ?? false,
      });
    }
    expect(
      JSON.stringify(upwardStates) === JSON.stringify([
        {
          codeRendered: initialCodeRendered,
          imageRendered: initialImageRendered,
          line: finalLine - 1,
          visible: true,
        },
        {
          codeRendered: initialCodeRendered,
          imageRendered: initialImageRendered,
          line: finalLine - 2,
          visible: true,
        },
        {
          codeRendered: initialCodeRendered,
          imageRendered: initialImageRendered - 1,
          line: finalLine - 2,
          visible: true,
        },
        {
          codeRendered: initialCodeRendered,
          imageRendered: initialImageRendered,
          line: finalLine - 3,
          visible: true,
        },
        {
          codeRendered: initialCodeRendered,
          imageRendered: initialImageRendered,
          line: finalLine - 4,
          visible: true,
        },
        {
          codeRendered: initialCodeRendered - 1,
          imageRendered: initialImageRendered,
          line: finalLine - 4,
          visible: true,
        },
      ]),
      `Long Visual navigation should reveal source without losing its cursor anchor while rendered block heights settle. states=${JSON.stringify(upwardStates)}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Long Visual navigation should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    await openMarkdownFile(page, {
      name: "visual-toolbar-inserts.md",
      content: "",
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);

    const insertAndType = async (buttonName, value) => {
      await page.getByRole("button", { name: buttonName, exact: true }).click();
      await page.keyboard.type(value);
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await waitForRenderFrame(page);
    };

    await insertAndType("Frontmatter", "Toolbar matrix");
    await insertAndType("Heading 1", "Heading");
    await insertAndType("Quote", "Quote");
    await insertAndType("Bold", "Bold");
    await insertAndType("Italic", "Italic");
    await insertAndType("Strikethrough", "Strike");
    await insertAndType("Inline code", "inline");
    await insertAndType("Inline math", "x+y");
    await insertAndType("Link", "https://example.com");
    await insertAndType("Bullet list", "Bullet");
    await insertAndType("Numbered list", "Numbered");
    await insertAndType("Checklist", "Task");
    await insertAndType("Horizontal rule", "");
    await insertAndType("Code block", "js");
    await insertAndType("Table", "Name");
    await insertAndType("Image", "https://placehold.co/160x80/png");
    await insertAndType("Math block", "x^2");
    await insertAndType("Mermaid diagram", "A --> B");
    await insertAndType("Callout", "Callout body");
    await insertAndType("Accordion", "Accordion body");
    await insertAndType("Tabs", "Tab body");
    await page.getByRole("button", { name: "Footnote", exact: true }).click();
    await waitForRenderFrame(page);
    const insertedFootnoteCursorHeight = await page.locator(".cm-cursor")
      .evaluate((cursor) => cursor.getBoundingClientRect().height);
    expect(
      insertedFootnoteCursorHeight < 40 &&
        await page.locator(".cm-visual-footnote-definition").count() === 0,
      `A new footnote should expose one source line with a normal cursor. height=${insertedFootnoteCursorHeight}`,
    );
    await page.keyboard.type("Footnote body");
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);

    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    const source = (await page.locator(".cm-line").allTextContents()).join("\n");
    for (const expected of [
      "title: Toolbar matrix",
      "# Heading",
      "> Quote",
      "**Bold**",
      "_Italic_",
      "~~Strike~~",
      "`inline`",
      "$x+y$",
      "](https://example.com)",
      "- Bullet",
      "1. Numbered",
      "- [ ] Task",
      "```js",
      "| Name |",
      "![image alt](https://placehold.co/160x80/png)",
      "$$\nx^2\n$$",
      "```mermaid",
      "<Callout",
      "<Accordion",
      "<Tabs>",
      "[^1]: Footnote body",
    ]) {
      expect(
        source?.includes(expected),
        `Toolbar insert should preserve canonical Markdown: ${expected}. source=${source}`,
      );
    }

    await enterVisualMode(page, waitForEditorReady);
    for (const label of [
      "Edit frontmatter Markdown",
      "Edit code block Markdown",
      "Edit table Markdown",
      "Edit image Markdown",
      "Edit Mermaid Markdown",
      "Edit callout Markdown",
      "Edit accordion Markdown",
      "Edit tabs Markdown",
    ]) {
      await page.getByRole("group", { name: label }).waitFor();
    }
    await page.getByRole("group", {
      name: "Edit math Markdown",
      exact: true,
    }).waitFor();
    await page.getByRole("group", {
      name: /Edit math Markdown:/,
    }).waitFor();
    expect(
      await page.locator(".cm-visual-footnote-reference").count() === 1 &&
        await page.locator(".cm-visual-footnote-definition").count() === 1,
      "Toolbar footnote insertion should render one reference and one definition.",
    );
    await page.locator(".cm-visual-footnote-definition").click();
    await waitForRenderFrame(page);
    expect(
      await page.locator(".cm-visual-footnote-definition").count() === 0 &&
        (await page.locator(".cm-content").textContent())?.includes("[^1]: Footnote body"),
      "Clicking a rendered footnote definition should reveal its editable Markdown line.",
    );
    await page.keyboard.press("End");
    await page.keyboard.type(" updated");
    expect(
      (await page.locator(".cm-content").textContent())?.includes(
        "[^1]: Footnote body updated",
      ),
      "Editing an existing footnote definition should keep accepting consecutive input.",
    );
    expect(
      runtimeErrors.length === 0,
      `Toolbar insertion matrix should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    const runtimeErrors = observeRuntimeErrors(page);
    const largeDocument = Array.from(
      { length: 4_000 },
      (_, index) => `## Section ${index + 1}\n\nBody ${index + 1}.`,
    ).join("\n\n");
    await openMarkdownFile(page, {
      name: "visual-large.md",
      content: largeDocument,
    });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await enterVisualMode(page, waitForEditorReady);
    const renderedHeadingCount = await page.locator(".cm-visual-heading").count();
    expect(
      renderedHeadingCount > 0 && renderedHeadingCount < 200,
      `Visual mode should mount only the viewport and overscan, not all 4,000 headings. rendered=${renderedHeadingCount}`,
    );
    expect(
      runtimeErrors.length === 0,
      `Viewport decoration should not emit runtime errors. errors=${runtimeErrors.join(" | ")}`,
    );
  });
}
