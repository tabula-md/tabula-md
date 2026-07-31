const BINARY_SUPPORT_FILE_PREFIX = "tabula.md:binary-support-file;base64,";
const BASE64_CHUNK_BYTES = 0x8000;

export const isMarkdownWorkspacePath = (path: string) => /\.md$/i.test(path);

export const encodeBinaryWorkspaceSupportFile = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES));
  }
  return `${BINARY_SUPPORT_FILE_PREFIX}${btoa(binary)}`;
};

export const decodeBinaryWorkspaceSupportFile = (
  path: string,
  content: string,
): Uint8Array | undefined => {
  if (
    isMarkdownWorkspacePath(path)
    || !content.startsWith(BINARY_SUPPORT_FILE_PREFIX)
  ) {
    return undefined;
  }
  try {
    const binary = atob(content.slice(BINARY_SUPPORT_FILE_PREFIX.length));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
};

export const isBinaryWorkspaceSupportFile = (
  path: string,
  content: string,
) => Boolean(decodeBinaryWorkspaceSupportFile(path, content));
