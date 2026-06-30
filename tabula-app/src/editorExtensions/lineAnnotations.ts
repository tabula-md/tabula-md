import { type Extension, type Text } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import {
  getLineNumberForSourcePosition,
  getLineNumbersForSourceRanges,
  type LineSurfaceSourceLine,
} from "@tabula-md/tabula";
import type { MarkdownBookmark, MarkdownCommentAnchor, MarkdownLineActionRequest } from "../markdownEditorTypes";

type LineAnnotationState = {
  hasBookmark: boolean;
};

type LineCommentActionState = {
  lineNumber: number;
  start: number;
  end: number;
  hasComment: boolean;
  enabled: boolean;
};

type EditorLineActionIcon = "bookmark" | "message-square";

const LUCIDE_ICON_PATHS: Record<EditorLineActionIcon, string[]> = {
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  "message-square": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
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

class LineAnnotationGutterMarker extends GutterMarker {
  constructor(private readonly annotationState: LineAnnotationState) {
    super();
  }

  eq(other: GutterMarker) {
    return (
      other instanceof LineAnnotationGutterMarker &&
      other.annotationState.hasBookmark === this.annotationState.hasBookmark
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

    const bookmarkAction = document.createElement("span");
    bookmarkAction.className = "cm-annotation-action bookmark";
    bookmarkAction.dataset.lineAction = "bookmark";
    bookmarkAction.role = "button";
    bookmarkAction.ariaLabel = this.annotationState.hasBookmark ? "Remove line bookmark" : "Bookmark line";
    bookmarkAction.title = this.annotationState.hasBookmark ? "Remove bookmark" : "Bookmark line";
    bookmarkAction.append(createLucideSvgIcon("bookmark"));

    marker.append(bookmarkAction);
    return marker;
  }
}

const lineAnnotationMarkers = {
  empty: new LineAnnotationGutterMarker({ hasBookmark: false }),
  bookmark: new LineAnnotationGutterMarker({ hasBookmark: true }),
};

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

const getCommentLineNumbers = (view: EditorView, commentAnchors: MarkdownCommentAnchor[]) => {
  const docLength = view.state.doc.length;
  return getLineNumbersForSourceRanges({
    docLength,
    ranges: commentAnchors.map((anchor) => ({ start: anchor.start, end: anchor.end })),
    resolveLineAt: createLineResolver(view),
  });
};

const getLineAnnotationKind = (lineNumber: number, bookmarkLineNumbers: Set<number>): keyof typeof lineAnnotationMarkers =>
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

const createCommentLineNumberGetter = (commentAnchors: MarkdownCommentAnchor[]) => {
  let cachedDoc: Text | null = null;
  let cachedLineNumbers = new Set<number>();

  return (view: EditorView) => {
    if (cachedDoc === view.state.doc) {
      return cachedLineNumbers;
    }

    cachedDoc = view.state.doc;
    cachedLineNumbers = getCommentLineNumbers(view, commentAnchors);
    return cachedLineNumbers;
  };
};

export const createLineAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension => {
  const getCachedBookmarkLineNumbers = createBookmarkLineNumberGetter(bookmarks);

  return gutter({
    class: "cm-annotationGutter",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      return lineAnnotationMarkers[getLineAnnotationKind(lineNumber, getCachedBookmarkLineNumbers(view))];
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged;
    },
    initialSpacer: () => lineAnnotationMarkers.empty,
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
          hasComment: false,
        });
        return true;
      },
    },
  });
};

class LineCommentGutterMarker extends GutterMarker {
  constructor(private readonly actionState: LineCommentActionState) {
    super();
  }

  eq(other: GutterMarker) {
    return (
      other instanceof LineCommentGutterMarker &&
      other.actionState.lineNumber === this.actionState.lineNumber &&
      other.actionState.start === this.actionState.start &&
      other.actionState.end === this.actionState.end &&
      other.actionState.hasComment === this.actionState.hasComment &&
      other.actionState.enabled === this.actionState.enabled
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = [
      "cm-line-comment-marker",
      !this.actionState.enabled ? "disabled" : "",
      this.actionState.hasComment ? "has-comment" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (!this.actionState.enabled) {
      return marker;
    }

    const action = document.createElement("span");
    action.className = "cm-annotation-action cm-line-comment-action comment";
    action.dataset.lineAction = "comment";
    action.dataset.lineNumber = String(this.actionState.lineNumber);
    action.dataset.lineStart = String(this.actionState.start);
    action.dataset.lineEnd = String(this.actionState.end);
    action.role = "button";
    action.ariaLabel = this.actionState.hasComment ? "Open line comments" : "Comment on line";
    action.title = this.actionState.hasComment ? "Open comments" : "Comment on line";
    action.append(createLucideSvgIcon("message-square"));

    marker.append(action);
    return marker;
  }
}

const emptyLineCommentMarker = new LineCommentGutterMarker({
  lineNumber: 0,
  start: 0,
  end: 0,
  hasComment: false,
  enabled: false,
});

export const createLineCommentActionExtension = (
  bookmarks: MarkdownBookmark[] = [],
  commentAnchors: MarkdownCommentAnchor[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
  enabled = true,
): Extension => {
  const getCachedBookmarkLineNumbers = createBookmarkLineNumberGetter(bookmarks);
  const getCachedCommentLineNumbers = createCommentLineNumberGetter(commentAnchors);

  return gutter({
    class: "cm-commentGutter",
    renderEmptyElements: true,
    side: "after",
    lineMarker(view, line) {
      const docLine = view.state.doc.lineAt(line.from);
      return new LineCommentGutterMarker({
        lineNumber: docLine.number,
        start: docLine.from,
        end: docLine.to,
        hasComment: enabled && getCachedCommentLineNumbers(view).has(docLine.number),
        enabled,
      });
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged;
    },
    initialSpacer: () => emptyLineCommentMarker,
    domEventHandlers: {
      click(view, line, event) {
        if (!enabled || !onOpenLineActions) {
          return false;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }

        const actionElement = target.closest<HTMLElement>(".cm-line-comment-action[data-line-action='comment']");
        if (!actionElement) {
          return false;
        }

        const docLine = view.state.doc.lineAt(line.from);
        const bookmarkLineNumbers = getCachedBookmarkLineNumbers(view);
        const commentLineNumbers = getCachedCommentLineNumbers(view);
        event.preventDefault();
        onOpenLineActions({
          action: "comment",
          lineNumber: docLine.number,
          start: docLine.from,
          end: docLine.to,
          hasBookmark: bookmarkLineNumbers.has(docLine.number),
          hasComment: commentLineNumbers.has(docLine.number),
        });
        return true;
      },
    },
  });
};
