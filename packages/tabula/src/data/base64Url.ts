const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const decodeTable = new Map<string, number>(
  [...base64Alphabet].map((character, index) => [character, index]),
);

decodeTable.set("-", 62);
decodeTable.set("_", 63);

export const encodeBase64Url = (bytes: Uint8Array) => {
  let output = "";

  for (let index = 0; index < bytes.byteLength; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const hasSecond = index + 1 < bytes.byteLength;
    const hasThird = index + 2 < bytes.byteLength;
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += base64UrlAlphabet[(chunk >> 18) & 63];
    output += base64UrlAlphabet[(chunk >> 12) & 63];
    if (hasSecond) {
      output += base64UrlAlphabet[(chunk >> 6) & 63];
    }
    if (hasThird) {
      output += base64UrlAlphabet[chunk & 63];
    }
  }

  return output;
};

export const decodeBase64Url = (value: string) => {
  if (value.length === 0 || value.includes("=") || value.length % 4 === 1) {
    throw new Error("Invalid base64url value");
  }

  let buffer = 0;
  let bits = 0;
  const output: number[] = [];

  for (const character of value) {
    const decoded = decodeTable.get(character);
    if (decoded === undefined) {
      throw new Error("Invalid base64url value");
    }

    buffer = (buffer << 6) | decoded;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }

  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) {
    throw new Error("Invalid base64url value");
  }

  return new Uint8Array(output);
};
