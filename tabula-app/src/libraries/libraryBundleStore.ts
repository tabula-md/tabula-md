import Dexie, { type Table } from "dexie";

const LIBRARY_DATABASE_NAME = "tabula-libraries-v1";

export const TABULA_LIBRARY_CATALOG_URL = "https://libraries.tabula.md/";

export type LibraryBundleFile = {
  path: string;
  name: string;
  size: number;
  type: string;
  content: Blob;
};

export type LibraryBundle = {
  id: string;
  name: string;
  importedAt: string;
  files: LibraryBundleFile[];
};

export type LibraryBundleRow = {
  path: string;
  name: string;
  depth: number;
  kind: "folder" | "file";
};

class TabulaLibraryDb extends Dexie {
  bundles!: Table<LibraryBundle, string>;

  constructor() {
    super(LIBRARY_DATABASE_NAME);
    this.version(1).stores({ bundles: "id, importedAt, name" });
  }
}

export const libraryDatabase = new TabulaLibraryDb();

const selectedPath = (file: File) => file.webkitRelativePath || file.name;

export const createLibraryBundle = (
  selectedFiles: readonly File[],
  now = new Date(),
): LibraryBundle => {
  if (selectedFiles.length === 0) throw new Error("Select a folder to import.");

  const paths = selectedFiles.map(selectedPath);
  const firstRoot = paths[0]?.split("/")[0];
  const sharedRoot = firstRoot && paths.every((path) => path.startsWith(`${firstRoot}/`))
    ? firstRoot
    : undefined;
  const name = sharedRoot || "Imported library";

  return {
    id: crypto.randomUUID(),
    name,
    importedAt: now.toISOString(),
    files: selectedFiles.map((file, index) => {
      const path = paths[index] ?? file.name;
      const normalizedPath = sharedRoot ? path.slice(sharedRoot.length + 1) : path;
      return {
        path: normalizedPath,
        name: file.name,
        size: file.size,
        type: file.type,
        content: file,
      };
    }),
  };
};

export const readLibraryBundles = () => libraryDatabase.bundles.orderBy("importedAt").reverse().toArray();

export const saveLibraryBundle = (bundle: LibraryBundle) => libraryDatabase.bundles.put(bundle);

type MutableTreeNode = {
  children: Map<string, MutableTreeNode>;
  file?: LibraryBundleFile;
};

export const getLibraryBundleRows = (files: readonly LibraryBundleFile[]) => {
  const root: MutableTreeNode = { children: new Map() };
  for (const file of files) {
    let current = root;
    for (const segment of file.path.split("/")) {
      const child = current.children.get(segment) ?? { children: new Map() };
      current.children.set(segment, child);
      current = child;
    }
    current.file = file;
  }

  const rows: LibraryBundleRow[] = [];
  const visit = (node: MutableTreeNode, parentPath: string, depth: number) => {
    const children = [...node.children.entries()].sort(([firstName, first], [secondName, second]) => {
      const firstFolder = first.children.size > 0 && !first.file;
      const secondFolder = second.children.size > 0 && !second.file;
      if (firstFolder !== secondFolder) return firstFolder ? -1 : 1;
      return firstName.localeCompare(secondName);
    });
    for (const [name, child] of children) {
      const path = parentPath ? `${parentPath}/${name}` : name;
      const kind = child.children.size > 0 && !child.file ? "folder" : "file";
      rows.push({ path, name, depth, kind });
      if (child.children.size > 0) visit(child, path, depth + 1);
    }
  };
  visit(root, "", 0);
  return rows;
};
