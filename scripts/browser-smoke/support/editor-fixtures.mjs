export const buildEditorCertificationMarkdown = () => {
  const longLine = Array.from({ length: 48 }, (_, index) => `unwrapped-segment-${index + 1}`).join(" ");

  return [
    "---",
    "title: Editor Certification",
    "tags:",
    "  - tabula",
    "  - editor",
    "---",
    "",
    "# Editor Certification",
    "",
    "한글 IME 기준 문장입니다. 커서와 선택 영역이 흔들리면 안 됩니다.",
    "",
    "## Nested Lists",
    "",
    "- parent item",
    "  - child item",
    "    - grandchild item",
    "1. first ordered item",
    "2. second ordered item",
    "",
    "## Checklist",
    "",
    "- [ ] write certification smoke",
    "- [x] keep Markdown source as truth",
    "",
    "## Table",
    "",
    "| Area | Expected |",
    "| --- | --- |",
    "| Search | finds text |",
    "| Replace | changes text |",
    "",
    "## Code",
    "",
    "```ts",
    "const message = `Tabula editor certification`;",
    "console.log(message);",
    "```",
    "",
    "## Link And Image",
    "",
    "[Tabula](https://tabula.md) and ![alt text](https://tabula.md/favicon.svg)",
    "",
    "## Long Line",
    "",
    longLine,
    "",
    "## Comments",
    "",
    "Select this sentence when testing comment and selection surfaces.",
  ].join("\n");
};

export const buildLargeEditorMarkdown = ({ sections = 250, paragraphRepeats = 2 } = {}) => {
  const paragraph =
    "Tabula keeps Markdown source editable, local-first, and suitable for people and agents while preserving comments, preview, handoff, and collaboration semantics.";

  return Array.from({ length: sections }, (_, index) =>
    [
      `## Large Document Section ${index + 1}`,
      "",
      Array.from({ length: paragraphRepeats }, () => paragraph).join(" "),
      "",
      `- Item ${index + 1}.1`,
      `- Item ${index + 1}.2`,
      `- [ ] Task ${index + 1}`,
      "",
      "| Column | Value |",
      "| --- | --- |",
      `| Section | ${index + 1} |`,
    ].join("\n"),
  ).join("\n\n");
};

export const buildOneMegabyteEditorMarkdown = () => {
  const seed = buildLargeEditorMarkdown({ sections: 300, paragraphRepeats: 4 });
  const chunks = [];
  let byteLength = 0;
  let index = 0;

  while (byteLength < 1_000_000) {
    const chunk = `\n\n<!-- chunk ${index + 1} -->\n\n${seed}`;
    chunks.push(chunk);
    byteLength += new TextEncoder().encode(chunk).byteLength;
    index += 1;
  }

  return chunks.join("").trimStart();
};

export const buildHtmxSplitPreviewSyncMarkdown = () => {
  const lines = [
    "# Documentation",
    "",
    '<hr data-sidebar-group="Get Started" />',
    "",
    "## Installation",
    "",
    "htmx is a single JavaScript file with no dependencies. No build step is required to use it.",
    "",
    "```html",
    '<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0-beta5" crossorigin="anonymous"></script>',
    "```",
    "",
  ];

  const paragraph =
    "This synthetic htmx-shaped document keeps tables, raw HTML, code fences, long links, and dense bottom sections in one virtualized split preview fixture.";
  let section = 1;
  while (lines.length < 3_169) {
    lines.push(
      `## Reference Section ${section}`,
      "",
      `${paragraph} Section ${section} includes enough prose to vary rendered block height.`,
      "",
      "| Config | Default | Description |",
      "| --- | --- | --- |",
      `| htmx.config.option${section} | true | Long description for virtual preview mapping and measurement. |`,
      `| htmx.config.delay${section} | 20 | Another row that changes rendered table height. |`,
      "",
      "```html",
      `<div hx-get="/reference/${section}" hx-target="#result-${section}">`,
      `  <button>Load ${section}</button>`,
      "</div>",
      "```",
      "",
      section % 5 === 0 ? '<hr data-sidebar-group="Advanced" />' : `- [ ] Review htmx pattern ${section}`,
      "",
    );
    section += 1;
  }

  lines.length = 3_169;
  lines.splice(
    99,
    19,
    "* In htmx 2.0, `400` and `500` response codes are not",
    "  swapped",
    "",
    "Add these two config lines to restore htmx 2.x behavior:",
    "",
    "```html",
    "<script>",
    "  htmx.config.implicitInheritance = true;",
    "  htmx.config.noSwap = [204, 304, '4xx', '5xx'];",
    "</script>",
    '<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0-beta5/dist/htmx.min.js"></script>',
    "```",
    "",
    "[`implicitInheritance`](https://four.htmx.org/reference/config/htmx-config-implicitInheritance) restores htmx 2's implicit attribute",
    "inheritance. [`noSwap`](https://four.htmx.org/reference/config/htmx-config-noSwap)",
    "prevents swapping error responses.",
    "",
    "Or load the [`htmx-2-compat`] extension, which restores implicit inheritance.",
    "",
  );
  lines.length = 3_169;
  lines.push(
    "| htmx.config.morphScanLimit | limits the number of nodes scanned during morphing |",
    "| htmx.config.morphSkip | defaults to `[hx-morph-skip]`, CSS selector for elements to skip |",
    "| htmx.config.morphSkipChildren | defaults to `[hx-morph-skip-children]`, CSS selector for child preservation |",
    "| htmx.config.noSwap | defaults to `[204, 304]`, array of HTTP status codes that should not trigger a swap |",
    "| htmx.config.implicitInheritance | defaults to false, attributes inherit only with the `:inherited` modifier |",
    "| htmx.config.defaultSettleDelay | defaults to 1 (ms), delay between swap and settle phases |",
    "| htmx.config.metaCharacter | defaults to undefined, allows a custom character instead of `:` |",
    "</div>",
    "",
    "You can set most options directly in JavaScript, or you can use a `meta` tag (accepts [HCON](#hcon) or JSON):",
    "> **Note:** Some options are read only once during initialisation and must be set via the `meta` tag to take effect.",
    "",
    "```html",
    '<meta name="htmx-config" content=\'{"defaultSwap":"innerHTML"}\'>',
    "```",
    "",
    "### Conclusion",
    "",
    "And that's it!",
    "",
    "Have fun with htmx!",
    "",
    "You can accomplish [quite a bit]",
    "(https://four.htmx.org/patterns) without writing a lot of code!",
    '<hr data-sidebar-group="Editor Support" />',
    "",
    "## VS Code",
    "The [HTMX Toolkit]",
    "(https://marketplace.visualstudio.com/items?itemName=atoolz.htmx-vscode-toolkit) extension adds htmx",
    "support to Visual Studio Code with autocomplete, hover documentation, and snippets.",
    "",
    "### Features",
    "- Attribute autocomplete for all htmx attributes (`hx-get`, `hx-post`, `hx-target`, etc.)",
    "- Hover documentation with links to the official docs",
    "- Snippets for common htmx patterns",
    "- Support for htmx 2.x and 4.x",
    "",
    "### Installing",
    "",
    "Search for **HTMX Toolkit** in the VS Code Extensions panel, or install from the [Visual Studio Marketplace]",
    "(https://marketplace.visualstudio.com/items?itemName=atoolz.htmx-vscode-toolkit).",
    "### Source",
    "",
    "The extension source code is maintained at [atoolz/htmx-vscode-toolkit]",
    "(https://github.com/atoolz/htmx-vscode-toolkit).",
    "<style>{`[data-sidebar-group] { display: none; }`}</style>",
    "",
    "### Final Rendered Block",
    "The final block proves document bottom renders instead of blanking the preview.",
  );

  return lines.join("\n");
};

export const buildAsyncPreviewMediaMarkdown = () => {
  const lines = [
    "# Async Preview Media",
    "",
    "This fixture keeps delayed media, math, mermaid, raw HTML, and dense prose in one virtualized split preview document.",
    "",
  ];
  const paragraph =
    "Preview sync should stay source-anchored even when rendered block heights change after the first paint.";

  for (let section = 1; section <= 180; section += 1) {
    lines.push(
      `## Async Section ${section}`,
      "",
      `${paragraph} Section ${section} repeats enough prose to keep the document virtualized and scrollable.`,
      "",
    );

    if (section === 78) {
      lines.push(
        "### Delayed Media Anchor",
        "",
        "The delayed image below intentionally changes rendered height after preview has already aligned.",
        "",
        "![Delayed media anchor](https://media.tabula.test/tabula-delayed-media.svg?case=async-height)",
        "",
        "Text immediately after delayed media should remain near the same preview context.",
        "",
        "```mermaid",
        "graph TD",
        "  A[Delayed media] --> B[Stable preview]",
        "```",
        "",
        "$$",
        "a^2 + b^2 = c^2",
        "$$",
        "",
        '<div data-async-preview-raw-html="true">',
        "  <strong>Raw HTML after delayed media</strong>",
        "</div>",
        "",
      );
    }

    if (section % 9 === 0) {
      lines.push(
        "| Area | Expected |",
        "| --- | --- |",
        `| Async ${section} | no late preview jump |`,
        "",
      );
    }

    if (section % 7 === 0) {
      lines.push(
        "```html",
        `<section data-async-section="${section}">`,
        `  <button>Async ${section}</button>`,
        "</section>",
        "```",
        "",
      );
    }
  }

  return lines.join("\n");
};
