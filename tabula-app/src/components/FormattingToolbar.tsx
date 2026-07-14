import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, List, MoreHorizontal, Pilcrow, Plus } from "lucide-react";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import {
  formattingToolbarGroupOrder,
  getFormattingToolbarLayout,
  type FormattingToolbarDensity,
  type FormattingToolbarCommand,
  type FormattingToolbarCommandActions,
} from "../toolbar/formattingCommandRegistry";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import { formatShortcut } from "../keyboardShortcuts";
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

const getToolbarDensity = (width: number): FormattingToolbarDensity => {
  if (width >= 520) return "wide";
  if (width >= 420) return "medium";
  return "compact";
};

const getCommandTitle = (command: LocalizedFormattingCommand) =>
  command.shortcut ? `${command.tooltip} (${formatShortcut(command.shortcut)})` : command.tooltip;

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
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<FormattingMenuId | null>(null);
  const [density, setDensity] = useState<FormattingToolbarDensity>("medium");
  const actions = useMemo<FormattingToolbarCommandActions>(
    () => ({ canRedo, canUndo, onFormat, onRedo, onUndo }),
    [canRedo, canUndo, onFormat, onRedo, onUndo],
  );
  const activeFormatSet = useMemo(() => new Set<string>(activeFormats), [activeFormats]);
  const layout = useMemo(() => {
    const rawLayout = getFormattingToolbarLayout(density);
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
  }, [density, language]);
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

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const updateDensity = (width: number) => {
      const nextDensity = getToolbarDensity(width);
      setDensity((currentDensity) => currentDensity === nextDensity ? currentDensity : nextDensity);
    };
    updateDensity(row.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateDensity(entry.contentRect.width);
    });
    observer.observe(row);
    return () => observer.disconnect();
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
              className={`tool-button formatting-button formatting-menu-button formatting-${menuId}-menu-button ${menuOpen || hasActiveCommand ? "active" : ""}`}
              type="button"
              aria-label={menu.label}
              data-tooltip={menu.label}
              data-format-command={menuId === "overflow" ? "more-formatting" : `${menuId}-formatting`}
            >
              <Icon size={16} />
              {menuId === "block" && (
                <span className="formatting-block-label">{activeCommand?.label ?? menu.label}</span>
              )}
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
                    trailing={command.shortcut ? <kbd>{formatShortcut(command.shortcut)}</kbd> : undefined}
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
    <div ref={rowRef} className={`formatting-row ${className}`} data-density={density}>
      <nav className="formatting-toolbar" aria-label={copy.formatting}>
        <div className="formatting-command-group">
          {layout.history.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))}
        </div>
        <div className="formatting-command-group">
          {renderMenu("block")}
        </div>
        <div className="formatting-command-group">
          {layout.inline.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))}
        </div>
        <div className="formatting-command-group">
          {density === "wide"
            ? layout.list.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))
            : renderMenu("list")}
        </div>
        <div className="formatting-command-group formatting-secondary-group">
          {layout.insert.length > 0 && renderMenu("insert")}
          {layout.overflow.length > 0 && renderMenu("overflow")}
        </div>
      </nav>
    </div>
  );
}
