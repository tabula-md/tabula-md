import { describe, expect, it } from "vitest";
import {
  decryptData,
  encryptData,
  generateEncryptionKey,
  importEncryptionKey,
} from "./encryption";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("encryption data primitives", () => {
  it("round trips AES-GCM encrypted bytes", async () => {
    const key = generateEncryptionKey();
    const plaintext = textEncoder.encode("hello tabula");
    const encrypted = await encryptData(key, plaintext);

    const decrypted = await decryptData(encrypted.iv, encrypted.encryptedBuffer, key);

    expect(textDecoder.decode(decrypted)).toBe("hello tabula");
  });

  it("rejects the wrong key", async () => {
    const encrypted = await encryptData(generateEncryptionKey(), textEncoder.encode("secret"));

    await expect(decryptData(encrypted.iv, encrypted.encryptedBuffer, generateEncryptionKey())).rejects.toThrow();
  });

  it("authenticates additional data", async () => {
    const key = await importEncryptionKey(generateEncryptionKey());
    const encrypted = await encryptData(key, textEncoder.encode("presence"), {
      additionalData: textEncoder.encode("room-a"),
    });

    await expect(
      decryptData(encrypted.iv, encrypted.encryptedBuffer, key, {
        additionalData: textEncoder.encode("room-b"),
      }),
    ).rejects.toThrow();
  });
});
