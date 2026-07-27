import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from "@codemirror/view";
import {
  EditorSelection,
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Transaction,
} from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { SyntaxNode } from "@lezer/common";
import {
  createMarkdownPresentationDocument,
  type PresentationNode,
} from "@tabula-md/tabula";
import {
  buildEditorVisualModel,
  findEditorVisualReplacementInRange,
  type EditorVisualBlockRange,
  type EditorVisualReplacement,
} from "./editorVisualModeModel";
import {
  findEditorVisualMappedBlockAt,
  findEditorVisualMappedBlockOnLine,
  getEditorVisualBlockEntryPosition,
  getEditorVisualPointerPosition,
  getEditorVisualSourceMap,
  readEditorVisualPointerTextPoint,
} from "./editorVisualPositionMapping";
import { revealEditorVisualSelection } from "./editorVisualEffects";
import {
  destroyEditorVisualMarkdown,
  mountEditorVisualMarkdown,
  mountEditorVisualMarkdownTable,
} from "./editorVisualMarkdown";
import type {
  MarkdownPreviewProps,
  MarkdownPreviewWorkspaceLink,
} from "../preview/markdownPreviewTypes";
import { classifyMarkdownHref } from "../preview/markdownHref";

let visualDiagramId = 0;
let mermaidRuntimePromise: Promise<typeof import("mermaid").default> | null = null;
type KatexRuntime = {
  renderToString: (
    expression: string,
    options: {
      displayMode: boolean;
      output: "htmlAndMathml";
      strict: boolean;
      throwOnError: boolean;
      trust: boolean;
    },
  ) => string;
};

let katexRuntimePromise: Promise<KatexRuntime> | null = null;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
let initializedMermaidTheme: "dark" | "default" | null = null;

const getKatexRuntime = () => {
  katexRuntimePromise ??= import("katex/dist/katex.min.js").then((module) => {
    const maybeModule = module as unknown as { default?: KatexRuntime } & KatexRuntime;
    return maybeModule.default ?? maybeModule;
  });
  return katexRuntimePromise;
};

export type EditorVisualModeCopy = {
  imageFailed: string;
  markTaskComplete: string;
  markTaskIncomplete: string;
};

type EditorVisualModeOptions = {
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
  sourceDocumentId?: string;
};

type EditorVisualWorkspaceLinkRange = {
  from: number;
  status: MarkdownPreviewWorkspaceLink["status"] | "external" | "heading";
  to: number;
};

const getDirectLinkChildren = (node: SyntaxNode) => {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }
  return children;
};

const flattenPresentationNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenPresentationNodes(node.children),
]);

export const getEditorVisualWorkspaceLinkRanges = (
  state: EditorState,
  options: EditorVisualModeOptions,
): EditorVisualWorkspaceLinkRange[] => {
  const { resolveWorkspaceLink, sourceDocumentId } = options;

  const ranges: EditorVisualWorkspaceLinkRange[] = [];
  const presentation = createMarkdownPresentationDocument(
    state.doc.toString(),
  );
  for (const node of flattenPresentationNodes(presentation.blocks)) {
    if (
      node.type !== "link" ||
      !node.contentRange ||
      !node.data?.url
    ) {
      continue;
    }
    const labelFrom = node.contentRange.from;
    const labelTo = node.contentRange.to;
    const overlapsSelection = state.selection.ranges.some((selection) =>
      !selection.empty && selection.from < labelTo && selection.to > labelFrom);
    if (overlapsSelection) continue;

    if (node.data.linkKind === "external") {
      if (classifyMarkdownHref(node.data.url).kind === "external") {
        ranges.push({ from: labelFrom, status: "external", to: labelTo });
      }
      continue;
    }
    if (node.data.linkKind === "internal-heading") {
      ranges.push({ from: labelFrom, status: "heading", to: labelTo });
      continue;
    }
    if (!resolveWorkspaceLink || !sourceDocumentId) continue;
    const workspaceLink = resolveWorkspaceLink(node.data.url, "markdown", {
      relation: "link",
      sourceDocumentId,
    });
    if (!workspaceLink) continue;
    ranges.push({
      from: labelFrom,
      status: workspaceLink.status,
      to: labelTo,
    });
  }

  syntaxTree(state).iterate({
    enter(reference) {
      if (reference.name !== "Link" || reference.node.parent?.name === "Image") return;
      const node = reference.node;
      const children = getDirectLinkChildren(node);
      const marks = children.filter((child) => child.name === "LinkMark");
      const url = children.find((child) => child.name === "URL");
      const referenceLabel = children.find((child) => child.name === "LinkLabel");
      const isWikiLink =
        node.from > 0 &&
        node.to < state.doc.length &&
        state.doc.sliceString(node.from - 1, node.from + 1) === "[[" &&
        state.doc.sliceString(node.to - 1, node.to + 1) === "]]";

      if (!isWikiLink || url || referenceLabel) return;
      const target = state.doc
        .sliceString(node.from + 1, node.to - 1)
        .split("|", 1)[0]
        ?.trim();

      const labelFrom = marks[0]?.to;
      const labelTo = marks[1]?.from;
      if (
        !target ||
        labelFrom === undefined ||
        labelTo === undefined ||
        labelFrom >= labelTo
      ) {
        return;
      }

      const overlapsSelection = state.selection.ranges.some((selection) =>
        !selection.empty && selection.from < labelTo && selection.to > labelFrom);
      if (overlapsSelection) return;
      if (!resolveWorkspaceLink || !sourceDocumentId) return;
      const workspaceLink = resolveWorkspaceLink(target, "wikilink", {
        relation: "link",
        sourceDocumentId,
      });
      if (!workspaceLink) return;
      ranges.push({
        from: labelFrom,
        status: workspaceLink.status,
        to: labelTo,
      });
    },
  });
  return ranges;
};

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

const renderMermaidDiagram = (
  id: string,
  source: string,
  theme: "dark" | "default",
  isCurrent: () => boolean,
) => {
  const render = mermaidRenderQueue.then(async () => {
    if (!isCurrent()) return null;
    mermaidRuntimePromise ??= import("mermaid").then((module) => module.default ?? module);
    const mermaid = await mermaidRuntimePromise;
    if (!isCurrent()) return null;
    if (initializedMermaidTheme !== theme) {
      mermaid.initialize({
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
        theme,
      });
      initializedMermaidTheme = theme;
    }
    return mermaid.render(id, source);
  });
  mermaidRenderQueue = render.then(() => undefined, () => undefined);
  return render;
};

const visualSourceHighlightStyle = HighlightStyle.define([
  { tag: tags.strong, class: "cm-visual-strong" },
  { tag: tags.emphasis, class: "cm-visual-emphasis" },
  { tag: tags.strikethrough, class: "cm-visual-strikethrough" },
  { tag: tags.link, class: "cm-visual-link" },
  { tag: tags.url, class: "cm-visual-link-url" },
  { tag: tags.monospace, class: "cm-visual-inline-code" },
  { tag: tags.keyword, class: "cm-visual-token-keyword" },
  { tag: [tags.atom, tags.bool, tags.number], class: "cm-visual-token-literal" },
  { tag: tags.string, class: "cm-visual-token-string" },
  { tag: tags.operator, class: "cm-visual-token-operator" },
  { tag: [tags.comment, tags.quote], class: "cm-visual-token-comment" },
  { tag: tags.meta, class: "cm-visual-token-meta" },
]);

type EditorVisualInteraction = {
  editing: EditorVisualBlockRange | null;
};

const setVisualInteraction = StateEffect.define<Partial<EditorVisualInteraction>>();
const VISUAL_CURSOR_SAFE_MARGIN = 48;
const VISUAL_POINTER_ACTIVATING_CLASS = "cm-visual-pointer-activating";
const visualWidgetResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

const isInteractiveVisualTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest("button, input, a, summary"));

const concealAtomicPointerCursor = (
  view: EditorView,
  event: PointerEvent,
) => {
  if (event.button !== 0 || isInteractiveVisualTarget(event.target)) return;
  const pointerSurface =
    view.dom.closest<HTMLElement>(".markdown-editor") ?? view.dom;
  pointerSurface.classList.add(VISUAL_POINTER_ACTIVATING_CLASS);
  const clear = () => {
    window.removeEventListener("pointerup", clear, true);
    window.removeEventListener("pointercancel", clear, true);
    let remainingFrames = 6;
    const revealWhenStable = () => {
      requestAnimationFrame(() => {
        const cursor = view.dom.querySelector(".cm-cursor-primary");
        const cursorHeight = cursor?.getBoundingClientRect().height ?? 0;
        if (cursorHeight > VISUAL_CURSOR_SAFE_MARGIN && remainingFrames > 0) {
          remainingFrames -= 1;
          revealWhenStable();
          return;
        }
        pointerSurface.classList.remove(VISUAL_POINTER_ACTIVATING_CLASS);
      });
    };
    revealWhenStable();
  };
  window.addEventListener("pointerup", clear, true);
  window.addEventListener("pointercancel", clear, true);
};

const editSource = (
  view: EditorView,
  block: EditorVisualBlockRange,
  anchor = block.from,
) => {
  view.dispatch({
    effects: [
      setVisualInteraction.of({ editing: block }),
      EditorView.scrollIntoView(anchor, {
        y: "nearest",
        yMargin: VISUAL_CURSOR_SAFE_MARGIN,
      }),
    ],
    selection: { anchor },
  });
  view.focus();
};

const moveByVisualLine = (
  view: EditorView,
  forward: boolean,
  replacements: readonly EditorVisualReplacement[],
  editingBlock: EditorVisualBlockRange | null,
) => {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const currentLine = view.state.doc.lineAt(selection.head);
  const adjacentLineNumber = currentLine.number + (forward ? 1 : -1);
  if (adjacentLineNumber < 1 || adjacentLineNumber > view.state.doc.lines) return false;
  const block = findEditorVisualMappedBlockOnLine(
    view.state,
    replacements,
    adjacentLineNumber,
  );
  if (block) {
    editSource(
      view,
      { from: block.from, to: block.to },
      getEditorVisualBlockEntryPosition(
        view.state,
        block,
        forward,
        selection.head - currentLine.from,
      ),
    );
  } else if (
    editingBlock &&
    currentLine.from <= editingBlock.to &&
    currentLine.to >= editingBlock.from
  ) {
    const adjacentLine = view.state.doc.line(adjacentLineNumber);
    const column = selection.head - currentLine.from;
    const nextSelection = EditorSelection.cursor(
      Math.min(adjacentLine.to, adjacentLine.from + column),
      forward ? 1 : -1,
    );
    view.dispatch({
      selection: view.state.selection.replaceRange(nextSelection),
      effects: EditorView.scrollIntoView(nextSelection.head, {
        y: "nearest",
        yMargin: VISUAL_CURSOR_SAFE_MARGIN,
      }),
    });
  } else {
    const moved = view.moveVertically(selection, forward);
    if (moved.head === selection.head) return false;
    const movedLine = view.state.doc.lineAt(moved.head);
    const nextSelection = movedLine.number === currentLine.number
      ? moved
      : (() => {
          const adjacentLine = view.state.doc.line(adjacentLineNumber);
          const column = selection.head - currentLine.from;
          return EditorSelection.cursor(
            Math.min(adjacentLine.to, adjacentLine.from + column),
            forward ? 1 : -1,
            undefined,
            moved.goalColumn,
          );
        })();
    view.dispatch({
      selection: view.state.selection.replaceRange(nextSelection),
      effects: EditorView.scrollIntoView(nextSelection.head, {
        y: "nearest",
        yMargin: VISUAL_CURSOR_SAFE_MARGIN,
      }),
    });
  }
  return true;
};

const editSourceAtPointer = (
  view: EditorView,
  block: EditorVisualBlockRange,
  container: HTMLElement,
  clientX: number,
  clientY: number,
) => {
  const replacement = findEditorVisualReplacementInRange(
    view.state,
    block.from,
    block.to,
  ) ?? block;
  const rect = container.getBoundingClientRect();
  const anchor = getEditorVisualPointerPosition(
    view.state,
    replacement,
    {
      clientX,
      clientY,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    },
    readEditorVisualPointerTextPoint(container, clientX, clientY),
  );
  editSource(view, block, anchor);
};

const moveIntoVisualBlockHorizontally = (
  view: EditorView,
  forward: boolean,
  replacements: readonly EditorVisualReplacement[],
) => {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const target = selection.head + (forward ? 1 : -1);
  if (target < 0 || target > view.state.doc.length) return false;
  const block = findEditorVisualMappedBlockAt(replacements, target);
  if (!block) return false;
  const crossesIntoBlock = forward
    ? selection.head <= block.from && target >= block.from
    : selection.head >= block.to && target <= block.to;
  if (!crossesIntoBlock) return false;
  editSource(
    view,
    block,
    getEditorVisualBlockEntryPosition(view.state, block, forward),
  );
  return true;
};

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
    const block = { from: this.sourceFrom, to: this.sourceTo };
    container.addEventListener("dragstart", (event) => event.preventDefault());
    container.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        isInteractiveVisualTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      editSourceAtPointer(
        view,
        block,
        container,
        event.clientX,
        event.clientY,
      );
    });
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        if (container.isConnected) view.requestMeasure();
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
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", this.sourceLabel);
    container.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const replacement = findEditorVisualReplacementInRange(
        view.state,
        this.sourceFrom,
        this.sourceTo,
      ) ?? { from: this.sourceFrom, to: this.sourceTo };
      editSource(
        view,
        { from: this.sourceFrom, to: this.sourceTo },
        getEditorVisualBlockEntryPosition(view.state, replacement, true),
      );
    });
    void getKatexRuntime()
      .then((katex) => {
        if (!container.isConnected) return;
        container.innerHTML = katex.renderToString(this.expression, {
          displayMode: false,
          output: "htmlAndMathml",
          strict: false,
          throwOnError: false,
          trust: false,
        });
        view.requestMeasure();
      })
      .catch(() => undefined);
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

  toDOM(view: EditorView) {
    const reference = document.createElement("sup");
    reference.className = "cm-visual-footnote-reference";
    reference.textContent = String(this.index);
    reference.setAttribute("role", "group");
    reference.setAttribute("aria-label", `${this.sourceLabel}: ${this.label}`);
    reference.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const replacement = findEditorVisualReplacementInRange(
        view.state,
        this.sourceFrom,
        this.sourceTo,
      ) ?? { from: this.sourceFrom, to: this.sourceTo };
      editSource(
        view,
        { from: this.sourceFrom, to: this.sourceTo },
        getEditorVisualBlockEntryPosition(view.state, replacement, true),
      );
    });
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
      view.requestMeasure();
    }, { once: true });
    image.addEventListener("error", () => {
      container.classList.add("broken");
      image.remove();
      const fallback = document.createElement("span");
      fallback.className = "cm-visual-image-fallback";
      fallback.textContent = this.alt || this.unavailableLabel;
      container.append(fallback);
      view.requestMeasure();
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
      void import("highlight.js/lib/common")
        .then((module) => {
          if (!container.isConnected) return;
          const highlighter = module.default ?? module;
          const result = highlighter.getLanguage(this.language)
            ? highlighter.highlight(this.code, { language: this.language })
            : null;
          if (!result) return;
          code.innerHTML = result.value;
          code.classList.add("hljs");
        })
        .catch(() => undefined);
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
    void getKatexRuntime()
      .then((katex) => {
        if (!container.isConnected) return;
        container.innerHTML = katex.renderToString(this.expression, {
          displayMode: true,
          output: "htmlAndMathml",
          strict: false,
          throwOnError: false,
          trust: false,
        });
        view.requestMeasure();
      })
      .catch(() => {
        if (!container.isConnected) return;
        container.classList.add("error");
        container.textContent = this.expression;
      });
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
    const diagramId = `tabula-visual-diagram-${visualDiagramId += 1}`;
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "default";
    void renderMermaidDiagram(
      diagramId,
      this.source,
      theme,
      () => container.isConnected,
    )
      .then((rendered) => {
        if (!rendered) return;
        if (!container.isConnected) return;
        container.innerHTML = rendered.svg;
        view.requestMeasure();
      })
      .catch(() => container.classList.add("error"));
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
    const widgetId = `tabula-visual-tabs-${visualDiagramId += 1}`;
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

const createReplacementDecoration = (
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

type EditorVisualDecorationSets = {
  decorations: DecorationSet;
  atomicRanges: DecorationSet;
  replacements: readonly EditorVisualReplacement[];
};

const buildVisualDecorationSets = (
  state: EditorState,
  interaction: EditorVisualInteraction,
  copy: EditorVisualModeCopy,
  options: EditorVisualModeOptions,
): EditorVisualDecorationSets => {
  const model = buildEditorVisualModel(
    state,
    [{ from: 0, to: state.doc.length }],
    interaction.editing,
  );
  const lineRanges = model.lines.map(({ className, from }) =>
    Decoration.line({ class: className }).range(from));
  const hiddenRanges = model.hiddenRanges.map(({ from, to }) =>
    Decoration.replace({}).range(from, to));
  const replacementRanges = model.replacements.map((replacement) =>
    createReplacementDecoration(replacement, copy).range(replacement.from, replacement.to));
  const workspaceLinkRanges = getEditorVisualWorkspaceLinkRanges(state, options).map(
    ({ from, status, to }) =>
      Decoration.mark({
        class: `cm-visual-workspace-link cm-visual-workspace-link-${status}`,
      }).range(from, to),
  );
  return {
    decorations: Decoration.set(
      [...lineRanges, ...hiddenRanges, ...replacementRanges, ...workspaceLinkRanges],
      true,
    ),
    atomicRanges: Decoration.set(
      [...hiddenRanges, ...replacementRanges],
      true,
    ),
    replacements: model.replacements,
  };
};

const mapBlock = (
  block: EditorVisualBlockRange | null,
  transaction: Transaction,
) => block && transaction.docChanged
  ? {
      from: transaction.changes.mapPos(block.from, -1),
      to: transaction.changes.mapPos(block.to, 1),
    }
  : block;

const updateVisualInteraction = (
  value: EditorVisualInteraction,
  transaction: Transaction,
): EditorVisualInteraction => {
  let editing = mapBlock(value.editing, transaction);
  let explicitlyEdited = false;
  let revealSelection = false;

  for (const effect of transaction.effects) {
    if (effect.is(setVisualInteraction)) {
      if ("editing" in effect.value) {
        editing = effect.value.editing ?? null;
        explicitlyEdited = true;
      }
      continue;
    }
    if (effect.is(revealEditorVisualSelection)) revealSelection = true;
  }

  if (revealSelection && !explicitlyEdited) {
    const selection = transaction.state.selection.main;
    const block = findEditorVisualReplacementInRange(
      transaction.state,
      selection.from,
      selection.to,
      null,
    );
    editing = block ? { from: block.from, to: block.to } : null;
    explicitlyEdited = true;
  }

  if (editing && !explicitlyEdited) {
    const selection = transaction.state.selection.main;
    if (selection.to < editing.from || selection.from > editing.to) editing = null;
  }
  return { editing };
};

export const createEditorVisualModeExtension = (
  copy: EditorVisualModeCopy,
  options: EditorVisualModeOptions = {},
) => {
  const interactionField = StateField.define<EditorVisualInteraction>({
    create() {
      return { editing: null };
    },
    update: updateVisualInteraction,
  });
  const decorationField = StateField.define<EditorVisualDecorationSets>({
    create(state) {
      return buildVisualDecorationSets(
        state,
        state.field(interactionField),
        copy,
        options,
      );
    },
    update(value, transaction) {
      const previousEditing =
        transaction.startState.field(interactionField, false)?.editing ?? null;
      const nextEditing = transaction.state.field(interactionField, false)?.editing ?? null;
      const editingChanged =
        previousEditing?.from !== nextEditing?.from ||
        previousEditing?.to !== nextEditing?.to;
      const selectionChanged =
        !transaction.startState.selection.eq(transaction.state.selection);
      if (!transaction.docChanged && !editingChanged && !selectionChanged) {
        return value;
      }
      return buildVisualDecorationSets(
        transaction.state,
        transaction.state.field(interactionField),
        copy,
        options,
      );
    },
    provide: (field) => [
      EditorView.decorations.from(field, (value) => value.decorations),
      EditorView.atomicRanges.of((view) =>
        view.state.field(field, false)?.atomicRanges ?? Decoration.none),
    ],
  });
  const navigationKeymap = Prec.highest(keymap.of([
    {
      key: "ArrowDown",
      run: (view) =>
        moveByVisualLine(
          view,
          true,
          view.state.field(decorationField).replacements,
          view.state.field(interactionField).editing,
        ),
    },
    {
      key: "ArrowUp",
      run: (view) =>
        moveByVisualLine(
          view,
          false,
          view.state.field(decorationField).replacements,
          view.state.field(interactionField).editing,
        ),
    },
    {
      key: "ArrowRight",
      run: (view) =>
        moveIntoVisualBlockHorizontally(
          view,
          true,
          view.state.field(decorationField).replacements,
        ),
    },
    {
      key: "ArrowLeft",
      run: (view) =>
        moveIntoVisualBlockHorizontally(
          view,
          false,
          view.state.field(decorationField).replacements,
        ),
    },
  ]));
  const pointerCursorGuard = EditorView.domEventHandlers({
    pointerdown: (event, view) => {
      concealAtomicPointerCursor(view, event);
      return false;
    },
  });
  return [
    EditorView.editorAttributes.of({ class: "cm-visual-editor" }),
    EditorView.cursorScrollMargin.of({
      x: 5,
      y: VISUAL_CURSOR_SAFE_MARGIN,
    }),
    syntaxHighlighting(visualSourceHighlightStyle),
    pointerCursorGuard,
    interactionField,
    navigationKeymap,
    decorationField,
  ];
};
