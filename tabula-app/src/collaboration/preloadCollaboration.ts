let startPreparation: Promise<void> | null = null;

export const preloadCollaborationStart = () => {
  startPreparation ??= Promise.all([
    import("./roomCheckpointCrdt"),
    import("./liveCollaboration"),
    import("./roomTransport").then(({ preloadRoomTransport }) => preloadRoomTransport()),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      startPreparation = null;
      throw error;
    });
  return startPreparation;
};
