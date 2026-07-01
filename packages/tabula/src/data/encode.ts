import { decryptData, encryptData } from "./encryption";

export type EncryptedDataEncodingInfo = {
  version: 1;
  encryption: "AES-GCM";
  compression: "none";
};

export type EncodeEncryptedDataOptions<TMetadata extends Record<string, unknown> | null = null> = {
  encryptionKey: string | CryptoKey;
  metadata?: TMetadata;
  additionalData?: Uint8Array;
};

export type DecodeEncryptedDataOptions = {
  decryptionKey: string | CryptoKey;
  additionalData?: Uint8Array;
};

const magic = new Uint8Array([0x54, 0x42, 0x45, 0x31]);
const uint32Bytes = 4;
const ivBytes = 12;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const encodeEncryptedData = async <TMetadata extends Record<string, unknown> | null = null>(
  data: Uint8Array,
  options: EncodeEncryptedDataOptions<TMetadata>,
) => {
  const encodingInfo: EncryptedDataEncodingInfo = {
    version: 1,
    encryption: "AES-GCM",
    compression: "none",
  };
  const encodingInfoBytes = textEncoder.encode(JSON.stringify(encodingInfo));
  const metadataBytes = textEncoder.encode(JSON.stringify(options.metadata ?? null));
  const encryptedContents = concatBuffers(writeUint32(metadataBytes.byteLength), metadataBytes, data);
  const { encryptedBuffer, iv } = await encryptData(options.encryptionKey, encryptedContents, {
    additionalData: options.additionalData,
  });

  return concatBuffers(
    magic,
    writeUint32(encodingInfoBytes.byteLength),
    encodingInfoBytes,
    iv,
    new Uint8Array(encryptedBuffer),
  );
};

export const decodeEncryptedData = async <TMetadata extends Record<string, unknown> | null = null>(
  encoded: Uint8Array,
  options: DecodeEncryptedDataOptions,
): Promise<{ metadata: TMetadata; data: Uint8Array }> => {
  const view = new Uint8Array(encoded);
  if (view.byteLength < magic.byteLength + uint32Bytes + ivBytes) {
    throw new Error("Encrypted data is too short");
  }

  assertMagic(view);
  const encodingInfoLength = readUint32(view, magic.byteLength);
  const encodingInfoStart = magic.byteLength + uint32Bytes;
  const encodingInfoEnd = encodingInfoStart + encodingInfoLength;
  const ivStart = encodingInfoEnd;
  const ivEnd = ivStart + ivBytes;

  if (view.byteLength <= ivEnd) {
    throw new Error("Encrypted data is incomplete");
  }

  const encodingInfo = JSON.parse(textDecoder.decode(view.slice(encodingInfoStart, encodingInfoEnd))) as Partial<EncryptedDataEncodingInfo>;
  if (encodingInfo.version !== 1 || encodingInfo.encryption !== "AES-GCM") {
    throw new Error("Unsupported encrypted data format");
  }

  const decrypted = new Uint8Array(
    await decryptData(view.slice(ivStart, ivEnd), view.slice(ivEnd), options.decryptionKey, {
      additionalData: options.additionalData,
    }),
  );
  const metadataLength = readUint32(decrypted, 0);
  const metadataStart = uint32Bytes;
  const metadataEnd = metadataStart + metadataLength;
  if (decrypted.byteLength < metadataEnd) {
    throw new Error("Encrypted data metadata is incomplete");
  }

  return {
    metadata: JSON.parse(textDecoder.decode(decrypted.slice(metadataStart, metadataEnd))) as TMetadata,
    data: decrypted.slice(metadataEnd),
  };
};

const concatBuffers = (...buffers: Uint8Array[]) => {
  const output = new Uint8Array(buffers.reduce((total, buffer) => total + buffer.byteLength, 0));
  let offset = 0;
  for (const buffer of buffers) {
    output.set(buffer, offset);
    offset += buffer.byteLength;
  }
  return output;
};

const writeUint32 = (value: number) => {
  const bytes = new Uint8Array(uint32Bytes);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

const readUint32 = (bytes: Uint8Array, offset: number) => {
  if (bytes.byteLength < offset + uint32Bytes) {
    throw new Error("Encrypted data is incomplete");
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, uint32Bytes).getUint32(0, false);
};

const assertMagic = (bytes: Uint8Array) => {
  for (let index = 0; index < magic.byteLength; index += 1) {
    if (bytes[index] !== magic[index]) {
      throw new Error("Unsupported encrypted data format");
    }
  }
};
