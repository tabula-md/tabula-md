import Dexie, { type Table } from "dexie";
import {
  connectLibraryBundle,
  parseLibraryBundle,
  type ConnectedLibrary,
} from "./libraryBundleModel";

const LIBRARY_DATABASE_NAME = "tabula-libraries-v1";

class TabulaLibraryDb extends Dexie {
  libraries!: Table<ConnectedLibrary, string>;

  constructor() {
    super(LIBRARY_DATABASE_NAME);
    this.version(1).stores({ libraries: "id,name,updatedAt" });
  }
}

export const libraryIndexedDb = new TabulaLibraryDb();

const libraryEvents = new EventTarget();
const LIBRARIES_CHANGED_EVENT = "libraries-changed";

export const subscribeToLibraries = (listener: () => void) => {
  libraryEvents.addEventListener(LIBRARIES_CHANGED_EVENT, listener);
  return () => libraryEvents.removeEventListener(LIBRARIES_CHANGED_EVENT, listener);
};

export const readConnectedLibraries = async () => {
  const libraries = await libraryIndexedDb.libraries.toArray();
  return libraries.sort((first, second) => first.name.localeCompare(second.name));
};

export const saveLibraryBundle = async (value: unknown, now = new Date().toISOString()) => {
  const parsed = parseLibraryBundle(value);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const previous = await libraryIndexedDb.libraries.get(parsed.bundle.id);
  const connected = connectLibraryBundle(parsed.bundle, now, previous);
  await libraryIndexedDb.libraries.put(connected);
  libraryEvents.dispatchEvent(new Event(LIBRARIES_CHANGED_EVENT));
  return connected;
};

export const disconnectLibrary = async (libraryId: string) => {
  await libraryIndexedDb.libraries.delete(libraryId);
  libraryEvents.dispatchEvent(new Event(LIBRARIES_CHANGED_EVENT));
};
