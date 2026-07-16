export type BrowserStorageArea = "localStorage" | "sessionStorage";

export type BrowserStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const getBrowserStorage = (area: BrowserStorageArea): BrowserStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window[area];
  } catch {
    return null;
  }
};

export const readBrowserStorage = (
  storage: Pick<BrowserStorage, "getItem"> | null | undefined,
  key: string,
) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writeBrowserStorage = (
  storage: Pick<BrowserStorage, "setItem"> | null | undefined,
  key: string,
  value: string,
) => {
  try {
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
};

export const removeBrowserStorage = (
  storage: Pick<BrowserStorage, "removeItem"> | null | undefined,
  key: string,
) => {
  try {
    storage?.removeItem(key);
    return Boolean(storage);
  } catch {
    return false;
  }
};
