import { type Extension } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import type { MarkdownBookmark, MarkdownCommentAnchor, MarkdownLineActionRequest } from "../markdownEditorTypes";

type LineAnnotationState = {
  hasBookmark: boolean;
};

type LineCommentActionState = {
  lineNumber: number;
  start: number;
  end: number;
  hasComment: boolean;
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

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

export const getBookmarkLineNumbers = (view: EditorView, bookmarks: MarkdownBookmark[]) => {
  const docLength = view.state.doc.length;
  return new Set(
    bookmarks.map((bookmark) => view.state.doc.lineAt(clampPosition(bookmark.position, docLength)).number),
  );
};

const getCommentLineNumbers = (view: EditorView, commentAnchors: MarkdownCommentAnchor[]) => {
  const docLength = view.state.doc.length;
  const lineNumbers = new Set<number>();

  commentAnchors.forEach((anchor) => {
    const start = clampPosition(anchor.start, docLength);
    const end = clampPosition(anchor.end, docLength);
    if (end <= start) {
      return;
    }

    const startLine = view.state.doc.lineAt(start).number;
    const endLine = view.state.doc.lineAt(Math.max(start, end - 1)).number;
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumbers.add(lineNumber);
    }
  });

  return lineNumbers;
};

const getLineAnnotationKind = (lineNumber: number, bookmarkLineNumbers: Set<number>): keyof typeof lineAnnotationMarkers =>
  bookmarkLineNumbers.has(lineNumber) ? "bookmark" : "empty";

export const createLineAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension =>
  gutter({
    class: "cm-annotationGutter",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
      return lineAnnotationMarkers[getLineAnnotationKind(lineNumber, bookmarkLineNumbers)];
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged || update.selectionSet;
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
        const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
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
      other.actionState.hasComment === this.actionState.hasComment
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = [
      "cm-line-comment-marker",
      this.actionState.hasComment ? "has-comment" : "",
    ]
      .filter(Boolean)
      .join(" ");

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
});

export const createLineCommentActionExtension = (
  bookmarks: MarkdownBookmark[] = [],
  commentAnchors: MarkdownCommentAnchor[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension =>
  gutter({
    class: "cm-commentGutter",
    renderEmptyElements: true,
    side: "after",
    lineMarker(view, line) {
      const docLine = view.state.doc.lineAt(line.from);
      const commentLineNumbers = getCommentLineNumbers(view, commentAnchors);
      return new LineCommentGutterMarker({
        lineNumber: docLine.number,
        start: docLine.from,
        end: docLine.to,
        hasComment: commentLineNumbers.has(docLine.number),
      });
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged || update.selectionSet;
    },
    initialSpacer: () => emptyLineCommentMarker,
    domEventHandlers: {
      click(view, line, event) {
        if (!onOpenLineActions) {
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
        const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
        const commentLineNumbers = getCommentLineNumbers(view, commentAnchors);
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
