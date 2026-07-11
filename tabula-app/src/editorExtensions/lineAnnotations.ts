import { type Extension, type Text } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import {
  getLineNumberForSourcePosition,
  type LineSurfaceSourceLine,
} from "@tabula-md/tabula";
import type {
  MarkdownBookmark,
  MarkdownEditorInterfaceCopy,
  MarkdownLineActionRequest,
} from "../markdownEditorTypes";

type LineAnnotationState = {
  hasBookmark: boolean;
};

type EditorLineActionCopy = Pick<
  MarkdownEditorInterfaceCopy,
  "bookmarkLine" | "removeLineBookmark"
>;

type EditorLineActionIcon = "bookmark";

type EditorLineActionElementOptions = {
  action: "bookmark";
  active: boolean;
  activeLabel: string;
  activeTooltip: string;
  className: string;
  icon: EditorLineActionIcon;
  inactiveTooltip: string;
};

const LUCIDE_ICON_PATHS: Record<EditorLineActionIcon, string[]> = {
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
};

const createLucideSvgIcon = (icon: EditorLineActionIcon) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "cm-annotation-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  LUCIDE_ICON_PATHS[icon].forEach((pathData) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  });

  return svg;
};

const createEditorLineActionElement = ({
  action,
  active,
  activeLabel,
  activeTooltip,
  className,
  icon,
  inactiveTooltip,
}: EditorLineActionElementOptions) => {
  const actionElement = active ? document.createElement("button") : document.createElement("span");
  actionElement.className = className;
  actionElement.dataset.lineAction = action;
  actionElement.dataset.tooltip = active ? activeTooltip : inactiveTooltip;

  if (active) {
    (actionElement as HTMLButtonElement).type = "button";
    actionElement.ariaLabel = activeLabel;
  } else {
    actionElement.setAttribute("aria-hidden", "true");
  }

  actionElement.append(createLucideSvgIcon(icon));

  return actionElement;
};

class LineAnnotationGutterMarker extends GutterMarker {
  constructor(
    private readonly annotationState: LineAnnotationState,
    private readonly copy: EditorLineActionCopy,
  ) {
    super();
  }

  eq(other: GutterMarker) {
    return (
      other instanceof LineAnnotationGutterMarker &&
      other.annotationState.hasBookmark === this.annotationState.hasBookmark &&
      other.copy === this.copy
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = [
      "cm-annotation-marker",
      this.annotationState.hasBookmark ? "has-bookmark" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const bookmarkAction = createEditorLineActionElement({
      action: "bookmark",
      active: this.annotationState.hasBookmark,
      activeLabel: this.copy.removeLineBookmark,
      activeTooltip: this.copy.removeLineBookmark,
      className: "cm-annotation-action bookmark",
      icon: "bookmark",
      inactiveTooltip: this.copy.bookmarkLine,
    });
    marker.append(bookmarkAction);
    return marker;
  }
}

const createLineResolver = (view: EditorView) => (position: number): LineSurfaceSourceLine => {
  const line = view.state.doc.lineAt(position);
  return {
    number: line.number,
    start: line.from,
    end: line.to,
  };
};

export const getBookmarkLineNumbers = (view: EditorView, bookmarks: MarkdownBookmark[]) => {
  const docLength = view.state.doc.length;
  const resolveLineAt = createLineResolver(view);
  return new Set(
    bookmarks.map((bookmark) =>
      getLineNumberForSourcePosition({
        docLength,
        position: bookmark.position,
        resolveLineAt,
      }),
    ),
  );
};

type LineAnnotationKind = "empty" | "bookmark";

const getLineAnnotationKind = (lineNumber: number, bookmarkLineNumbers: Set<number>): LineAnnotationKind =>
  bookmarkLineNumbers.has(lineNumber) ? "bookmark" : "empty";

const createBookmarkLineNumberGetter = (bookmarks: MarkdownBookmark[]) => {
  let cachedDoc: Text | null = null;
  let cachedLineNumbers = new Set<number>();

  return (view: EditorView) => {
    if (cachedDoc === view.state.doc) {
      return cachedLineNumbers;
    }

    cachedDoc = view.state.doc;
    cachedLineNumbers = getBookmarkLineNumbers(view, bookmarks);
    return cachedLineNumbers;
  };
};

export const createLineAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[],
  copy: EditorLineActionCopy,
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension => {
  const getCachedBookmarkLineNumbers = createBookmarkLineNumberGetter(bookmarks);
  const markers = {
    empty: new LineAnnotationGutterMarker({ hasBookmark: false }, copy),
    bookmark: new LineAnnotationGutterMarker({ hasBookmark: true }, copy),
  };

  return gutter({
    class: "cm-annotationGutter",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      return markers[getLineAnnotationKind(lineNumber, getCachedBookmarkLineNumbers(view))];
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged;
    },
    initialSpacer: () => markers.empty,
    domEventHandlers: {
      click(view, line, event) {
        if (!onOpenLineActions) {
          return false;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }

        const actionElement = target.closest<HTMLElement>("[data-line-action]");
        const action = actionElement?.dataset.lineAction;
        if (action !== "bookmark") {
          return false;
        }

        const docLine = view.state.doc.lineAt(line.from);
        const bookmarkLineNumbers = getCachedBookmarkLineNumbers(view);
        event.preventDefault();
        onOpenLineActions({
          action,
          lineNumber: docLine.number,
          start: docLine.from,
          end: docLine.to,
          hasBookmark: bookmarkLineNumbers.has(docLine.number),
        });
        return true;
      },
    },
  });
};
