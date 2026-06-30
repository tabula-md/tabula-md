import {
  importRoomKey,
  resolveTabulaRoomBaseUrl,
  ROOM_UNCONFIGURED_MESSAGE,
} from "./collabRoom";

type CollabStartConfigOptions = {
  encodedRoomKey: string;
  resolveBaseUrl?: () => string | null;
  importKey?: (encodedKey: string) => Promise<CryptoKey>;
};

export type CollabStartConfigResult =
  | {
      status: "ready";
      baseUrl: string;
      roomKey: CryptoKey;
    }
  | {
      status: "blocked";
      message: string;
    };

export const resolveCollabStartConfig = async ({
  encodedRoomKey,
  resolveBaseUrl = resolveTabulaRoomBaseUrl,
  importKey = importRoomKey,
}: CollabStartConfigOptions): Promise<CollabStartConfigResult> => {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    return {
      status: "blocked",
      message: ROOM_UNCONFIGURED_MESSAGE,
    };
  }

  if (!encodedRoomKey) {
    return {
      status: "blocked",
      message: "This room URL is missing its client-only room key.",
    };
  }

  try {
    return {
      status: "ready",
      baseUrl,
      roomKey: await importKey(encodedRoomKey),
    };
  } catch {
    return {
      status: "blocked",
      message: "This room URL has an invalid room key.",
    };
  }
};
