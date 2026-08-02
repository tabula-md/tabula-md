import { useMemo, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  Library,
  Lock,
} from "lucide-react";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { LibraryBundleFile } from "./libraryBundleModel";
import { getLibraryPanelCopy } from "./libraryPanelLocale";
import { useConnectedLibraries } from "./useConnectedLibraries";

const TABULA_LIBRARY_CATALOG_URL = "https://libraries.tabula.md/";

type LibraryPanelProps = {
  language: WorkspaceLanguage;
};

type LibraryTreeNode = {
  name: string;
  path: string;
  file?: LibraryBundleFile;
  children: LibraryTreeNode[];
};

const buildLibraryTree = (files: LibraryBundleFile[]) => {
  const root: LibraryTreeNode = { name: "", path: "", children: [] };
  files.forEach((file) => {
    let parent = root;
    file.path.split("/").forEach((name, index, segments) => {
      const path = segments.slice(0, index + 1).join("/");
      let node = parent.children.find((child) => child.name === name);
      if (!node) {
        node = { name, path, children: [] };
        parent.children.push(node);
      }
      if (index === segments.length - 1) node.file = file;
      parent = node;
    });
  });
  const sort = (nodes: LibraryTreeNode[]) => {
    nodes.sort((first, second) => {
      if (Boolean(first.file) !== Boolean(second.file)) return first.file ? 1 : -1;
      return first.name.localeCompare(second.name, undefined, { numeric: true });
    });
    nodes.forEach((node) => sort(node.children));
  };
  sort(root.children);
  return root.children;
};

function LibraryTree({
  files,
  libraryId,
  copy,
}: {
  files: LibraryBundleFile[];
  libraryId: string;
  copy: ReturnType<typeof getLibraryPanelCopy>;
}) {
  const tree = useMemo(() => buildLibraryTree(files), [files]);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const toggleFolder = (path: string) => setCollapsedPaths((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });
  const renderNodes = (nodes: LibraryTreeNode[], depth: number) => nodes.map((node) => {
    if (node.file) {
      return (
        <li
          className="library-file-row"
          key={`${libraryId}:${node.path}`}
          style={{ "--library-depth": depth } as CSSProperties}
          title={node.path}
        >
          <FileText size={14} aria-hidden="true" />
          <span>{node.name}</span>
        </li>
      );
    }
    const collapsed = collapsedPaths.has(node.path);
    return (
      <li className="library-folder" key={`${libraryId}:${node.path}`}>
        <button
          className="library-folder-row"
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? copy.openFolder(node.name) : copy.closeFolder(node.name)}
          style={{ "--library-depth": depth } as CSSProperties}
          onClick={() => toggleFolder(node.path)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <Folder size={14} aria-hidden="true" />
          <span>{node.name}</span>
        </button>
        {!collapsed && <ul>{renderNodes(node.children, depth + 1)}</ul>}
      </li>
    );
  });

  return <ul className="library-file-tree">{renderNodes(tree, 0)}</ul>;
}

export function LibraryPanel({ language }: LibraryPanelProps) {
  const copy = getLibraryPanelCopy(language);
  const { error, libraries, loading } = useConnectedLibraries();
  const [expandedLibraryIds, setExpandedLibraryIds] = useState<Set<string>>(() => new Set());
  const toggleLibrary = (libraryId: string) => setExpandedLibraryIds((current) => {
    const next = new Set(current);
    if (next.has(libraryId)) next.delete(libraryId);
    else next.add(libraryId);
    return next;
  });

  return (
    <section
      className="library-panel"
      aria-label={copy.libraries}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <p className="library-panel-message">{copy.loading}</p>
      ) : error ? (
        <p className="library-panel-message">{copy.loadError}</p>
      ) : libraries.length === 0 ? (
        <div className="library-empty-state">
          <span className="library-empty-icon" aria-hidden="true"><Library size={20} /></span>
          <div>
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyDescription}</p>
          </div>
          <a
            className="library-browse-action"
            href={TABULA_LIBRARY_CATALOG_URL}
            target="_blank"
            rel="noreferrer"
          >
            {copy.browseLibraries}
            <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        <ul className="library-list">
          {libraries.map((library) => {
            const expanded = expandedLibraryIds.has(library.id);
            return (
              <li className="library-item" key={library.id}>
                <button
                  className="library-item-trigger"
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded
                    ? copy.closeLibrary(library.name)
                    : copy.openLibrary(library.name)}
                  onClick={() => toggleLibrary(library.id)}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Library size={15} aria-hidden="true" />
                  <span className="library-item-copy">
                    <strong>{library.name}</strong>
                    <span>{[
                      library.publisher,
                      copy.version(library.version),
                      copy.fileCount(library.files.length),
                    ].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Lock size={13} aria-label={copy.readOnly} />
                </button>
                {expanded && (
                  <div className="library-item-body">
                    <LibraryTree files={library.files} libraryId={library.id} copy={copy} />
                    {library.sourceUrl && (
                      <a
                        className="library-source-link"
                        href={library.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.source}
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
