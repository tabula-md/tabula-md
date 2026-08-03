import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getOkfFreshness,
  stripMarkdownExtension,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  File,
  FileText,
  Search,
} from "lucide-react";
import { rankCommandPaletteCandidates } from "../commandPaletteModel";
import { DEFAULT_SEARCH_OPTIONS } from "../../editor/editorSearchModel";
import {
  searchWorkspaceFiles,
  type WorkspaceFileSearchEntry,
  type WorkspaceFileSearchMatch,
} from "../../editor/workspaceFileSearchModel";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { getWorkspaceFilePresentation } from "../workspaceFilePresentation";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import type { WorkspaceSearchCommand } from "../workspaceCommandRegistry";
export type { WorkspaceSearchCommand } from "../workspaceCommandRegistry";

type CommandPaletteCopy = {
  placeholder: string;
  openDocuments: string;
  documents: string;
  noResults: string;
  navigate: string;
  run: string;
  actions: string;
};

type CommandPaletteSearchCopy = {
  matchLabels: Record<WorkspaceFileSearchMatch["field"], string>;
};

type WorkspaceCommandPaletteProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  activeFileId?: string;
  openFileIds: readonly string[];
  commands: readonly WorkspaceSearchCommand[];
  copy: CommandPaletteCopy;
  searchCopy: CommandPaletteSearchCopy;
  onSelectFile: (fileId: string) => void;
};

type PaletteCommandEntry = {
  id: string;
  kind: "command";
  label: string;
  searchText: string;
  priority: number;
  command: WorkspaceSearchCommand;
};

type PaletteDocumentEntry = {
  id: string;
  kind: "document";
  label: string;
  path: string;
  searchText: string;
  priority: number;
  file: WorkspaceFile;
  isOpen: boolean;
  isMarkdown: boolean;
  match?: WorkspaceFileSearchMatch;
};

type PaletteEntry = PaletteCommandEntry | PaletteDocumentEntry;

const MAX_VISIBLE_RESULTS = 30;

export function WorkspaceCommandPalette({
  files,
  folders,
  index,
  activeFileId,
  openFileIds,
  commands,
  copy,
  searchCopy,
  onSelectFile,
}: WorkspaceCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const fileLabels = useMemo(
    () => getWorkspaceFileTabLabels(files, folders),
    [files, folders],
  );
  const openFileOrder = useMemo(
    () => new Map(openFileIds.map((fileId, index) => [fileId, index])),
    [openFileIds],
  );
  const commandEntries = useMemo<PaletteCommandEntry[]>(() => commands
    .filter((command) => command.enabled !== false)
    .map((command, index) => ({
      id: `command-${command.id}`,
      kind: "command",
      label: command.label,
      searchText: [command.label, ...(command.keywords ?? [])].join(" "),
      priority: 80 - index,
      command,
    })), [commands]);
  const documentEntries = useMemo<PaletteDocumentEntry[]>(() => files.map((file) => {
    const labels = fileLabels.get(file.id);
    const presentation = getWorkspaceFilePresentation(file);
    const displayTitle = labels?.displayTitle ?? file.title;
    const label = presentation.kind === "markdown"
      ? stripMarkdownExtension(displayTitle)
      : displayTitle;
    const fullPath = labels?.fullPath ?? displayTitle;
    const path = presentation.kind === "markdown"
      ? stripMarkdownExtension(fullPath)
      : fullPath;
    const openIndex = openFileOrder.get(file.id);
    return {
      id: `document-${file.id}`,
      kind: "document",
      label,
      path,
      searchText: `${label} ${path}`,
      priority: file.id === activeFileId
        ? 220
        : openIndex === undefined ? 20 : 180 - openIndex,
      file,
      isOpen: openIndex !== undefined,
      isMarkdown: presentation.kind === "markdown",
    };
  }), [activeFileId, fileLabels, files, openFileOrder]);
  const documentEntriesById = useMemo(
    () => new Map(documentEntries.map((entry) => [entry.file.id, entry])),
    [documentEntries],
  );
  const searchEntries = useMemo(
    () => files.map((file): WorkspaceFileSearchEntry => {
      const analysis = index?.analysesByDocumentId.get(file.id);
      const metadata = analysis?.knowledgeMetadata;
      const presentation = getWorkspaceFilePresentation(file);
      const document = documentEntriesById.get(file.id);
      return {
        fileId: file.id,
        displayPath: document?.path ?? file.title,
        title: analysis?.title ?? document?.label,
        description: metadata?.description,
        type: metadata?.type ?? (
          presentation.kind === "asset" ? presentation.format : undefined
        ),
        tags: metadata?.tags,
        resource: metadata?.resource,
        sourceValues: metadata?.sources.flatMap((source) => [
          source.id,
          source.title,
          source.author,
          source.resource,
        ].filter((value): value is string => Boolean(value))),
        generatedBy: metadata?.generated?.by,
        verifiedBy: metadata?.verified.map((event) => event.by),
        status: metadata?.type ? metadata.status : undefined,
        trustTier: metadata?.type ? metadata.trustTier : undefined,
        freshness: metadata?.type ? getOkfFreshness(metadata) : undefined,
        markdown: presentation.kind === "markdown" || presentation.viewer === "text"
          ? file.text
          : undefined,
      };
    }),
    [documentEntriesById, files, index],
  );
  const normalizedQuery = query.trim();
  const documentSearch = useMemo(
    () => searchWorkspaceFiles(
      searchEntries,
      normalizedQuery,
      DEFAULT_SEARCH_OPTIONS,
    ),
    [normalizedQuery, searchEntries],
  );
  const visibleEntries = useMemo<PaletteEntry[]>(() => {
    if (!normalizedQuery) {
      const openDocuments = rankCommandPaletteCandidates(
        documentEntries.filter(({ isOpen }) => isOpen),
        "",
      );
      return [...openDocuments, ...commandEntries].slice(0, MAX_VISIBLE_RESULTS);
    }
    const matchingCommands = rankCommandPaletteCandidates(
      commandEntries,
      normalizedQuery,
    );
    const matchingDocuments = documentSearch.matches.flatMap((match) => {
      const entry = documentEntriesById.get(match.file.fileId);
      return entry ? [{ ...entry, match }] : [];
    });
    return [...matchingCommands, ...matchingDocuments].slice(0, MAX_VISIBLE_RESULTS);
  }, [commandEntries, documentEntries, documentEntriesById, documentSearch.matches, normalizedQuery]);

  useEffect(() => setActiveIndex(0), [normalizedQuery]);

  const moveActive = (offset: -1 | 1) => {
    if (visibleEntries.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + offset + visibleEntries.length) % visibleEntries.length;
      window.requestAnimationFrame(() => {
        document.getElementById(`command-palette-item-${next}`)?.scrollIntoView({
          block: "nearest",
        });
      });
      return next;
    });
  };
  const selectEntry = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    if (entry.kind === "command") entry.command.onSelect();
    else onSelectFile(entry.file.id);
  };
  const getSectionLabel = (entry: PaletteEntry, index: number) => {
    const previous = visibleEntries[index - 1];
    if (entry.kind === "command") {
      return previous?.kind === "command" ? undefined : copy.actions;
    }
    const label = entry.isOpen && !normalizedQuery
      ? copy.openDocuments
      : copy.documents;
    const previousLabel = previous?.kind === "document"
      ? (previous.isOpen && !normalizedQuery ? copy.openDocuments : copy.documents)
      : undefined;
    return previousLabel === label ? undefined : label;
  };

  return (
    <section className="command-palette">
      <label className="command-palette-search">
        <Search size={18} aria-hidden="true" />
        <input
          data-modal-initial-focus
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-label={copy.placeholder}
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={visibleEntries.length > 0
            ? `command-palette-item-${Math.min(activeIndex, visibleEntries.length - 1)}`
            : undefined}
          placeholder={copy.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              moveActive(event.key === "ArrowDown" ? 1 : -1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              selectEntry(visibleEntries[Math.min(activeIndex, visibleEntries.length - 1)]);
            }
          }}
        />
      </label>

      <div className="command-palette-results" id="command-palette-results" role="listbox">
        {visibleEntries.length === 0 ? (
          <p className="command-palette-empty">{copy.noResults}</p>
        ) : visibleEntries.map((entry, index) => {
          const sectionLabel = getSectionLabel(entry, index);
          const selected = activeIndex === index;
          return (
            <div className="command-palette-entry" key={entry.id}>
              {sectionLabel && <h2>{sectionLabel}</h2>}
              <button
                id={`command-palette-item-${index}`}
                className="command-palette-result"
                type="button"
                role="option"
                aria-label={entry.label}
                aria-selected={selected}
                data-active={selected || undefined}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => selectEntry(entry)}
              >
                <span className="command-palette-result-icon" aria-hidden="true">
                  {entry.kind === "command"
                    ? (entry.command.icon ?? <CornerDownLeft size={16} />)
                    : (entry.isMarkdown ? <FileText size={16} /> : <File size={16} />)}
                </span>
                <span className="command-palette-result-copy">
                  <span>
                    <HighlightedText
                      query={normalizedQuery}
                      enabled={entry.kind === "document" && entry.match?.field === "title"}
                    >
                      {entry.label}
                    </HighlightedText>
                  </span>
                  {entry.kind === "document" && entry.path !== entry.label && (
                    <span>
                      <HighlightedText
                        query={normalizedQuery}
                        enabled={entry.match?.field === "path"}
                      >
                        {entry.path}
                      </HighlightedText>
                    </span>
                  )}
                  {entry.kind === "document" && getMatchContext(entry) && (
                    <span className="command-palette-result-context">
                      <HighlightedText query={normalizedQuery} enabled>
                        {getMatchContext(entry) ?? ""}
                      </HighlightedText>
                    </span>
                  )}
                </span>
                {entry.kind === "command" && entry.command.shortcut && (
                  <kbd>{entry.command.shortcut}</kbd>
                )}
                {entry.kind === "command" && !entry.command.shortcut && (
                  <span className="command-palette-result-kind" aria-hidden="true">
                    {entry.command.category}
                  </span>
                )}
                {entry.kind === "document" && entry.match && (
                  <span className="command-palette-result-kind">
                    {searchCopy.matchLabels[entry.match.field]}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <footer className="command-palette-footer" aria-hidden="true">
        <span><ArrowUp size={12} /><ArrowDown size={12} /> {copy.navigate}</span>
        <span><CornerDownLeft size={12} /> {copy.run}</span>
      </footer>
    </section>
  );
}

const HighlightedText = ({
  children,
  enabled,
  query,
}: {
  children: string;
  enabled: boolean;
  query: string;
}) => {
  if (!enabled || !query) return children;
  const index = children.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0) return children;
  return (
    <>
      {children.slice(0, index)}
      <mark>{children.slice(index, index + query.length)}</mark>
      {children.slice(index + query.length)}
    </>
  );
};

const getMatchContext = (entry: PaletteDocumentEntry) => {
  if (!entry.match?.snippet || entry.match.field === "title" || entry.match.field === "path") {
    return undefined;
  }
  const snippet = entry.match.snippet.trim();
  if (!snippet || snippet === entry.label || snippet === entry.path) return undefined;
  return snippet;
};
