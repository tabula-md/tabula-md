export const createActiveRoomDocumentProjectionStore = () => {
  let projection: { documentId: string; text: string } | null = null;

  return {
    getText(documentId: string) {
      return projection?.documentId === documentId ? projection.text : null;
    },
    set(documentId: string, text: string) {
      if (projection?.documentId === documentId && projection.text === text) return false;
      projection = { documentId, text };
      return true;
    },
    clear(documentId?: string) {
      if (!projection || (documentId && projection.documentId !== documentId)) return false;
      projection = null;
      return true;
    },
  };
};

export type ActiveRoomDocumentProjectionStore = ReturnType<
  typeof createActiveRoomDocumentProjectionStore
>;
