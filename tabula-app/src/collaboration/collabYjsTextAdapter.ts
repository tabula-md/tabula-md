import * as Y from "yjs";

import {
  applyLocalTextToYText,
  applyRemoteUpdateToYText,
  applyTextPatchesToYText,
  COLLAB_REMOTE_ORIGIN,
  createCollabTextDocument,
  type CollabTextDocument,
} from "./collabTextModel";
import type {
  CollabTextAdapter,
  CollabTextDocumentHandle,
  CollabTextUpdateListener,
} from "./collabRuntimeAdapters";

const asYjsDocument = (document: CollabTextDocumentHandle): CollabTextDocument => document as CollabTextDocument;

export const createYjsCollabTextAdapter = (): CollabTextAdapter => ({
  createDocument(initialText) {
    return createCollabTextDocument(initialText);
  },
  observeUpdates(document, listener: CollabTextUpdateListener) {
    const { doc } = asYjsDocument(document);
    doc.on("update", listener);
    return () => {
      doc.off("update", listener);
    };
  },
  isRemoteOrigin(origin) {
    return origin === COLLAB_REMOTE_ORIGIN;
  },
  encodeState(document) {
    return Y.encodeStateAsUpdate(asYjsDocument(document).doc);
  },
  mergeUpdates(updates) {
    return updates.length === 1 ? updates[0] : Y.mergeUpdates([...updates]);
  },
  applyLocalText(document, nextText, patches) {
    applyLocalTextToYText({ ...asYjsDocument(document), nextText, patches });
  },
  applyLocalTextPatches(document, patches) {
    applyTextPatchesToYText({ ...asYjsDocument(document), patches });
  },
  applyRemoteUpdate(document, update) {
    return applyRemoteUpdateToYText({ ...asYjsDocument(document), update });
  },
  destroy(document) {
    asYjsDocument(document).doc.destroy();
  },
});
