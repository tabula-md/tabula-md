import { EditorView } from "@codemirror/view";
import {
  getMarkdownLinkAtOffset,
  type MarkdownLink,
} from "@tabula-md/tabula";

export type EditorLinkPopoverRequest = {
  link: MarkdownLink;
  clientX: number;
  clientY: number;
};

type EditorInteractionOptions = {
  onOpenLinkPopover?: (request: EditorLinkPopoverRequest) => void;
};

const getPointerDocumentOffset = (view: EditorView, event: MouseEvent) =>
  view.posAtCoords({ x: event.clientX, y: event.clientY });

export const createEditorInteractionExtension = ({ onOpenLinkPopover }: EditorInteractionOptions) =>
  EditorView.domEventHandlers({
    click(event, view) {
      if (event.button !== 0) {
        return false;
      }

      const offset = getPointerDocumentOffset(view, event);
      if (offset === null) {
        return false;
      }

      const text = view.state.doc.toString();
      const link = getMarkdownLinkAtOffset(text, offset);
      if (!link) {
        return false;
      }

      event.preventDefault();
      onOpenLinkPopover?.({
        link,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return true;
    },
  });
