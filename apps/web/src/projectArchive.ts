import type { WorkspaceFile } from "./workspaceStorage";

const textEncoder = new TextEncoder();
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_HEADER = 0x06054b50;

export type ZipEntrySource = {
  path: string;
  content: string;
};

const crc32Table = new Uint32Array(256);

for (let index = 0; index < crc32Table.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crc32Table[index] = value >>> 0;
}

export const getCrc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const toDosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
};

const writeUint16 = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value, true);
};

const writeUint32 = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true);
};

const createRecord = (size: number, writer: (view: DataView) => void) => {
  const buffer = new ArrayBuffer(size);
  writer(new DataView(buffer));
  return new Uint8Array(buffer);
};

const normalizeArchiveFileName = (title: string) => {
  const cleanedTitle = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/^-+/, "")
    .slice(0, 120);
  const baseName = cleanedTitle || "Untitled";

  return /\.(?:md|markdown)$/i.test(baseName) ? baseName : `${baseName}.md`;
};

export const getProjectArchiveEntries = (files: WorkspaceFile[]): ZipEntrySource[] => {
  const fileNameCounts = new Map<string, number>();

  return files.map((file) => {
    const fileName = normalizeArchiveFileName(file.title);
    const normalizedKey = fileName.toLowerCase();
    const count = fileNameCounts.get(normalizedKey) ?? 0;
    fileNameCounts.set(normalizedKey, count + 1);

    const dedupedFileName =
      count === 0
        ? fileName
        : fileName.replace(/(\.(?:md|markdown))$/i, ` ${count + 1}$1`);

    return {
      path: dedupedFileName,
      content: file.text,
    };
  });
};

export const createZipArchive = (entries: ZipEntrySource[]) => {
  const { dosDate, dosTime } = toDosDateTime();
  const parts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = textEncoder.encode(entry.path);
    const contentBytes = textEncoder.encode(entry.content);
    const crc32 = getCrc32(contentBytes);
    const localHeader = createRecord(30, (view) => {
      writeUint32(view, 0, ZIP_LOCAL_FILE_HEADER);
      writeUint16(view, 4, 20);
      writeUint16(view, 6, 0x0800);
      writeUint16(view, 8, 0);
      writeUint16(view, 10, dosTime);
      writeUint16(view, 12, dosDate);
      writeUint32(view, 14, crc32);
      writeUint32(view, 18, contentBytes.byteLength);
      writeUint32(view, 22, contentBytes.byteLength);
      writeUint16(view, 26, pathBytes.byteLength);
      writeUint16(view, 28, 0);
    });
    const centralHeader = createRecord(46, (view) => {
      writeUint32(view, 0, ZIP_CENTRAL_DIRECTORY_HEADER);
      writeUint16(view, 4, 20);
      writeUint16(view, 6, 20);
      writeUint16(view, 8, 0x0800);
      writeUint16(view, 10, 0);
      writeUint16(view, 12, dosTime);
      writeUint16(view, 14, dosDate);
      writeUint32(view, 16, crc32);
      writeUint32(view, 20, contentBytes.byteLength);
      writeUint32(view, 24, contentBytes.byteLength);
      writeUint16(view, 28, pathBytes.byteLength);
      writeUint16(view, 30, 0);
      writeUint16(view, 32, 0);
      writeUint16(view, 34, 0);
      writeUint16(view, 36, 0);
      writeUint32(view, 38, 0);
      writeUint32(view, 42, offset);
    });

    parts.push(localHeader, pathBytes, contentBytes);
    centralDirectoryParts.push(centralHeader, pathBytes);
    offset += localHeader.byteLength + pathBytes.byteLength + contentBytes.byteLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectoryParts.reduce((size, part) => size + part.byteLength, 0);
  const endRecord = createRecord(22, (view) => {
    writeUint32(view, 0, ZIP_END_OF_CENTRAL_DIRECTORY_HEADER);
    writeUint16(view, 4, 0);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, entries.length);
    writeUint16(view, 10, entries.length);
    writeUint32(view, 12, centralDirectorySize);
    writeUint32(view, 16, centralDirectoryOffset);
    writeUint16(view, 20, 0);
  });

  const zipParts = [...parts, ...centralDirectoryParts, endRecord];
  const zipBytes = new Uint8Array(zipParts.reduce((size, part) => size + part.byteLength, 0));
  let writeOffset = 0;
  for (const part of zipParts) {
    zipBytes.set(part, writeOffset);
    writeOffset += part.byteLength;
  }

  return new Blob([zipBytes.buffer], { type: "application/zip" });
};

export const createProjectArchive = (files: WorkspaceFile[]) => createZipArchive(getProjectArchiveEntries(files));
