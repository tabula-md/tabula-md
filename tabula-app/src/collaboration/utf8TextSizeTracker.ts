const DEFAULT_CHUNK_SIZE = 4096;
const MAX_MERGED_CHUNK_SIZE = DEFAULT_CHUNK_SIZE * 2;
const encoder = new TextEncoder();

export type TextDeltaOperation = {
  insert?: unknown;
  delete?: number;
  retain?: number;
};

const splitText = (text: string) => {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(text.length, offset + DEFAULT_CHUNK_SIZE);
    const lastCodeUnit = text.charCodeAt(end - 1);
    if (end < text.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
};

export class Utf8TextSizeTracker {
  private chunks: string[];
  byteLength: number;

  constructor(text: string) {
    this.chunks = splitText(text);
    this.byteLength = encoder.encode(text).byteLength;
  }

  applyDelta(delta: readonly TextDeltaOperation[]) {
    const previousChunks = this.chunks;
    const nextChunks: string[] = [];
    let chunkIndex = 0;
    let chunkOffset = 0;
    let insertedByteLength = 0;
    let deletedByteLength = 0;

    const push = (value: string) => {
      if (!value) return;
      const previous = nextChunks.at(-1);
      if (previous !== undefined && previous.length + value.length <= MAX_MERGED_CHUNK_SIZE) {
        nextChunks[nextChunks.length - 1] = previous + value;
      } else {
        nextChunks.push(value);
      }
    };

    const consume = (requestedLength: number, keep: boolean) => {
      let remaining = Math.max(0, requestedLength);
      while (remaining > 0 && chunkIndex < previousChunks.length) {
        const chunk = previousChunks[chunkIndex];
        const available = chunk.length - chunkOffset;
        const length = Math.min(remaining, available);
        const part = chunk.slice(chunkOffset, chunkOffset + length);
        if (keep) push(part);
        else deletedByteLength += encoder.encode(part).byteLength;
        chunkOffset += length;
        remaining -= length;
        if (chunkOffset >= chunk.length) {
          chunkIndex += 1;
          chunkOffset = 0;
        }
      }
    };

    for (const operation of delta) {
      if (operation.retain) consume(operation.retain, true);
      if (operation.delete) consume(operation.delete, false);
      if (typeof operation.insert === "string") {
        push(operation.insert);
        insertedByteLength += encoder.encode(operation.insert).byteLength;
      }
    }

    if (chunkIndex < previousChunks.length) {
      if (chunkOffset > 0) {
        push(previousChunks[chunkIndex].slice(chunkOffset));
        chunkIndex += 1;
      }
      while (chunkIndex < previousChunks.length) {
        push(previousChunks[chunkIndex]);
        chunkIndex += 1;
      }
    }

    this.chunks = nextChunks;
    this.byteLength = Math.max(0, this.byteLength + insertedByteLength - deletedByteLength);
    return this.byteLength;
  }
}
