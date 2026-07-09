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
