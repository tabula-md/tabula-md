export class BoundedStringCache {
  readonly #entries = new Map<string, string>();
  readonly #limit: number;

  constructor(limit: number) {
    this.#limit = limit;
  }

  read(key: string) {
    const value = this.#entries.get(key);
    if (value === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  write(key: string, value: string) {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    while (this.#entries.size > this.#limit) {
      const oldestKey = this.#entries.keys().next().value;
      if (typeof oldestKey !== "string") return;
      this.#entries.delete(oldestKey);
    }
  }
}

export const replaceAllText = (value: string, search: string, replacement: string) =>
  search.length === 0 ? value : value.split(search).join(replacement);
