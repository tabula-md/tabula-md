import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  HelpCircle,
  Link,
  PanelLeft,
  Settings2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { LeftPanelView, LibraryItem } from "../uiTypes";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

type LeftSidebarProps = {
  isOpen: boolean;
  view: LeftPanelView;
  preferencesOpen: boolean;
  hasActiveFile: boolean;
  activeFileTitle: string;
  activeFileWordCount: number;
  canPublishActiveFile: boolean;
  activeFilePublishBlockerMessage: string;
  projectFileCount: number;
  projectEmptyFileCount: number;
  projectPublishBlockerMessage: string;
  storageVersion: number;
  templates: LibraryItem[];
  newFileViewMode: FileViewMode;
  defaultReadingWidth: ReadingWidth;
  defaultLineWrapping: boolean;
  defaultLineNumbers: boolean;
  onSetView: (view: LeftPanelView) => void;
  onClose: () => void;
  onTogglePreferences: () => void;
  onClosePreferences: () => void;
  onChangeNewFileViewMode: (viewMode: FileViewMode) => void;
  onChangeDefaultReadingWidth: (readingWidth: ReadingWidth) => void;
  onChangeDefaultLineWrapping: (lineWrapping: boolean) => void;
  onChangeDefaultLineNumbers: (lineNumbers: boolean) => void;
  onAddFile: () => void;
  onOpenMarkdownFile: () => void;
  onImportProject: () => void;
  onExportCurrentFile: () => void;
  onDownloadWorkspace: () => void;
  onOpenCollaborate: () => void;
  onOpenPublish: () => void;
  onOpenHelp: () => void;
  onAddTemplate: (item: LibraryItem) => void;
};

const getFileDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

export function LeftSidebar({
  isOpen,
  view,
  preferencesOpen,
  hasActiveFile,
  activeFileTitle,
  activeFileWordCount,
  canPublishActiveFile,
  activeFilePublishBlockerMessage,
  projectFileCount,
  projectEmptyFileCount,
  projectPublishBlockerMessage,
  storageVersion,
  templates,
  newFileViewMode,
  defaultReadingWidth,
  defaultLineWrapping,
  defaultLineNumbers,
  onSetView,
  onClose,
  onTogglePreferences,
  onClosePreferences,
  onChangeNewFileViewMode,
  onChangeDefaultReadingWidth,
  onChangeDefaultLineWrapping,
  onChangeDefaultLineNumbers,
  onAddFile,
  onOpenMarkdownFile,
  onImportProject,
  onExportCurrentFile,
  onDownloadWorkspace,
  onOpenCollaborate,
  onOpenPublish,
  onOpenHelp,
  onAddTemplate,
}: LeftSidebarProps) {
  const activeTab = view;
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState(() => templates[0]?.title ?? "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.title === selectedTemplateTitle) ?? templates[0],
    [selectedTemplateTitle, templates],
  );

  const renderTab = (tabView: "new" | "templates" | "handoff", label: string, icon: ReactNode) => (
    <button
      className={activeTab === tabView ? "active" : ""}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={activeTab === tabView}
      onClick={() => onSetView(tabView)}
    >
      {icon}
    </button>
  );

  const renderSegment = <Value extends string>(
    currentValue: Value,
    options: Array<{ value: Value; label: string }>,
    onChange: (value: Value) => void,
  ) => (
    <div className="left-preferences-segmented">
      {options.map((option) => (
        <button
          className={currentValue === option.value ? "active" : ""}
          type="button"
          key={option.value}
          aria-pressed={currentValue === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const renderSwitch = (active: boolean, label: string, onChange: (active: boolean) => void) => (
    <button className={`left-preferences-check ${active ? "active" : ""}`} type="button" onClick={() => onChange(!active)}>
      <span aria-hidden="true">{active && <Check size={14} />}</span>
      <strong>{label}</strong>
    </button>
  );
  const activeFileWordLabel = activeFileWordCount === 1 ? "1 word" : `${activeFileWordCount} words`;
  const activeFileReadiness = !hasActiveFile
    ? "Open a file before publishing."
    : activeFilePublishBlockerMessage || "Current file is ready to publish.";
  const projectReadiness =
    projectPublishBlockerMessage || "Project is ready to publish. Agent-readable endpoints are included.";
  const projectEmptyLabel = projectEmptyFileCount === 1 ? "1 empty file" : `${projectEmptyFileCount} empty files`;

  return (
    <aside className="left-sidebar" aria-label="Workspace Tools">
      {isOpen && (
        <>
          <div className="left-sidebar-chrome">
            <button
              className="left-panel-close"
              type="button"
              title="Close Workspace Tools"
              aria-label="Close Workspace Tools"
              onClick={onClose}
            >
              <PanelLeft size={16} />
            </button>
            <nav className="left-panel-tabs" aria-label="Panel views">
              {renderTab("new", "New", <FilePlus2 size={15} />)}
              {renderTab("templates", "Templates", <BookOpen size={15} />)}
              {renderTab("handoff", "Handoff", <Link size={15} />)}
            </nav>
          </div>

          <section className="left-panel" aria-label={`${view} panel`}>
            <div className="left-panel-scroll">
              {view === "new" && (
                <div className="left-panel-content">
                  <header className="left-panel-header">
                    <div>
                      <h2>New</h2>
                      <p>Start or bring Markdown into this project.</p>
                    </div>
                  </header>
                  <section className="left-workspace-actions" aria-label="New document actions">
                    <button type="button" onClick={onAddFile}>
                      <FilePlus2 size={14} />
                      <span>Blank Markdown</span>
                    </button>
                    <button type="button" onClick={onOpenMarkdownFile}>
                      <FolderOpen size={14} />
                      <span>Open Markdown...</span>
                    </button>
                    <button type="button" onClick={onImportProject}>
                      <Upload size={14} />
                      <span>Import project...</span>
                    </button>
                  </section>
                </div>
              )}

              {view === "templates" && (
                <div className="left-panel-content">
                  <header className="left-panel-header">
                    <div>
                      <h2>Templates</h2>
                      <p>Standard documents for people and AI agents.</p>
                    </div>
                  </header>
                  <div className="left-library-items" aria-label="Templates">
                    {templates.map((item) => (
                      <button
                        className={`left-library-item ${selectedTemplate?.title === item.title ? "active" : ""}`}
                        type="button"
                        key={item.title}
                        aria-label={getFileDisplayTitle(item.title)}
                        aria-pressed={selectedTemplate?.title === item.title}
                        title={item.description}
                        onClick={() => setSelectedTemplateTitle(item.title)}
                      >
                        <FileText size={14} />
                        <span>
                          <strong>{getFileDisplayTitle(item.title)}</strong>
                          <small>{item.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedTemplate && (
                    <section className="left-template-detail" aria-label="Template details">
                      <div className="left-template-detail-header">
                        <FileText size={14} />
                        <div>
                          <span>{getFileDisplayTitle(selectedTemplate.title)}</span>
                          <p>{selectedTemplate.purpose}</p>
                        </div>
                      </div>
                      <div className="left-template-sections" aria-label="Template sections">
                        {selectedTemplate.sections.map((section) => (
                          <span key={section}>{section}</span>
                        ))}
                      </div>
                      <button type="button" onClick={() => onAddTemplate(selectedTemplate)}>
                        <FilePlus2 size={14} />
                        <span>Create {getFileDisplayTitle(selectedTemplate.title)}</span>
                      </button>
                    </section>
                  )}
                </div>
              )}

              {view === "handoff" && (
                <div className="left-panel-content">
                  <header className="left-panel-header">
                    <div>
                      <h2>Handoff</h2>
                      <p>Check readiness, then hand work to people or agents.</p>
                    </div>
                  </header>
                  <section className="left-handoff-readiness" aria-label="Handoff readiness">
                    <div className="left-handoff-row">
                      <span>Current file</span>
                      <strong>{hasActiveFile ? getFileDisplayTitle(activeFileTitle) : "No file"}</strong>
                      <small>{hasActiveFile ? activeFileWordLabel : "Open a Markdown file"}</small>
                    </div>
                    <div className="left-handoff-row">
                      <span>Project</span>
                      <strong>
                        {projectFileCount} {projectFileCount === 1 ? "file" : "files"}
                      </strong>
                      <small>{projectEmptyFileCount > 0 ? projectEmptyLabel : "No empty files"}</small>
                    </div>
                    <p className={canPublishActiveFile ? "ready" : "blocked"}>{activeFileReadiness}</p>
                    <p className={projectPublishBlockerMessage ? "blocked" : "ready"}>{projectReadiness}</p>
                  </section>
                  <section className="left-workspace-actions" aria-label="Handoff actions">
                    <button type="button" disabled={!hasActiveFile} onClick={onOpenCollaborate}>
                      <Users size={14} />
                      <span>Live collaboration...</span>
                    </button>
                    <button type="button" disabled={!canPublishActiveFile} onClick={onOpenPublish}>
                      <Link size={14} />
                      <span>Publish...</span>
                    </button>
                    <button type="button" disabled={!hasActiveFile} onClick={onExportCurrentFile}>
                      <Download size={14} />
                      <span>Save current Markdown...</span>
                    </button>
                    <button type="button" onClick={onDownloadWorkspace}>
                      <Download size={14} />
                      <span>Download project...</span>
                    </button>
                  </section>
                </div>
              )}

            </div>

            <footer className="left-panel-footer" aria-label="Workspace support">
              <button className={preferencesOpen ? "active" : ""} type="button" onClick={onTogglePreferences}>
                <Settings2 size={14} />
                <span>Preferences</span>
                <ChevronRight size={14} />
              </button>
              <button type="button" onClick={onOpenHelp}>
                <HelpCircle size={14} />
                <span>Help</span>
              </button>
            </footer>
          </section>

          {preferencesOpen && (
            <section className="left-preferences-popover" aria-label="Preferences">
              <header className="left-preferences-header">
                <h2>Preferences</h2>
                <button type="button" aria-label="Close Preferences" onClick={onClosePreferences}>
                  <X size={14} />
                </button>
              </header>
              <div className="left-preferences-row">
                <span>New files open in</span>
                {renderSegment<FileViewMode>(
                  newFileViewMode,
                  [
                    { value: "edit", label: "Edit" },
                    { value: "split", label: "Split" },
                    { value: "preview", label: "Preview" },
                  ],
                  onChangeNewFileViewMode,
                )}
              </div>
              <div className="left-preferences-row">
                <span>Reading width</span>
                {renderSegment<ReadingWidth>(
                  defaultReadingWidth,
                  [
                    { value: "narrow", label: "Narrow" },
                    { value: "standard", label: "Standard" },
                    { value: "wide", label: "Wide" },
                  ],
                  onChangeDefaultReadingWidth,
                )}
              </div>
              <div className="left-preferences-row">
                <span>Editor</span>
                <div className="left-preferences-checks">
                  {renderSwitch(defaultLineWrapping, "Line wrapping", onChangeDefaultLineWrapping)}
                  {renderSwitch(defaultLineNumbers, "Line numbers", onChangeDefaultLineNumbers)}
                </div>
              </div>
              <div className="left-preferences-meta">
                <span>Storage</span>
                <strong>Browser project v{storageVersion}</strong>
              </div>
            </section>
          )}
        </>
      )}
    </aside>
  );
}
