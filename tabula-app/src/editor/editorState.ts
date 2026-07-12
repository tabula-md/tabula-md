import {
  history,
  redo,
  undo,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, Transaction, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  placeholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { createCommentAnchorExtension } from "../editorExtensions/commentAnchors";
import { createLineAnnotationGutterExtension } from "../editorExtensions/lineAnnotations";
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorInterfaceCopy,
  MarkdownLineActionRequest,
} from "../markdownEditorTypes";
import {
  createMarkdownCommandExtensions,
  editorUndoBoundaryFacet,
} from "./editorInputRules";
import {
  createEditorLayoutCompartments,
  createEditorLineNumbersExtension,
  createEditorLineWrappingExtension,
  type EditorLayoutCompartments,
} from "./editorLayout";
import { createEditorPasteNormalizationExtension } from "./editorPaste";
import { createEditorSearchExtension } from "./editorSearch";
import type { SearchMatch } from "./editorSearchModel";
import type { CollabEditorBinding } from "../collaboration/liveCollaboration";

export type MarkdownEditorCompartments = EditorLayoutCompartments & {
  annotationGutter: Compartment;
  commentAnchor: Compartment;
  collaboration: Compartment;
  history: Compartment;
  searchHighlight: Compartment;
  placeholder: Compartment;
};

export type MarkdownEditorExtensionConfig = {
  compartments: MarkdownEditorCompartments;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks: MarkdownBookmark[];
  commentAnchors: MarkdownCommentAnchor[];
  commentsEnabled: boolean;
  activeCommentId?: string | null;
  collaborationBinding?: CollabEditorBinding | null;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  copy: MarkdownEditorInterfaceCopy;
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
  commentAnchor: new Compartment(),
  collaboration: new Compartment(),
  history: new Compartment(),
  searchHighlight: new Compartment(),
  placeholder: new Compartment(),
});

export const createEditorAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[],
  copy: MarkdownEditorInterfaceCopy,
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
) => createLineAnnotationGutterExtension(bookmarks, copy, onOpenLineActions);

export const createEditorCommentAnchorExtension = (
  commentAnchors: MarkdownCommentAnchor[],
  activeCommentId: string | null | undefined,
  copy: MarkdownEditorInterfaceCopy,
  onOpenComment?: (commentId: string) => void,
) => createCommentAnchorExtension(commentAnchors, activeCommentId, copy, onOpenComment);

export const createEditorSelectionDisplayExtensions = (): Extension[] => [
  EditorState.allowMultipleSelections.of(true),
  drawSelection(),
];

const utf8Encoder = new TextEncoder();

type CollaborationHistoryBinding = Pick<CollabEditorBinding, "undoManager">;

export const undoCollaborationHistory = (
  _view: Parameters<typeof undo>[0],
  collaborationBinding: CollaborationHistoryBinding,
) => collaborationBinding.undoManager.undo() !== null;

export const redoCollaborationHistory = (
  _view: Parameters<typeof redo>[0],
  collaborationBinding: CollaborationHistoryBinding,
) => collaborationBinding.undoManager.redo() !== null;

export const createEditorCollaborationExtensions = (
  collaborationBinding: NonNullable<MarkdownEditorExtensionConfig["collaborationBinding"]>,
): Extension[] => [
  EditorState.transactionExtender.of((transaction) =>
    transaction.docChanged
      ? { annotations: Transaction.addToHistory.of(false) }
      : null,
  ),
  EditorState.transactionFilter.of((transaction) => {
    if (!transaction.docChanged) return transaction;

    if (collaborationBinding.consumeRemoteProjection?.()) return transaction;

    const yTextLength = collaborationBinding.yText.length;
    const isRemoteYTextUpdate = yTextLength !== transaction.startState.doc.length &&
      yTextLength === transaction.newDoc.length;
    if (isRemoteYTextUpdate) return transaction;

    let byteDelta = 0;
    transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      byteDelta += utf8Encoder.encode(inserted.sliceString(0, inserted.length, "\n")).byteLength;
      byteDelta -= utf8Encoder.encode(transaction.startState.doc.sliceString(fromA, toA, "\n")).byteLength;
    });
    return collaborationBinding.canApplyTextByteDelta(byteDelta) ? transaction : [];
  }),
  editorUndoBoundaryFacet.of(() => collaborationBinding.undoManager.stopCapturing()),
  keymap.of([
    {
      key: "Mod-z",
      preventDefault: true,
      run: (view) => undoCollaborationHistory(view, collaborationBinding),
    },
    {
      key: "Mod-y",
      mac: "Mod-Shift-z",
      preventDefault: true,
      run: (view) => redoCollaborationHistory(view, collaborationBinding),
    },
    {
      key: "Mod-Shift-z",
      preventDefault: true,
      run: (view) => redoCollaborationHistory(view, collaborationBinding),
    },
  ]),
  collaborationBinding.extension,
];

export const getCollaborationEditorHistoryState = (
  _state: EditorState,
  collaborationBinding: NonNullable<MarkdownEditorExtensionConfig["collaborationBinding"]>,
) => ({
  canUndo: collaborationBinding.undoManager.undoStack.length > 0,
  canRedo: collaborationBinding.undoManager.redoStack.length > 0,
});

export const createMarkdownEditorExtensions = ({
  compartments,
  lineWrapping,
  lineNumbers,
  bookmarks,
  commentAnchors,
  commentsEnabled,
  activeCommentId,
  collaborationBinding,
  searchMatches,
  activeSearchMatchIndex,
  copy,
  updateExtension,
  onOpenLineActions,
  onOpenComment,
}: MarkdownEditorExtensionConfig): Extension[] => [
  compartments.history.of(collaborationBinding ? [] : history()),
  ...createEditorSelectionDisplayExtensions(),
  dropCursor(),
  bracketMatching(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  markdown({ addKeymap: false, pasteURLAsLink: true }),
  createEditorPasteNormalizationExtension(),
  syntaxHighlighting(markdownEditorHighlightStyle, { fallback: true }),
  compartments.placeholder.of(placeholder(copy.startWriting)),
  compartments.annotationGutter.of(createEditorAnnotationGutterExtension(bookmarks, copy, onOpenLineActions)),
  compartments.lineNumbers.of(createEditorLineNumbersExtension(lineNumbers)),
  compartments.wrapping.of(createEditorLineWrappingExtension(lineWrapping)),
  compartments.commentAnchor.of(
    commentsEnabled
      ? createEditorCommentAnchorExtension(commentAnchors, activeCommentId, copy, onOpenComment)
      : [],
  ),
  compartments.collaboration.of(
    collaborationBinding
      ? createEditorCollaborationExtensions(collaborationBinding)
      : [],
  ),
  compartments.searchHighlight.of(createEditorSearchExtension(searchMatches, activeSearchMatchIndex)),
  ...createMarkdownCommandExtensions(),
  updateExtension,
];
