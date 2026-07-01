import { decodeBase64Url, encodeBase64Url } from "./base64Url";

export const AES_GCM_IV_BYTES = 12;
export const DEFAULT_ENCRYPTION_KEY_BYTES = 32;

export type EncryptedData = {
  encryptedBuffer: ArrayBuffer;
  iv: Uint8Array;
};

export type EncryptDataOptions = {
  additionalData?: Uint8Array;
};

export type DecryptDataOptions = {
  additionalData?: Uint8Array;
};

export const getCrypto = (): Crypto => {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || !crypto.getRandomValues) {
    throw new Error("Web Crypto is not available");
  }
  return crypto;
};

export const createIV = () => {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  getCrypto().getRandomValues(iv);
  return iv;
};

export const generateEncryptionKey = (byteLength = DEFAULT_ENCRYPTION_KEY_BYTES) => {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

export const importEncryptionKey = async (
  encodedKey: string,
  usages: KeyUsage[] = ["encrypt", "decrypt"],
  expectedByteLength = DEFAULT_ENCRYPTION_KEY_BYTES,
) => {
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== expectedByteLength) {
    throw new Error(`Encryption key must be ${expectedByteLength} bytes`);
  }

  return getCrypto().subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, usages);
};

export const encryptData = async (
  key: string | CryptoKey,
  data: Uint8Array,
  options: EncryptDataOptions = {},
): Promise<EncryptedData> => {
  const cryptoKey = typeof key === "string" ? await importEncryptionKey(key, ["encrypt"]) : key;
  const iv = createIV();
  const encryptedBuffer = await getCrypto().subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      ...(options.additionalData ? { additionalData: toArrayBuffer(options.additionalData) } : {}),
    },
    cryptoKey,
    toArrayBuffer(data),
  );

  return {
    encryptedBuffer,
    iv,
  };
};

export const decryptData = async (
  iv: Uint8Array,
  encrypted: Uint8Array | ArrayBuffer,
  key: string | CryptoKey,
  options: DecryptDataOptions = {},
) => {
  const cryptoKey = typeof key === "string" ? await importEncryptionKey(key, ["decrypt"]) : key;
  return getCrypto().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      ...(options.additionalData ? { additionalData: toArrayBuffer(options.additionalData) } : {}),
    },
    cryptoKey,
    encrypted instanceof Uint8Array ? toArrayBuffer(encrypted) : encrypted,
  );
};

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
