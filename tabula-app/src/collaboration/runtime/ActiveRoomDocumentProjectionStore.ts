export const createActiveRoomDocumentProjectionStore = () => {
  let projection: { documentId: string; text: string } | null = null;
  let transitionTextByDocumentId = new Map<string, string>();

  return {
    getText(documentId: string) {
      if (projection?.documentId === documentId) return projection.text;
      return transitionTextByDocumentId.get(documentId) ?? null;
    },
    prime(documents: readonly { id: string; text: string }[]) {
      projection = null;
      transitionTextByDocumentId = new Map(
        documents.map((document) => [document.id, document.text]),
      );
    },
    set(documentId: string, text: string) {
      transitionTextByDocumentId.delete(documentId);
      if (projection?.documentId === documentId && projection.text === text) return false;
      projection = { documentId, text };
      return true;
    },
    clear(documentId?: string) {
      if (documentId) {
        const clearedTransition = transitionTextByDocumentId.delete(documentId);
        if (projection?.documentId !== documentId) return clearedTransition;
        projection = null;
        return true;
      }

      const changed = projection !== null || transitionTextByDocumentId.size > 0;
      projection = null;
      transitionTextByDocumentId.clear();
      return changed;
    },
  };
};

export type ActiveRoomDocumentProjectionStore = ReturnType<
  typeof createActiveRoomDocumentProjectionStore
>;
