import { type RefObject } from "react";
import {
  BookOpen,
  Download,
  Keyboard,
  Menu,
  PanelLeft,
  Settings,
  Upload,
} from "lucide-react";
import type { KeyboardShortcut, LeftPanelView, LibraryItem } from "../uiTypes";

type LeftSidebarProps = {
  isOpen: boolean;
  view: LeftPanelView;
  hasActiveFile: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  keyboardShortcuts: KeyboardShortcut[];
  storageVersion: number;
  templates: LibraryItem[];
  librariesHref: string;
  onSetView: (view: LeftPanelView) => void;
  onClose: () => void;
  onExportCurrentFile: () => void;
  onDownloadWorkspace: () => void;
  onAddTemplate: (item: LibraryItem) => void;
};

const getFileDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

export function LeftSidebar({
  isOpen,
  view,
  hasActiveFile,
  importInputRef,
  workspaceImportInputRef,
  keyboardShortcuts,
  storageVersion,
  templates,
  librariesHref,
  onSetView,
  onClose,
  onExportCurrentFile,
  onDownloadWorkspace,
  onAddTemplate,
}: LeftSidebarProps) {
  return (
    <aside className="left-sidebar" aria-label="Project Menu">
      {isOpen && (
        <>
          <div className="left-sidebar-chrome">
            <button
              className="left-panel-close"
              type="button"
              title="Close Project Menu"
              aria-label="Close Project Menu"
              onClick={onClose}
            >
              <PanelLeft size={16} />
            </button>
            <nav className="left-panel-tabs" aria-label="Panel views">
              <button
                className={view === "menu" ? "active" : ""}
                type="button"
                title="Menu"
                aria-label="Menu"
                onClick={() => onSetView("menu")}
              >
                <Menu size={15} />
              </button>
              <button
                className={view === "templates" ? "active" : ""}
                type="button"
                title="Templates"
                aria-label="Templates"
                onClick={() => onSetView("templates")}
              >
                <BookOpen size={15} />
              </button>
            </nav>
          </div>

          <section className="left-panel" aria-label={`${view} panel`}>
            {view === "menu" && (
              <div className="left-panel-content">
                <section className="left-workspace-actions" aria-label="Project actions">
                  <button type="button" onClick={() => importInputRef.current?.click()}>
                    <Upload size={14} />
                    <span>Import Markdown</span>
                  </button>
                  <button type="button" disabled={!hasActiveFile} onClick={onExportCurrentFile}>
                    <Download size={14} />
                    <span>Export current file</span>
                  </button>
                  <button type="button" onClick={onDownloadWorkspace}>
                    <Download size={14} />
                    <span>Download project</span>
                  </button>
                  <button type="button" onClick={() => workspaceImportInputRef.current?.click()}>
                    <Upload size={14} />
                    <span>Import project</span>
                  </button>
                  <button type="button" onClick={() => onSetView("settings")}>
                    <Settings size={14} />
                    <span>Settings</span>
                  </button>
                  <button type="button" onClick={() => onSetView("shortcuts")}>
                    <Keyboard size={14} />
                    <span>Keyboard shortcuts</span>
                  </button>
                </section>
              </div>
            )}

            {view === "templates" && (
              <div className="left-panel-content">
                <div className="left-library-items" aria-label="Templates">
                  {templates.map((item) => (
                    <button
                      className="left-library-item"
                      type="button"
                      key={item.title}
                      aria-label={`Create ${item.title}`}
                      title={`Create ${item.title}`}
                      onClick={() => onAddTemplate(item)}
                    >
                      <span>
                        <strong>{getFileDisplayTitle(item.title)}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="left-template-extension">
                  <a className="left-library-link" href={librariesHref}>
                    <BookOpen size={14} aria-hidden="true" />
                    <span>Browse libraries</span>
                  </a>
                  <p className="left-custom-template-note">Connect a library to use your own templates.</p>
                </div>
              </div>
            )}

          {view === "settings" && (
            <div className="left-panel-content">
              <header className="left-panel-header">
                <h2>Settings</h2>
              </header>
              <div className="left-detail-list">
                <div>
                  <span>Theme</span>
                  <strong>System</strong>
                </div>
                <div>
                  <span>Storage</span>
                  <strong>Browser project v{storageVersion}</strong>
                </div>
                <div>
                  <span>File names</span>
                  <strong>Independent from frontmatter title</strong>
                </div>
              </div>
            </div>
          )}

          {view === "shortcuts" && (
            <div className="left-panel-content">
              <header className="left-panel-header">
                <h2>Keyboard shortcuts</h2>
              </header>
              <div className="left-shortcut-list">
                {keyboardShortcuts.map((shortcut) => (
                  <div className="left-shortcut-row" key={shortcut.keys}>
                    <kbd>{shortcut.keys}</kbd>
                    <span>{shortcut.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </section>
        </>
      )}
    </aside>
  );
}
