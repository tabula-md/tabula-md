import { useEffect, useMemo, useState } from "react";
import { inspectFrontmatterData } from "@tabula-md/tabula";
import {
  Braces,
  FileText,
  FolderInput,
  FolderPlus,
  FilePlus2,
  ListPlus,
  MessageSquare,
  PanelLeft,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";

type LauncherCommand = {
  id: string;
  label: string;
  section: "Commands" | "Settings";
  icon: typeof FileText;
  run: () => void;
};

const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase();
const readPath = (value: unknown, path: string) => path.split(".").reduce<unknown>(
  (current, key) => current && typeof current === "object"
    ? (current as Record<string, unknown>)[key]
    : undefined,
  value,
);

export function WorkspaceLauncher({
  files,
  folders,
  openFileIds,
  activeFileId,
  onClose,
  onSelectFile,
  onNewFile,
  onNewFolder,
  onImportFile,
  onImportWorkspace,
  onAddProperty,
  onOpenFiles,
  onOpenComments,
  onOpenProperties,
  onOpenPreferences,
}: {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  openFileIds: readonly string[];
  activeFileId?: string;
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onImportFile: () => void;
  onImportWorkspace: () => void;
  onAddProperty?: () => void;
  onOpenFiles: () => void;
  onOpenComments: () => void;
  onOpenProperties: () => void;
  onOpenPreferences: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const labels = useMemo(() => getWorkspaceFileTabLabels(files, folders), [files, folders]);
  const commands = useMemo<LauncherCommand[]>(() => [
    { id: "new-document", label: "New document", section: "Commands", icon: FilePlus2, run: onNewFile },
    { id: "new-folder", label: "New folder", section: "Commands", icon: FolderPlus, run: onNewFolder },
    ...(onAddProperty
      ? [{ id: "add-property", label: "Add property", section: "Commands" as const, icon: ListPlus, run: onAddProperty }]
      : []),
    { id: "import-document", label: "Import document (.md)…", section: "Commands", icon: FileText, run: onImportFile },
    { id: "import-folder", label: "Import folder copy…", section: "Commands", icon: FolderInput, run: onImportWorkspace },
    { id: "open-files", label: "Open Files", section: "Commands", icon: PanelLeft, run: onOpenFiles },
    { id: "open-comments", label: "Open Comments", section: "Commands", icon: MessageSquare, run: onOpenComments },
    { id: "open-properties", label: "Open Properties", section: "Commands", icon: Braces, run: onOpenProperties },
    { id: "preferences", label: "Preferences", section: "Settings", icon: SlidersHorizontal, run: onOpenPreferences },
  ], [
    onAddProperty,
    onImportFile,
    onImportWorkspace,
    onNewFile,
    onNewFolder,
    onOpenComments,
    onOpenFiles,
    onOpenPreferences,
    onOpenProperties,
  ]);
  const trimmed = query.trim();
  const filter = trimmed.match(/^([\w.-]+):(.*)$/u);
  const documentResults = useMemo(() => {
    const openOrder = new Map(openFileIds.map((id, index) => [id, index]));
    return files.map((file) => {
      const title = labels.get(file.id)?.displayTitle ?? file.title;
      const path = labels.get(file.id)?.fullPath ?? title;
      const frontmatter = inspectFrontmatterData(file.text);
      return { file, title, path, metadata: frontmatter.metadata, body: frontmatter.body, open: openOrder.has(file.id) };
    }).filter((entry) => {
      if (!trimmed) return entry.open || entry.file.id === activeFileId;
      if (filter) {
        const value = readPath(entry.metadata, filter[1] ?? "");
        return filter[2]?.trim()
          ? normalize(value).includes(normalize(filter[2]))
          : value !== undefined;
      }
      return normalize([entry.title, entry.path, entry.body, JSON.stringify(entry.metadata)].join(" ")).includes(normalize(trimmed));
    }).sort((a, b) => Number(b.file.id === activeFileId) - Number(a.file.id === activeFileId) || Number(b.open) - Number(a.open));
  }, [activeFileId, files, filter, labels, openFileIds, trimmed]);
  const commandResults = useMemo(() => filter ? [] : commands.filter(
    (command) => !trimmed || normalize(command.label).includes(normalize(trimmed)),
  ), [commands, filter, trimmed]);
  const entries = [...documentResults.map((result) => ({ kind: "document" as const, ...result })), ...commandResults.map((command) => ({ kind: "command" as const, command }))];

  useEffect(() => setActiveIndex(0), [query]);
  const run = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    onClose();
    if (entry.kind === "document") onSelectFile(entry.file.id);
    else entry.command.run();
  };

  return (
    <ModalSurface className="workspace-launcher-modal" ariaLabel="Search documents and commands" onClose={onClose}>
      <div className="workspace-launcher-search">
        <Search size={19} aria-hidden="true" />
        <input
          data-modal-initial-focus
          role="combobox"
          aria-label="Search documents and commands"
          aria-controls="workspace-launcher-results"
          aria-expanded="true"
          placeholder="Search documents and commands"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => entries.length
                ? (current + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length
                : 0);
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(activeIndex);
            }
          }}
        />
        <button className="workspace-launcher-close" type="button" aria-label="Close search" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="workspace-launcher-results" id="workspace-launcher-results" role="listbox">
        {!entries.length && <p className="workspace-launcher-empty">No documents or commands found</p>}
        {entries.map((entry, index) => {
          const section = entry.kind === "document"
            ? (trimmed ? "Search" : "Suggestions")
            : entry.command.section;
          const previous = entries[index - 1];
          const previousSection = previous?.kind === "document"
            ? (trimmed ? "Search" : "Suggestions")
            : previous?.command.section;
          const Icon = entry.kind === "document" ? FileText : entry.command.icon;
          const label = entry.kind === "document" ? entry.title : entry.command.label;
          return (
            <div className="workspace-launcher-entry" key={entry.kind === "document" ? entry.file.id : entry.command.id}>
              {section !== previousSection && <h2>{section}</h2>}
              <button type="button" role="option" aria-selected={activeIndex === index} onMouseMove={() => setActiveIndex(index)} onClick={() => run(index)}>
                <Icon size={16} />
                <span><strong>{label}</strong>{entry.kind === "document" && entry.path !== entry.title && <small>{entry.path}</small>}</span>
                <small>{entry.kind === "document" ? "Document" : entry.command.section.slice(0, -1)}</small>
              </button>
            </div>
          );
        })}
      </div>
      <footer className="workspace-launcher-footer">↑ ↓ Navigate · ↵ Open</footer>
    </ModalSurface>
  );
}
