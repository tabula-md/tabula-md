export type EnvelopeKind = "yjs-update" | "presence" | "snapshot";

export type EncryptedEnvelope = {
  v: 1;
  roomId: string;
  kind: EnvelopeKind;
  version: number;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

export type RoomJoinedMessage = {
  roomId: string;
  clientId: string;
  peerCount: number;
};

export type RoomPeersMessage = {
  roomId: string;
  peers: string[];
};
