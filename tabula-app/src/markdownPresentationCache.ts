import {
  createMarkdownPresentationDocument,
  type MarkdownPresentationDocument,
} from "@tabula-md/tabula";

let cachedSource: string | null = null;
let cachedPresentation: MarkdownPresentationDocument | null = null;

// Visual and Preview usually request the same current document in sequence.
// One entry removes that duplicate parse without retaining a workspace-sized cache.
export const getMarkdownPresentationDocument = (
  source: string,
): MarkdownPresentationDocument => {
  if (cachedPresentation && cachedSource === source) {
    return cachedPresentation;
  }

  cachedSource = source;
  cachedPresentation = createMarkdownPresentationDocument(source);
  return cachedPresentation;
};
