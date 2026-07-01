import { describe, expect, it } from "vitest";
import {
  decodeEncryptedData,
  encodeEncryptedData,
} from "./encode";
import { generateEncryptionKey } from "./encryption";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("encrypted data encoding", () => {
  it("round trips versioned encrypted payloads with metadata", async () => {
    const key = generateEncryptionKey();
    const encoded = await encodeEncryptedData(textEncoder.encode("markdown"), {
      encryptionKey: key,
      metadata: { kind: "json-share" },
    });

    const decoded = await decodeEncryptedData<{ kind: string }>(encoded, {
      decryptionKey: key,
    });

    expect(decoded.metadata).toEqual({ kind: "json-share" });
    expect(textDecoder.decode(decoded.data)).toBe("markdown");
  });

  it("rejects mismatched additional data", async () => {
    const key = generateEncryptionKey();
    const encoded = await encodeEncryptedData(textEncoder.encode("state"), {
      encryptionKey: key,
      additionalData: textEncoder.encode("room-a"),
    });

    await expect(
      decodeEncryptedData(encoded, {
        decryptionKey: key,
        additionalData: textEncoder.encode("room-b"),
      }),
    ).rejects.toThrow();
  });
});
