import { history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  placeholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Collaborator } from "../collaboration";
import { createCommentAnchorExtension } from "../editorExtensions/commentAnchors";
import {
  createLineAnnotationGutterExtension,
  createLineCommentActionExtension,
} from "../editorExtensions/lineAnnotations";
import { createTextSelectionHighlightExtension } from "../editorExtensions/selectionLayer";
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownLineActionRequest,
} from "../markdownEditorTypes";
import { createMarkdownCommandExtensions } from "./editorInputRules";
import {
  createEditorLayoutCompartments,
  createEditorLineNumbersExtension,
  createEditorLineWrappingExtension,
  type EditorLayoutCompartments,
} from "./editorLayout";
import { createEditorPresenceExtension } from "./editorPresence";
import { createEditorPasteNormalizationExtension } from "./editorPaste";
import { createEditorSearchExtension } from "./editorSearch";
import type { SearchMatch } from "./editorSearchModel";

export type MarkdownEditorCompartments = EditorLayoutCompartments & {
  annotationGutter: Compartment;
  lineCommentAction: Compartment;
  commentAnchor: Compartment;
  remotePresence: Compartment;
  searchHighlight: Compartment;
};

export type MarkdownEditorExtensionConfig = {
  compartments: MarkdownEditorCompartments;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks: MarkdownBookmark[];
  commentAnchors: MarkdownCommentAnchor[];
  commentsEnabled: boolean;
  activeCommentId?: string | null;
  collaborators: Collaborator[];
  fileTitle?: string;
  roomId?: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  updateExtension: Extension;
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
};

const markdownEditorHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading1, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading2, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading3, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.strong, color: "var(--editor-syntax-heading)", fontWeight: "600" },
  { tag: tags.emphasis, color: "var(--editor-syntax-heading)", fontStyle: "italic" },
  { tag: tags.strikethrough, color: "var(--editor-syntax-muted)", textDecoration: "line-through" },
  { tag: tags.link, color: "var(--editor-syntax-soft)", textDecoration: "underline", textUnderlineOffset: "2px" },
  { tag: tags.url, color: "var(--editor-syntax-soft)" },
  { tag: tags.monospace, color: "var(--editor-syntax-soft)" },
  { tag: tags.quote, color: "var(--editor-syntax-muted)" },
  { tag: tags.list, color: "var(--editor-syntax-soft)" },
  { tag: tags.keyword, color: "var(--editor-syntax-muted)" },
  { tag: tags.atom, color: "var(--editor-syntax-muted)" },
  { tag: tags.bool, color: "var(--editor-syntax-muted)" },
  { tag: tags.number, color: "var(--editor-syntax-muted)" },
  { tag: tags.string, color: "var(--editor-syntax-soft)" },
  { tag: tags.meta, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.comment, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.processingInstruction, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.punctuation, color: "var(--editor-syntax-punctuation)", textDecoration: "none" },
]);

export const createMarkdownEditorCompartments = (): MarkdownEditorCompartments => ({
  ...createEditorLayoutCompartments(),
  annotationGutter: new Compartment(),
  lineCommentAction: new Compartment(),
  commentAnchor: new Compartment(),
  remotePresence: new Compartment(),
  searchHighlight: new Compartment(),
});

export const createEditorAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
) => createLineAnnotationGutterExtension(bookmarks, onOpenLineActions);

export const createEditorLineCommentActionExtension = (
  bookmarks: MarkdownBookmark[],
  commentAnchors: MarkdownCommentAnchor[],
  commentsEnabled: boolean,
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
) =>
  createLineCommentActionExtension(
    bookmarks,
    commentsEnabled ? commentAnchors : [],
    commentsEnabled ? onOpenLineActions : undefined,
    commentsEnabled,
  );

export const createEditorCommentAnchorExtension = (
  commentAnchors: MarkdownCommentAnchor[],
  activeCommentId?: string | null,
  onOpenComment?: (commentId: string) => void,
) => createCommentAnchorExtension(commentAnchors, activeCommentId, onOpenComment);

export const createEditorSelectionDisplayExtensions = (): Extension[] => [
  EditorState.allowMultipleSelections.of(true),
  // Tabula draws range backgrounds in its custom layer; CodeMirror still owns multiple cursor DOM.
  drawSelection(),
];

export const createMarkdownEditorExtensions = ({
  compartments,
  lineWrapping,
  lineNumbers,
  bookmarks,
  commentAnchors,
  commentsEnabled,
  activeCommentId,
  collaborators,
  fileTitle,
  roomId,
  searchMatches,
  activeSearchMatchIndex,
  updateExtension,
  onOpenLineActions,
  onOpenComment,
}: MarkdownEditorExtensionConfig): Extension[] => [
  history(),
  ...createEditorSelectionDisplayExtensions(),
  dropCursor(),
  bracketMatching(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  markdown({ addKeymap: false, pasteURLAsLink: true }),
  createEditorPasteNormalizationExtension(),
  syntaxHighlighting(markdownEditorHighlightStyle, { fallback: true }),
  placeholder("Start writing..."),
  compartments.annotationGutter.of(createEditorAnnotationGutterExtension(bookmarks, onOpenLineActions)),
  compartments.lineCommentAction.of(
    createEditorLineCommentActionExtension(bookmarks, commentAnchors, commentsEnabled, onOpenLineActions),
  ),
  compartments.lineNumbers.of(createEditorLineNumbersExtension(lineNumbers)),
  compartments.wrapping.of(createEditorLineWrappingExtension(lineWrapping)),
  compartments.commentAnchor.of(
    commentsEnabled
      ? createEditorCommentAnchorExtension(commentAnchors, activeCommentId, onOpenComment)
      : [],
  ),
  compartments.remotePresence.of(createEditorPresenceExtension(collaborators, fileTitle, roomId)),
  createTextSelectionHighlightExtension(),
  compartments.searchHighlight.of(createEditorSearchExtension(searchMatches, activeSearchMatchIndex)),
  ...createMarkdownCommandExtensions(),
  updateExtension,
];
