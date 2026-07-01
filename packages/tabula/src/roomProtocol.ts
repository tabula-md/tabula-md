export type { EncryptedEnvelope, EnvelopeKind } from "./room/envelope";

export type RoomJoinedMessage = {
  roomId: string;
  clientId: string;
  peerCount: number;
};

export type RoomPeersMessage = {
  roomId: string;
  peers: string[];
};
