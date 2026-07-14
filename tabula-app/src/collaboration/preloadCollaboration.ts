import { tabulaServiceConfig } from "../serviceConfig";

let startPreparation: Promise<void> | null = null;

export const preloadCollaborationStart = () => {
  startPreparation ??= Promise.all([
    import("./roomCheckpointCrdt"),
    import("./liveCollaboration"),
    import("./roomTransport").then(({ preloadRoomTransport }) => preloadRoomTransport()),
    tabulaServiceConfig.firebaseConfig ? import("../data/firebase") : Promise.resolve(),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      startPreparation = null;
      throw error;
    });
  return startPreparation;
};
