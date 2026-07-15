import fs from "node:fs";
import path from "node:path";

export const id = "editor-preview-typography";
export const description = "Markdown preview typography, hierarchy, and visual rhythm contracts.";

const MARKDOWN_PREVIEW_TYPOGRAPHY_SCREENSHOT_PATH = path.join(
  process.cwd(),
  "output",
  "playwright",
  "markdown-preview-typography.png",
);

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const MARKDOWN_PREVIEW_TYPOGRAPHY_FIXTURE = [
  "---",
  "title: Typography fixture",
  "status: Draft",
  "owner: Product",
  "---",
  "",
  "# Heading One",
  "",
  "Paragraph text with `inline code`, **strong text**, and [a link](https://example.com).",
  "",
  "## Heading Two",
  "",
  "### Heading Three",
  "",
  "#### Heading Four",
  "",
  "##### Heading Five",
  "",
  "###### Heading Six",
  "",
  "> **Note:** Blockquote text should follow the base preview scale.",
  "",
  "> [!NOTE]",
  "> Alert title and alert body should use the preview scale.",
  "",
  "- List item one",
  "  - Nested list item",
  "- [x] Task item",
  "",
  "| Column | Value |",
  "| --- | ---: |",
  "| Alpha | 12 |",
  "",
  "```ts",
  "const value = 1;",
  "```",
  "",
  `![Tiny swatch](${TINY_PNG_DATA_URL} "Image caption")`,
  "",
  '<Frame caption="Frame caption" hint="Frame hint text">',
  `<img src="${TINY_PNG_DATA_URL}" alt="Frame image" />`,
  "</Frame>",
  "",
  '<CardGroup cols="2">',
  '<Card title="Card title" icon="T">Card description text.</Card>',
  '<Card title="Second card">Second card description.</Card>',
  "</CardGroup>",
  "",
  "Footnote reference.[^one]",
  "",
  "[^one]: Footnote body text.",
].join("\n");

const VIRTUAL_MARKDOWN_PREVIEW_TYPOGRAPHY_FIXTURE = [
  "# h1",
  "## h2",
  "### h3",
  "#### h4",
  "##### h5",
  "###### h6",
  "just text",
  "Virtual preview footnote reference.[^virtual-note]",
  ...Array.from({ length: 850 }, (_, index) => `Virtual preview filler line ${index + 1}.`),
  "",
  "[^virtual-note]: Virtual footnote body text.",
].join("\n");

const HEADING_SELECTORS = [
  ".preview-surface h1",
  ".preview-surface h2",
  ".preview-surface h3",
  ".preview-surface h4",
  ".preview-surface h5",
  ".preview-surface h6",
];

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    withPage,
  } = ctx;

  const readTypographyContract = async (page, rootSelector = ".preview-surface") =>
    page.evaluate(
      ({ headingSelectors, rootSelector }) => {
        const readTypography = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) {
            return null;
          }

          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            color: style.color,
            fontSize: Number.parseFloat(style.fontSize),
            fontWeight: Number.parseFloat(style.fontWeight),
            lineHeight: Number.parseFloat(style.lineHeight),
            marginBottom: Number.parseFloat(style.marginBottom),
            marginTop: Number.parseFloat(style.marginTop),
            text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
            top: rect.top,
          };
        };

        const readAll = (selectors) => selectors.map((selector) => readTypography(selector));
        const headingMetrics = readAll(headingSelectors);
        const paragraph = readTypography(`${rootSelector} .preview-document-content > p`);
        const headingGaps = headingMetrics
          .slice(0, -1)
          .map((heading, index) => {
            const nextHeading = headingMetrics[index + 1];
            return heading && nextHeading ? nextHeading.top - heading.bottom : null;
          })
          .filter((gap) => typeof gap === "number");

        return {
          root: readTypography(rootSelector),
          headings: headingMetrics,
          paragraph,
          frontmatterKey: readTypography(".frontmatter-row span"),
          frontmatterValue: readTypography(".frontmatter-row strong"),
          blockquoteParagraph: readTypography(".preview-surface blockquote p"),
          alertTitle: readTypography(".markdown-alert-title"),
          alertParagraph: readTypography(".markdown-alert p"),
          listItem: readTypography(".preview-surface li"),
          tableCell: readTypography(".preview-surface td"),
          inlineCode: readTypography(".preview-document-content > p code"),
          codeBlock: readTypography(".preview-surface pre code"),
          frameHint: readTypography(".preview-docs-frame-hint"),
          frameCaption: readTypography(".preview-docs-frame figcaption"),
          cardTitle: readTypography(".preview-docs-card-heading strong"),
          cardDescription: readTypography(".preview-docs-card-description"),
          footnotes: readTypography("section[data-footnotes]"),
          footnotesHeading: readTypography("section[data-footnotes] h2"),
          headingGaps,
        };
      },
      { headingSelectors: HEADING_SELECTORS, rootSelector },
    );

  const expectPresent = (metric, message) => {
    expect(Boolean(metric), `${message} should be present.`);
  };
  const expectTypographyAtLeastBase = (metric, message) => {
    expectPresent(metric, message);
    expect(metric.fontSize >= 16, `${message} should not render below the 16px preview text baseline.`);
  };
  const expectFontSizeBetween = (metric, min, max, message) => {
    expectPresent(metric, message);
    expect(metric.fontSize >= min && metric.fontSize <= max, `${message} should stay within the intended preview scale.`);
  };
  const expectSupportingText = (metric, bodyMetric, message) => {
    expectTypographyAtLeastBase(metric, message);
    expect(metric.color !== bodyMetric.color, `${message} should be visually subordinate to primary body text by color.`);
    expect(metric.fontWeight <= 500, `${message} should not carry heading/body emphasis weight.`);
  };

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(MARKDOWN_PREVIEW_TYPOGRAPHY_FIXTURE);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await page.waitForSelector(".preview-surface h6", { timeout: 5_000 });
    await page.waitForSelector(".preview-docs-card", { timeout: 5_000 });
    await page.waitForSelector("section[data-footnotes]", { timeout: 5_000 });
    await page.evaluate(() => {
      const workspace = document.querySelector(".workspace");
      const previewSurface = document.querySelector(".preview-surface");
      if (workspace instanceof HTMLElement) {
        workspace.scrollTop = 0;
      }
      if (previewSurface instanceof HTMLElement) {
        previewSurface.scrollTop = 0;
      }
    });
    await waitForRenderFrame(page);

    fs.mkdirSync(path.dirname(MARKDOWN_PREVIEW_TYPOGRAPHY_SCREENSHOT_PATH), { recursive: true });
    await page.locator(".workspace.preview .preview-document-content").screenshot({
      path: MARKDOWN_PREVIEW_TYPOGRAPHY_SCREENSHOT_PATH,
    });
    expect(fs.existsSync(MARKDOWN_PREVIEW_TYPOGRAPHY_SCREENSHOT_PATH), "Preview typography smoke should write a screenshot artifact.");
    expect(
      fs.statSync(MARKDOWN_PREVIEW_TYPOGRAPHY_SCREENSHOT_PATH).size > 2_000,
      "Preview typography screenshot artifact should contain a non-empty rendered document crop.",
    );

    const previewTypography = await readTypographyContract(page);
    const [h1, h2, h3, h4, h5, h6] = previewTypography.headings;

    expect(previewTypography.root?.fontSize === 16, "Preview surface should define a 16px base font size.");
    expectTypographyAtLeastBase(previewTypography.paragraph, "Preview paragraphs");
    expectTypographyAtLeastBase(previewTypography.alertTitle, "Preview alert titles");
    expectTypographyAtLeastBase(previewTypography.alertParagraph, "Preview alert bodies");
    expectTypographyAtLeastBase(previewTypography.listItem, "Preview list items");
    expectTypographyAtLeastBase(previewTypography.tableCell, "Preview table cells");
    expectTypographyAtLeastBase(previewTypography.inlineCode, "Preview inline code");
    expectTypographyAtLeastBase(previewTypography.codeBlock, "Preview code blocks");
    expectTypographyAtLeastBase(previewTypography.cardTitle, "Preview Card titles");
    expectTypographyAtLeastBase(previewTypography.footnotes, "Preview footnotes");
    expectSupportingText(previewTypography.frontmatterKey, previewTypography.paragraph, "Preview frontmatter keys");
    expectSupportingText(previewTypography.frontmatterValue, previewTypography.paragraph, "Preview frontmatter values");
    expectSupportingText(previewTypography.blockquoteParagraph, previewTypography.paragraph, "Preview blockquotes");
    expectSupportingText(previewTypography.frameHint, previewTypography.paragraph, "Preview Frame hints");
    expectSupportingText(previewTypography.frameCaption, previewTypography.paragraph, "Preview Frame captions");
    expectSupportingText(previewTypography.cardDescription, previewTypography.paragraph, "Preview Card descriptions");
    expectSupportingText(previewTypography.footnotesHeading, previewTypography.paragraph, "Preview footnote headings");
    expect(
      previewTypography.cardTitle.color === previewTypography.paragraph.color &&
        previewTypography.cardTitle.fontWeight > previewTypography.cardDescription.fontWeight,
      "Preview Card titles should read as primary labels while descriptions stay supporting.",
    );
    expect(
      h1?.fontSize > h2?.fontSize &&
        h2?.fontSize > h3?.fontSize &&
        h3?.fontSize > h4?.fontSize &&
        h4?.fontSize > h5?.fontSize &&
        h5?.fontSize > h6?.fontSize,
      "Preview heading hierarchy should step down clearly from H1 through H6.",
    );
    expectFontSizeBetween(h1, 28, 30, "Preview H1");
    expectFontSizeBetween(h2, 25, 26.5, "Preview H2");
    expectFontSizeBetween(h3, 22, 23.5, "Preview H3");
    expectFontSizeBetween(h4, 20, 21, "Preview H4");
    expect(h5?.fontSize === 18, "Preview H5 should keep a small heading step above body text.");
    expect(h6?.fontSize === 16, "Preview H6 should stay at the base text size.");
    expect(
      previewTypography.headings.every((heading) => heading?.color === previewTypography.paragraph.color),
      "Preview headings should use primary text color, including H6.",
    );
    expect(
      previewTypography.headings.every((heading) => {
        if (!heading) {
          return false;
        }
        const ratio = heading.lineHeight / heading.fontSize;
        return ratio >= 1.1 && ratio <= 1.25;
      }),
      "Preview headings should keep compact heading line-height instead of body paragraph rhythm.",
    );
    expect(
      previewTypography.headingGaps.slice(1).every((gap) => gap >= 0 && gap <= 28),
      "Preview consecutive H2-H6 gaps should stay compact enough for Markdown outline reading.",
    );
    expect(
      h6?.top < previewTypography.blockquoteParagraph.top,
      "Preview heading stack should keep H6 directly before the following body content.",
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const splitPreviewTypography = await page.evaluate(() => {
      const readFontSize = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? Number.parseFloat(window.getComputedStyle(element).fontSize) : 0;
      };

      return {
        surface: readFontSize(".workspace.split .preview-surface"),
        h4: readFontSize(".workspace.split .preview-surface h4"),
        h5: readFontSize(".workspace.split .preview-surface h5"),
        h6: readFontSize(".workspace.split .preview-surface h6"),
        paragraph: readFontSize(".workspace.split .preview-document-content > p"),
      };
    });
    expect(splitPreviewTypography.surface === 16, "Split preview should keep the same 16px preview base.");
    expect(splitPreviewTypography.paragraph >= 16, "Split preview paragraphs should not shrink below the preview baseline.");
    expect(splitPreviewTypography.h4 >= 20, "Split preview H4 should keep readable heading contrast.");
    expect(splitPreviewTypography.h5 === 18, "Split preview H5 should keep a small heading step above body text.");
    expect(splitPreviewTypography.h6 === 16, "Split preview H6 should keep the base text size.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(VIRTUAL_MARKDOWN_PREVIEW_TYPOGRAPHY_FIXTURE);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await page.waitForSelector("[data-preview-virtual-content]", { timeout: 5_000 });
    await page.waitForSelector(".preview-surface h6", { timeout: 5_000 });
    const virtualPreviewTypography = await page.evaluate(({ headingSelectors }) => {
      const readBlock = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          bottom: rect.bottom,
          color: style.color,
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: Number.parseFloat(style.lineHeight),
          top: rect.top,
        };
      };

      const headings = headingSelectors.map((selector) => readBlock(selector));
      const paragraph = readBlock(".preview-surface p");
      return {
        isVirtualized: Boolean(document.querySelector("[data-preview-virtual-content]")),
        blockAfterGaps: Array.from(document.querySelectorAll("[data-preview-block-after-gap]"))
          .slice(0, 6)
          .map((element) => Number(element.getAttribute("data-preview-block-after-gap") ?? "0")),
        footnoteRefCount: document.querySelectorAll(".preview-surface sup [data-footnote-ref]").length,
        linkedFootnoteRefCount: document.querySelectorAll('.preview-surface sup a[href^="#user-content-fn-"]').length,
        footnoteSectionCount: document.querySelectorAll("[data-preview-virtual-content] section[data-footnotes]").length,
        footnoteText: document.querySelector(".preview-footnote-collector section[data-footnotes]")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        headings,
        paragraph,
        headingGaps: headings
          .slice(0, -1)
          .map((heading, index) => {
            const nextHeading = headings[index + 1];
            return heading && nextHeading ? nextHeading.top - heading.bottom : null;
          })
          .filter((gap) => typeof gap === "number"),
      };
    }, { headingSelectors: HEADING_SELECTORS });
    const [virtualH1, virtualH2, virtualH3, virtualH4, virtualH5, virtualH6] = virtualPreviewTypography.headings;
    expect(virtualPreviewTypography.isVirtualized, "Long preview typography fixture should exercise the virtualized preview path.");
    expect(
      virtualH1?.fontSize > virtualH2?.fontSize &&
        virtualH2?.fontSize > virtualH3?.fontSize &&
        virtualH3?.fontSize > virtualH4?.fontSize &&
        virtualH4?.fontSize > virtualH5?.fontSize &&
        virtualH5?.fontSize > virtualH6?.fontSize,
      "Virtualized preview should keep the same H1-H6 heading scale.",
    );
    expect(
      virtualPreviewTypography.headings.every((heading) => heading?.color === virtualPreviewTypography.paragraph?.color),
      "Virtualized preview headings should use primary text color.",
    );
    expect(
      virtualPreviewTypography.headingGaps.every((gap) => gap >= 0 && gap <= 28),
      "Virtualized preview should not add wrapper margin on top of Markdown heading rhythm.",
    );
    expect(
      virtualPreviewTypography.blockAfterGaps.every((gap) => gap >= 0 && gap <= 28),
      "Virtualized preview should encode compact block gaps instead of relying on child margin collapse.",
    );
    expect(
      virtualPreviewTypography.footnoteRefCount === 1,
      `Virtualized preview should render the source footnote reference once. Found ${virtualPreviewTypography.footnoteRefCount}.`,
    );
    expect(
      virtualPreviewTypography.linkedFootnoteRefCount === 0,
      "Footnote references should not create fragment links in the workspace URL.",
    );
    expect(
      virtualPreviewTypography.footnoteSectionCount === 1 &&
        virtualPreviewTypography.footnoteText.includes("Virtual footnote body text."),
      "Virtualized preview should render one collected footnote section at the document end.",
    );
    expect(
      virtualPreviewTypography.headings.every((heading) => {
        if (!heading) {
          return false;
        }
        const ratio = heading.lineHeight / heading.fontSize;
        return ratio >= 1.1 && ratio <= 1.25;
      }),
      "Virtualized preview headings should keep compact heading line-height.",
    );
  });
}
