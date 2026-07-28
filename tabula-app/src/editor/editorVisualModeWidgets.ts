import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type {
  EditorVisualBlockRange,
  EditorVisualReplacement,
} from "./editorVisualModeModel";
import {
  getEditorVisualSourceMap,
} from "./editorVisualPositionMapping";
import {
  getEditorVisualWidgetId,
  highlightEditorVisualCode,
  renderEditorVisualDiagram,
  renderEditorVisualInlineMath,
  renderEditorVisualMathBlock,
} from "./editorVisualModeAsyncRender";
import {
  requestEditorVisualGeometryMeasure,
} from "./editorVisualViewport";
import {
  destroyEditorVisualMarkdown,
  mountEditorVisualMarkdown,
  mountEditorVisualMarkdownTable,
} from "./editorVisualMarkdown";
import type { EditorVisualModeCopy } from "./editorVisualModeTypes";

const visualSourceLabels: Partial<Record<EditorVisualReplacement["kind"], string>> = {
  accordion: "Edit accordion Markdown",
  callout: "Edit callout Markdown",
  code: "Edit code block Markdown",
  diagram: "Edit Mermaid Markdown",
  "footnote-definition": "Edit footnote Markdown",
  "footnote-reference": "Edit footnote Markdown",
  frontmatter: "Edit frontmatter Markdown",
  "horizontal-rule": "Edit separator Markdown",
  image: "Edit image Markdown",
  "inline-math": "Edit math Markdown",
  math: "Edit math Markdown",
  table: "Edit table Markdown",
  tabs: "Edit tabs Markdown",
};

const visualWidgetResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

abstract class RevealableBlockWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly sourceLabel: string,
  ) {
    super();
  }

  get estimatedHeight() {
    return 96;
  }

  protected makeContainer(view: EditorView, className: string) {
    const container = document.createElement("div");
    container.className = className;
    container.dataset.visualFrom = String(this.sourceFrom);
    container.dataset.visualTo = String(this.sourceTo);
    container.dataset.visualContentFrom = String(this.sourceFrom);
    container.dataset.visualContentTo = String(this.sourceTo);
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", this.sourceLabel);
    container.addEventListener("dragstart", (event) => event.preventDefault());
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        if (container.isConnected) requestEditorVisualGeometryMeasure(view);
      });
      observer.observe(container);
      visualWidgetResizeObservers.set(container, observer);
    }
    return container;
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element &&
      Boolean(event.target.closest("button, input, a, summary"));
  }

  destroy(dom: HTMLElement) {
    visualWidgetResizeObservers.get(dom)?.disconnect();
    visualWidgetResizeObservers.delete(dom);
    destroyEditorVisualMarkdown(dom);
  }
}

class FrontmatterWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly attributes: Array<{ key: string; value: string }>,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: FrontmatterWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      JSON.stringify(this.attributes) === JSON.stringify(other.attributes);
  }

  get estimatedHeight() {
    return Math.max(48, this.attributes.length * 32 + 24);
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-frontmatter",
    );
    for (const attribute of this.attributes) {
      const row = document.createElement("div");
      row.className = "cm-visual-frontmatter-row";
      const key = document.createElement("span");
      key.textContent = attribute.key;
      const value = document.createElement("strong");
      value.textContent = attribute.value;
      row.append(key, value);
      container.append(row);
    }
    return container;
  }
}

class ListMarkerWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  eq(other: ListMarkerWidget) {
    return this.label === other.label;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = "cm-visual-list-marker";
    marker.textContent = this.label;
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
    readonly copy: Pick<EditorVisualModeCopy, "markTaskComplete" | "markTaskIncomplete">,
  ) {
    super();
  }

  eq(other: TaskWidget) {
    return this.checked === other.checked &&
      this.from === other.from &&
      this.to === other.to &&
      this.copy.markTaskComplete === other.copy.markTaskComplete &&
      this.copy.markTaskIncomplete === other.copy.markTaskIncomplete;
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-visual-task";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.setAttribute(
      "aria-label",
      this.checked ? this.copy.markTaskIncomplete : this.copy.markTaskComplete,
    );
    checkbox.addEventListener("change", () => {
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: checkbox.checked ? "[x]" : "[ ]" },
      });
    });
    return checkbox;
  }

  ignoreEvent() {
    return true;
  }
}

class HorizontalRuleWidget extends RevealableBlockWidget {
  get estimatedHeight() {
    return 27;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-horizontal-rule",
    );
    container.append(document.createElement("hr"));
    return container;
  }
}

class InlineMathWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly sourceLabel: string,
    readonly expression: string,
  ) {
    super();
  }

  eq(other: InlineMathWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.expression === other.expression;
  }

  toDOM(view: EditorView) {
    const container = document.createElement("span");
    container.className = "cm-visual-inline-math";
    container.textContent = this.expression;
    container.dataset.visualFrom = String(this.sourceFrom);
    container.dataset.visualTo = String(this.sourceTo);
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", this.sourceLabel);
    renderEditorVisualInlineMath(container, this.expression, view);
    return container;
  }
}

class FootnoteReferenceWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly sourceLabel: string,
    readonly index: number,
    readonly label: string,
  ) {
    super();
  }

  eq(other: FootnoteReferenceWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.index === other.index &&
      this.label === other.label;
  }

  toDOM() {
    const reference = document.createElement("sup");
    reference.className = "cm-visual-footnote-reference";
    reference.textContent = String(this.index);
    reference.dataset.visualFrom = String(this.sourceFrom);
    reference.dataset.visualTo = String(this.sourceTo);
    reference.setAttribute("role", "group");
    reference.setAttribute("aria-label", `${this.sourceLabel}: ${this.label}`);
    return reference;
  }
}

class FootnoteDefinitionWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly index: number,
    readonly label: string,
    readonly body: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: FootnoteDefinitionWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.index === other.index &&
      this.label === other.label &&
      this.body === other.body;
  }

  get estimatedHeight() {
    return Math.max(44, this.body.split("\n").length * 27.2 + 16);
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-footnote-definition",
    );
    const marker = document.createElement("sup");
    marker.className = "cm-visual-footnote-definition-marker";
    marker.textContent = String(this.index);
    const body = document.createElement("div");
    body.className = "cm-visual-footnote-definition-body";
    mountEditorVisualMarkdown(container, body, this.body);
    container.append(marker, body);
    return container;
  }
}

class TableWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly alignments: Array<"left" | "center" | "right" | null>,
    readonly cellRanges: EditorVisualBlockRange[][],
    readonly header: string[],
    readonly rows: string[][],
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: TableWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      JSON.stringify(this.alignments) === JSON.stringify(other.alignments) &&
      JSON.stringify(this.cellRanges) === JSON.stringify(other.cellRanges) &&
      JSON.stringify(this.header) === JSON.stringify(other.header) &&
      JSON.stringify(this.rows) === JSON.stringify(other.rows);
  }

  get estimatedHeight() {
    return Math.max(96, (this.rows.length + 1) * 48 + 24);
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-table-frame",
    );
    mountEditorVisualMarkdownTable(
      container,
      container,
      this.alignments,
      this.header,
      this.rows,
      this.cellRanges,
    );
    return container;
  }
}

class ImageWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly source: string,
    readonly alt: string,
    readonly block: boolean,
    readonly unavailableLabel: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: ImageWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.source === other.source &&
      this.alt === other.alt &&
      this.block === other.block &&
      this.unavailableLabel === other.unavailableLabel;
  }

  get estimatedHeight() {
    return this.block ? 180 : 24;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      this.block
        ? "cm-visual-block cm-visual-image cm-visual-image-block"
        : "cm-visual-image",
    );
    const image = document.createElement("img");
    image.alt = this.alt;
    image.src = this.source;
    image.draggable = false;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => {
      container.classList.add("loaded");
      requestEditorVisualGeometryMeasure(view);
    }, { once: true });
    image.addEventListener("error", () => {
      container.classList.add("broken");
      image.remove();
      const fallback = document.createElement("span");
      fallback.className = "cm-visual-image-fallback";
      fallback.textContent = this.alt || this.unavailableLabel;
      container.append(fallback);
      requestEditorVisualGeometryMeasure(view);
    }, { once: true });
    container.append(image);
    return container;
  }
}

class CodeBlockWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly contentRange: EditorVisualBlockRange,
    readonly code: string,
    readonly language: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: CodeBlockWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.contentRange.from === other.contentRange.from &&
      this.contentRange.to === other.contentRange.to &&
      this.code === other.code &&
      this.language === other.language;
  }

  get estimatedHeight() {
    return Math.max(104, this.code.split("\n").length * 26.4 + 76.8);
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-code-block",
    );
    if (this.language) {
      const language = document.createElement("span");
      language.className = "cm-visual-code-language";
      language.textContent = this.language;
      container.append(language);
    }
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.dataset.visualContentFrom = String(this.contentRange.from);
    code.dataset.visualContentTo = String(this.contentRange.to);
    code.textContent = this.code;
    pre.append(code);
    container.append(pre);
    if (this.language) {
      highlightEditorVisualCode(
        container,
        code,
        this.code,
        this.language,
      );
    }
    return container;
  }
}

class MathBlockWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly expression: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: MathBlockWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.expression === other.expression;
  }

  get estimatedHeight() {
    return (this.expression.split("\n").length + 2) * 27.2;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-math-block",
    );
    container.style.setProperty(
      "--visual-source-lines",
      String(this.expression.split("\n").length + 2),
    );
    container.setAttribute("aria-label", `${this.sourceLabel}: ${this.expression}`);
    renderEditorVisualMathBlock(container, this.expression, view);
    return container;
  }
}

class DiagramBlockWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly source: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: DiagramBlockWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.source === other.source;
  }

  get estimatedHeight() {
    return 192;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-diagram-block",
    );
    const fallback = document.createElement("pre");
    fallback.textContent = this.source;
    container.append(fallback);
    renderEditorVisualDiagram(container, this.source, view);
    return container;
  }
}

class CalloutWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly calloutType: string,
    readonly title: string,
    readonly body: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: CalloutWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.calloutType === other.calloutType &&
      this.title === other.title &&
      this.body === other.body;
  }

  get estimatedHeight() {
    return Math.max(88, this.body.split("\n").length * 27 + 56);
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      `cm-visual-block cm-visual-callout cm-visual-callout-${this.calloutType}`,
    );
    const title = document.createElement("strong");
    title.className = "cm-visual-callout-title";
    title.textContent = this.title;
    container.append(title);
    if (this.body) {
      const body = document.createElement("div");
      body.className = "cm-visual-callout-body";
      mountEditorVisualMarkdown(container, body, this.body);
      container.append(body);
    }
    return container;
  }
}

class AccordionWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly title: string,
    readonly body: string,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: AccordionWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      this.title === other.title &&
      this.body === other.body;
  }

  get estimatedHeight() {
    return 56;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-accordion",
    );
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = this.title;
    summary.addEventListener("click", (event) => event.stopPropagation());
    const body = document.createElement("div");
    body.className = "cm-visual-component-body";
    mountEditorVisualMarkdown(container, body, this.body);
    details.append(summary, body);
    container.append(details);
    return container;
  }
}

class TabsWidget extends RevealableBlockWidget {
  constructor(
    sourceFrom: number,
    sourceTo: number,
    sourceLabel: string,
    readonly tabs: Array<{ title: string; body: string }>,
  ) {
    super(sourceFrom, sourceTo, sourceLabel);
  }

  eq(other: TabsWidget) {
    return this.sourceFrom === other.sourceFrom &&
      this.sourceTo === other.sourceTo &&
      this.sourceLabel === other.sourceLabel &&
      JSON.stringify(this.tabs) === JSON.stringify(other.tabs);
  }

  get estimatedHeight() {
    return 144;
  }

  toDOM(view: EditorView) {
    const container = this.makeContainer(
      view,
      "cm-visual-block cm-visual-tabs",
    );
    const widgetId = getEditorVisualWidgetId("tabula-visual-tabs");
    const tabList = document.createElement("div");
    tabList.className = "cm-visual-tab-list";
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-orientation", "horizontal");
    const panel = document.createElement("div");
    panel.className = "cm-visual-component-body";
    panel.setAttribute("role", "tabpanel");
    panel.id = `${widgetId}-panel`;

    const activate = (index: number, focus = false) => {
      mountEditorVisualMarkdown(container, panel, this.tabs[index]?.body ?? "");
      panel.setAttribute("aria-labelledby", `${widgetId}-tab-${index}`);
      for (const [buttonIndex, button] of [...tabList.querySelectorAll("button")].entries()) {
        button.setAttribute("aria-selected", String(buttonIndex === index));
        button.tabIndex = buttonIndex === index ? 0 : -1;
        if (focus && buttonIndex === index) {
          window.requestAnimationFrame(() => {
            if (button.isConnected) button.focus();
          });
        }
      }
    };

    for (const [index, tab] of this.tabs.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.id = `${widgetId}-tab-${index}`;
      button.setAttribute("aria-controls", panel.id);
      button.textContent = tab.title;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        activate(index, true);
      });
      button.addEventListener("keydown", (event) => {
        const lastIndex = this.tabs.length - 1;
        const nextIndex = event.key === "ArrowRight"
          ? (index + 1) % this.tabs.length
          : event.key === "ArrowLeft"
            ? (index - 1 + this.tabs.length) % this.tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? lastIndex
                : null;
        if (nextIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        activate(nextIndex, true);
      });
      tabList.append(button);
    }
    activate(0);
    container.append(tabList, panel);
    return container;
  }
}

export const createEditorVisualReplacementDecoration = (
  replacement: EditorVisualReplacement,
  copy: EditorVisualModeCopy,
) => {
  const sourceLabel = visualSourceLabels[replacement.kind] ?? "Edit Markdown source";
  switch (replacement.kind) {
    case "bullet":
      return Decoration.replace({ widget: new ListMarkerWidget(replacement.label) });
    case "task":
      return Decoration.replace({
        widget: new TaskWidget(replacement.checked, replacement.from, replacement.to, copy),
      });
    case "horizontal-rule":
      return Decoration.replace({
        block: true,
        widget: new HorizontalRuleWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
        ),
      });
    case "table":
      return Decoration.replace({
        block: true,
        widget: new TableWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.alignments,
          replacement.cellRanges,
          replacement.header,
          replacement.rows,
        ),
      });
    case "image":
      return Decoration.replace({
        block: replacement.block,
        widget: new ImageWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.source,
          replacement.alt,
          replacement.block,
          copy.imageFailed,
        ),
      });
    case "footnote-reference":
      return Decoration.replace({
        widget: new FootnoteReferenceWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.index,
          replacement.label,
        ),
      });
    case "frontmatter":
      return Decoration.replace({
        block: true,
        widget: new FrontmatterWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.attributes,
        ),
      });
    case "footnote-definition":
      return Decoration.replace({
        block: true,
        widget: new FootnoteDefinitionWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.index,
          replacement.label,
          replacement.body,
        ),
      });
    case "inline-math":
      return Decoration.replace({
        widget: new InlineMathWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.expression,
        ),
      });
    case "math":
      return Decoration.replace({
        block: true,
        widget: new MathBlockWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.expression,
        ),
      });
    case "code":
      {
        const sourceMap = getEditorVisualSourceMap(replacement);
      return Decoration.replace({
        block: true,
        widget: new CodeBlockWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          sourceMap.contentRange ?? sourceMap.range,
          replacement.code,
          replacement.language,
        ),
      });
      }
    case "diagram":
      return Decoration.replace({
        block: true,
        widget: new DiagramBlockWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.source,
        ),
      });
    case "callout":
      return Decoration.replace({
        block: true,
        widget: new CalloutWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.calloutType,
          replacement.title,
          replacement.body,
        ),
      });
    case "accordion":
      return Decoration.replace({
        block: true,
        widget: new AccordionWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.title,
          replacement.body,
        ),
      });
    case "tabs":
      return Decoration.replace({
        block: true,
        widget: new TabsWidget(
          replacement.from,
          replacement.to,
          sourceLabel,
          replacement.tabs,
        ),
      });
  }
};
