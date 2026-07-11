import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, List, MoreHorizontal, Pilcrow, Plus } from "lucide-react";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import {
  formattingToolbarGroupOrder,
  getFormattingToolbarLayout,
  type FormattingToolbarCommand,
  type FormattingToolbarCommandActions,
} from "../toolbar/formattingCommandRegistry";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import {
  getFormattingCommandCopy,
  type FormattingCommandCopy,
} from "../toolbar/formattingCommandLocale";
import { MenuCheckboxItem, MenuContent, MenuGroup, MenuRoot, MenuTrigger } from "./ui/Menu";

type FormattingToolbarProps = {
  className?: string;
  activeFormats: MarkdownFormatCommand[];
  canRedo: boolean;
  canUndo: boolean;
  language: WorkspaceLanguage;
  onFormat: (command: MarkdownFormatCommand) => void;
  onRedo: () => void;
  onUndo: () => void;
};

type FormattingMenuId = "block" | "list" | "insert" | "overflow";

type GroupedFormattingCommands = {
  group: FormattingToolbarCommand["group"];
  commands: LocalizedFormattingCommand[];
};

type LocalizedFormattingCommand = FormattingToolbarCommand & FormattingCommandCopy;

const groupFormattingCommands = (
  commands: LocalizedFormattingCommand[],
): GroupedFormattingCommands[] =>
  formattingToolbarGroupOrder
    .map((group) => ({
      group,
      commands: commands.filter((command) => command.group === group),
    }))
    .filter(({ commands }) => commands.length > 0);

const compactToolbarMediaQuery = "(max-width: 820px)";

const isCompactToolbarViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(compactToolbarMediaQuery).matches;

const getCommandTitle = (command: LocalizedFormattingCommand) =>
  command.shortcut ? `${command.tooltip} (${command.shortcut})` : command.tooltip;

const isCommandDisabled = (
  command: LocalizedFormattingCommand,
  actions: FormattingToolbarCommandActions,
) => command.isDisabled?.(actions) ?? false;

const applyToolbarCommand = (
  command: LocalizedFormattingCommand,
  actions: FormattingToolbarCommandActions,
) => {
  if (!isCommandDisabled(command, actions)) command.applyCommand(actions);
};

const renderPrimaryCommand = (
  command: LocalizedFormattingCommand,
  actions: FormattingToolbarCommandActions,
  activeFormats: Set<string>,
) => {
  const Icon = command.icon;
  const disabled = isCommandDisabled(command, actions);
  const active = activeFormats.has(command.id);
  const isFormattingCommand = command.group !== "history";

  return (
    <button
      key={command.id}
      className={`tool-button formatting-button formatting-${command.group}-button ${active ? "active" : ""}`}
      type="button"
      aria-label={command.label}
      data-tooltip={getCommandTitle(command)}
      aria-pressed={isFormattingCommand ? active : undefined}
      data-format-command={command.id}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => applyToolbarCommand(command, actions)}
    >
      <Icon size={16} />
    </button>
  );
};

export function FormattingToolbar({
  className = "",
  activeFormats,
  canRedo,
  canUndo,
  language,
  onFormat,
  onRedo,
  onUndo,
}: FormattingToolbarProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  const [openMenu, setOpenMenu] = useState<FormattingMenuId | null>(null);
  const [compact, setCompact] = useState(isCompactToolbarViewport);
  const actions = useMemo<FormattingToolbarCommandActions>(
    () => ({ canRedo, canUndo, onFormat, onRedo, onUndo }),
    [canRedo, canUndo, onFormat, onRedo, onUndo],
  );
  const activeFormatSet = useMemo(() => new Set<string>(activeFormats), [activeFormats]);
  const layout = useMemo(() => {
    const rawLayout = getFormattingToolbarLayout(compact);
    const localize = (command: FormattingToolbarCommand): LocalizedFormattingCommand => ({
      ...command,
      ...getFormattingCommandCopy(language, command.id),
    });
    return {
      history: rawLayout.history.map(localize),
      inline: rawLayout.inline.map(localize),
      block: rawLayout.block.map(localize),
      list: rawLayout.list.map(localize),
      insert: rawLayout.insert.map(localize),
      overflow: rawLayout.overflow.map(localize),
    };
  }, [compact, language]);
  const menus = useMemo(
    () => ({
      block: {
        commands: layout.block,
        icon: Pilcrow,
        label: copy.blockType,
      },
      list: {
        commands: layout.list,
        icon: List,
        label: copy.listType,
      },
      insert: {
        commands: layout.insert,
        icon: Plus,
        label: copy.insertContent,
      },
      overflow: {
        commands: layout.overflow,
        icon: MoreHorizontal,
        label: copy.moreFormatting,
      },
    }),
    [
      copy.blockType,
      copy.insertContent,
      copy.listType,
      copy.moreFormatting,
      layout.block,
      layout.insert,
      layout.list,
      layout.overflow,
    ],
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(compactToolbarMediaQuery);
    const updateCompactState = () => setCompact(mediaQuery.matches);
    updateCompactState();
    mediaQuery.addEventListener("change", updateCompactState);
    return () => mediaQuery.removeEventListener("change", updateCompactState);
  }, []);

  const renderMenu = (menuId: FormattingMenuId) => {
    const menu = menus[menuId];
    const menuOpen = openMenu === menuId;
    const activeCommand = menu.commands.find((command) => activeFormatSet.has(command.id));
    const Icon = activeCommand?.icon ?? menu.icon;
    const hasActiveCommand = Boolean(activeCommand);
    const groupedCommands = groupFormattingCommands(menu.commands);

    return (
      <MenuRoot
        key={menuId}
        open={menuOpen}
        onOpenChange={(open) => setOpenMenu(open ? menuId : null)}
      >
        <div className="formatting-overflow">
          <MenuTrigger asChild>
            <button
              className={`tool-button formatting-button formatting-menu-button ${menuOpen || hasActiveCommand ? "active" : ""}`}
              type="button"
              aria-label={menu.label}
              data-tooltip={menu.label}
              data-format-command={menuId === "overflow" ? "more-formatting" : `${menuId}-formatting`}
            >
              <Icon size={16} />
              {menuId !== "overflow" && <ChevronDown className="formatting-menu-chevron" size={14} />}
            </button>
          </MenuTrigger>
        </div>
        <MenuContent
          className="formatting-overflow-menu"
          ariaLabel={menu.label}
          sideOffset={8}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {groupedCommands.map(({ group, commands }) => (
            <MenuGroup key={group}>
              {commands.map((command) => {
                const CommandIcon = command.icon;
                const disabled = isCommandDisabled(command, actions);
                const active = activeFormatSet.has(command.id);
                return (
                  <MenuCheckboxItem
                    key={command.id}
                    className="formatting-overflow-item"
                    checked={active}
                    icon={<CommandIcon size={16} />}
                    label={command.label}
                    trailing={command.shortcut ? <kbd>{command.shortcut}</kbd> : undefined}
                    data-format-command={command.id}
                    disabled={disabled}
                    onSelect={(event) => {
                      event.preventDefault();
                      setOpenMenu(null);
                      window.requestAnimationFrame(() => applyToolbarCommand(command, actions));
                    }}
                  />
                );
              })}
            </MenuGroup>
          ))}
        </MenuContent>
      </MenuRoot>
    );
  };

  return (
    <div className={`formatting-row ${className}`}>
      <nav className="formatting-toolbar" aria-label={copy.formatting}>
        {layout.history.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))}
        <span className="toolbar-separator" aria-hidden="true" />
        {renderMenu("block")}
        <span className="toolbar-separator" aria-hidden="true" />
        {layout.inline.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))}
        <span className="toolbar-separator" aria-hidden="true" />
        {renderMenu("list")}
        {layout.insert.length > 0 && renderMenu("insert")}
        {layout.overflow.length > 0 && renderMenu("overflow")}
      </nav>
    </div>
  );
}
