import { ChevronDown, Monitor, Moon, Sun, X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../state/useWorkspacePreferences";
import {
  getWorkspaceMenuCopy,
  WORKSPACE_LANGUAGE_OPTIONS,
} from "../workspaceLocale";

export function WorkspacePreferencesDialog({
  language,
  theme,
  onChangeLanguage,
  onChangeTheme,
  onClose,
}: {
  language: WorkspaceLanguage;
  theme: WorkspaceTheme;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onClose: () => void;
}) {
  const copy = getWorkspaceMenuCopy(language);
  const titleId = "workspace-preferences-title";
  const themeOptions: Array<{
    value: WorkspaceTheme;
    label: string;
    icon: typeof Monitor;
  }> = [
    { value: "system", label: copy.preferences.system, icon: Monitor },
    { value: "light", label: copy.preferences.light, icon: Sun },
    { value: "dark", label: copy.preferences.dark, icon: Moon },
  ];

  return (
    <ModalSurface
      ariaLabelledBy={titleId}
      className="workspace-preferences-modal"
      onClose={onClose}
    >
      <header className="workspace-preferences-header">
        <h2 id={titleId}>{copy.actions.preferences}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <section className="workspace-preferences-section">
        <h3>{copy.preferences.theme}</h3>
        <div className="workspace-preferences-segmented ui-segmented">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                className={theme === option.value ? "active" : ""}
                type="button"
                key={option.value}
                aria-pressed={theme === option.value}
                onClick={() => onChangeTheme(option.value)}
              >
                <Icon size={16} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="workspace-preferences-section">
        <h3>{copy.preferences.language}</h3>
        <label className="workspace-preferences-select ui-select">
          <select
            aria-label={copy.preferences.language}
            value={language}
            onChange={(event) =>
              onChangeLanguage(event.currentTarget.value as WorkspaceLanguage)
            }
          >
            {WORKSPACE_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      </section>
    </ModalSurface>
  );
}
