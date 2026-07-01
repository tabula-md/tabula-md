import { decodeBase64Url, encodeBase64Url } from "../data/base64Url";
import { decryptData, encryptData } from "../data/encryption";

export type EnvelopeKind = "yjs-update" | "presence" | "state-init" | "snapshot";

export type EncryptedEnvelope = {
  v: 1;
  roomId: string;
  kind: EnvelopeKind;
  version: number;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

export type RoomEnvelopeMetadata = Pick<EncryptedEnvelope, "v" | "roomId" | "kind" | "version" | "createdAt">;

const textEncoder = new TextEncoder();

export const createRoomAad = ({ v, roomId, kind, version, createdAt }: RoomEnvelopeMetadata) =>
  textEncoder.encode(JSON.stringify({ v, roomId, kind, version, createdAt }));

export const createRoomEnvelope = async ({
  roomKey,
  roomId,
  kind,
  version,
  plaintext,
  createdAt = new Date().toISOString(),
}: {
  roomKey: string | CryptoKey;
  roomId: string;
  kind: EnvelopeKind;
  version: number;
  plaintext: Uint8Array;
  createdAt?: string;
}): Promise<EncryptedEnvelope> => {
  const metadata = { v: 1, roomId, kind, version, createdAt } as const;
  const { encryptedBuffer, iv } = await encryptData(roomKey, plaintext, {
    additionalData: createRoomAad(metadata),
  });

  return {
    ...metadata,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(encryptedBuffer)),
  };
};

export const decryptRoomEnvelope = async ({
  roomKey,
  envelope,
}: {
  roomKey: string | CryptoKey;
  envelope: EncryptedEnvelope;
}) =>
  new Uint8Array(
    await decryptData(decodeBase64Url(envelope.iv), decodeBase64Url(envelope.ciphertext), roomKey, {
      additionalData: createRoomAad(envelope),
    }),
  );

export const validateRoomPayload = (envelope: unknown): envelope is EncryptedEnvelope => {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return false;
  }

  const value = envelope as Partial<EncryptedEnvelope>;
  return (
    value.v === 1 &&
    typeof value.roomId === "string" &&
    isEnvelopeKind(value.kind) &&
    Number.isSafeInteger(value.version) &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.createdAt === "string"
  );
};

export const isEnvelopeKind = (value: unknown): value is EnvelopeKind =>
  value === "yjs-update" || value === "presence" || value === "state-init" || value === "snapshot";
