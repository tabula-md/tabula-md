import type { EncryptedEnvelope } from "./roomProtocol";
import type { RoomMeta } from "./liveCollaboration";
import { createRoomApiUrl, isEncryptedEnvelope, toRoomMeta, type RoomServerMetadata } from "./collabConnectionModel";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RoomRequestOptions = {
  baseUrl: string;
  roomId: string;
  fetcher?: FetchLike;
};

export type RoomSnapshotEnvelopeResult =
  | {
      status: "loaded";
      envelope: EncryptedEnvelope;
    }
  | {
      status: "missing";
    }
  | {
      status: "invalid";
      message: string;
    };

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export const fetchRoomMeta = async ({
  baseUrl,
  roomId,
  fetcher = defaultFetch,
}: RoomRequestOptions): Promise<RoomMeta | null> => {
  try {
    const response = await fetcher(createRoomApiUrl(baseUrl, roomId));
    if (!response.ok) {
      return null;
    }

    return toRoomMeta((await response.json()) as RoomServerMetadata);
  } catch {
    return null;
  }
};

export const fetchRoomSnapshotEnvelope = async ({
  baseUrl,
  roomId,
  fetcher = defaultFetch,
}: RoomRequestOptions): Promise<RoomSnapshotEnvelopeResult> => {
  try {
    const response = await fetcher(createRoomApiUrl(baseUrl, roomId, "/snapshot"));
    if (response.status === 404) {
      return { status: "missing" };
    }
    if (!response.ok) {
      return {
        status: "invalid",
        message: "The encrypted room snapshot could not be loaded.",
      };
    }

    const envelope = await response.json();
    if (!isEncryptedEnvelope(envelope) || envelope.roomId !== roomId || envelope.kind !== "snapshot") {
      return {
        status: "invalid",
        message: "A room snapshot was ignored because it was not a valid envelope.",
      };
    }

    return {
      status: "loaded",
      envelope,
    };
  } catch {
    return {
      status: "invalid",
      message: "The encrypted room snapshot could not be loaded.",
    };
  }
};

export const putRoomSnapshotEnvelope = async ({
  baseUrl,
  roomId,
  envelope,
  fetcher = defaultFetch,
}: RoomRequestOptions & {
  envelope: EncryptedEnvelope;
}): Promise<RoomMeta | null> => {
  try {
    const response = await fetcher(createRoomApiUrl(baseUrl, roomId, "/snapshot"), {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      return null;
    }

    return toRoomMeta((await response.json()) as RoomServerMetadata);
  } catch {
    return null;
  }
};
