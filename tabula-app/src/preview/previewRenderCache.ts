export class BoundedStringCache {
  readonly #entries = new Map<string, { bytes: number; value: string }>();
  readonly #maxBytes: number;
  readonly #maxEntries: number;
  readonly #maxEntryBytes: number;
  #bytes = 0;

  constructor(options: { maxBytes: number; maxEntries: number; maxEntryBytes: number }) {
    this.#maxBytes = options.maxBytes;
    this.#maxEntries = options.maxEntries;
    this.#maxEntryBytes = options.maxEntryBytes;
  }

  read(key: string) {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  write(key: string, value: string) {
    const previous = this.#entries.get(key);
    if (previous) this.#bytes -= previous.bytes;
    this.#entries.delete(key);
    const bytes = new TextEncoder().encode(key).byteLength + new TextEncoder().encode(value).byteLength;
    if (bytes > this.#maxEntryBytes || bytes > this.#maxBytes) return;
    this.#entries.set(key, { bytes, value });
    this.#bytes += bytes;
    while (this.#entries.size > this.#maxEntries || this.#bytes > this.#maxBytes) {
      const oldestKey = this.#entries.keys().next().value;
      if (typeof oldestKey !== "string") return;
      this.#bytes -= this.#entries.get(oldestKey)?.bytes ?? 0;
      this.#entries.delete(oldestKey);
    }
  }

  get byteLength() {
    return this.#bytes;
  }

  get size() {
    return this.#entries.size;
  }
}

export const replaceAllText = (value: string, search: string, replacement: string) =>
  search.length === 0 ? value : value.split(search).join(replacement);
