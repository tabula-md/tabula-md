import {
  Fragment,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Heading2, List, MoreHorizontal } from "lucide-react";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import {
  formattingToolbarGroupOrder,
  getFormattingToolbarLayout,
  type FormattingToolbarCommand,
  type FormattingToolbarCommandActions,
} from "../toolbar/formattingCommandRegistry";

type FormattingToolbarProps = {
  className?: string;
  activeFormats: MarkdownFormatCommand[];
  canRedo: boolean;
  canUndo: boolean;
  onFormat: (command: MarkdownFormatCommand) => void;
  onRedo: () => void;
  onUndo: () => void;
};

type FormattingMenuId = "block" | "list" | "overflow";

type GroupedFormattingCommands = {
  group: FormattingToolbarCommand["group"];
  commands: FormattingToolbarCommand[];
};

const groupFormattingCommands = (
  commands: FormattingToolbarCommand[],
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

const getCommandTitle = (command: FormattingToolbarCommand) =>
  command.shortcut ? `${command.tooltip} (${command.shortcut})` : command.tooltip;

const isCommandDisabled = (
  command: FormattingToolbarCommand,
  actions: FormattingToolbarCommandActions,
) => command.isDisabled?.(actions) ?? false;

const applyToolbarCommand = (
  command: FormattingToolbarCommand,
  actions: FormattingToolbarCommandActions,
) => {
  if (!isCommandDisabled(command, actions)) command.applyCommand(actions);
};

const renderPrimaryCommand = (
  command: FormattingToolbarCommand,
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
      title={getCommandTitle(command)}
      aria-label={command.label}
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
  onFormat,
  onRedo,
  onUndo,
}: FormattingToolbarProps) {
  const [openMenu, setOpenMenu] = useState<FormattingMenuId | null>(null);
  const [compact, setCompact] = useState(isCompactToolbarViewport);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const toolbarRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef(new Map<FormattingMenuId, HTMLButtonElement>());
  const actions = useMemo<FormattingToolbarCommandActions>(
    () => ({ canRedo, canUndo, onFormat, onRedo, onUndo }),
    [canRedo, canUndo, onFormat, onRedo, onUndo],
  );
  const activeFormatSet = useMemo(() => new Set<string>(activeFormats), [activeFormats]);
  const layout = useMemo(() => getFormattingToolbarLayout(compact), [compact]);
  const primaryCommandGroups = useMemo(
    () => groupFormattingCommands(layout.primary),
    [layout.primary],
  );
  const menus = useMemo(
    () => ({
      block: {
        commands: layout.block,
        icon: Heading2,
        label: "Block type",
      },
      list: {
        commands: layout.list,
        icon: List,
        label: "List type",
      },
      overflow: {
        commands: layout.overflow,
        icon: MoreHorizontal,
        label: "More formatting",
      },
    }),
    [layout.block, layout.list, layout.overflow],
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(compactToolbarMediaQuery);
    const updateCompactState = () => setCompact(mediaQuery.matches);
    updateCompactState();
    mediaQuery.addEventListener("change", updateCompactState);
    return () => mediaQuery.removeEventListener("change", updateCompactState);
  }, []);

  const closeMenu = (restoreFocus = false) => {
    const closingMenu = openMenu;
    setOpenMenu(null);
    if (restoreFocus && closingMenu) {
      window.requestAnimationFrame(() => triggerRefs.current.get(closingMenu)?.focus());
    }
  };

  const getMenuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(".formatting-overflow-item") ?? [])
      .filter((item) => !item.disabled);

  const focusMenuItem = (targetIndex: number) => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const normalizedIndex = (targetIndex + items.length) % items.length;
    items[normalizedIndex]?.focus();
  };

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || toolbarRef.current?.contains(event.target)) return;
      closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenu]);

  useEffect(() => {
    if (!openMenu) return;
    const frame = window.requestAnimationFrame(() => focusMenuItem(0));
    return () => window.cancelAnimationFrame(frame);
  }, [openMenu]);

  const openFormattingMenu = (menuId: FormattingMenuId) => {
    if (openMenu === menuId) {
      closeMenu();
      return;
    }

    const buttonRect = triggerRefs.current.get(menuId)?.getBoundingClientRect();
    if (buttonRect) {
      const menuWidth = 236;
      const viewportWidth = window.innerWidth || menuWidth;
      const viewportHeight = window.innerHeight || 640;
      const spaceBelow = viewportHeight - buttonRect.bottom - 20;
      const openAbove = spaceBelow < 180 && buttonRect.top > spaceBelow;
      setMenuStyle({
        left: Math.max(12, Math.min(buttonRect.right - menuWidth, viewportWidth - menuWidth - 12)),
        maxHeight: Math.max(120, openAbove ? buttonRect.top - 20 : spaceBelow),
        ...(openAbove
          ? { bottom: viewportHeight - buttonRect.top + 8, top: "auto" }
          : { bottom: "auto", top: buttonRect.bottom + 8 }),
      });
    }
    setOpenMenu(menuId);
  };

  const handleMenuButtonKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    menuId: FormattingMenuId,
  ) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    if (openMenu !== menuId) {
      openFormattingMenu(menuId);
      return;
    }
    focusMenuItem(0);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    const items = getMenuItems();
    const activeIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    }
  };

  const renderMenu = (menuId: FormattingMenuId) => {
    const menu = menus[menuId];
    const Icon = menu.icon;
    const menuOpen = openMenu === menuId;
    const hasActiveCommand = menu.commands.some((command) => activeFormatSet.has(command.id));
    const groupedCommands = groupFormattingCommands(menu.commands);

    return (
      <div className="formatting-overflow" key={menuId}>
        <button
          ref={(button) => {
            if (button) triggerRefs.current.set(menuId, button);
            else triggerRefs.current.delete(menuId);
          }}
          className={`tool-button formatting-button formatting-menu-button ${menuOpen || hasActiveCommand ? "active" : ""}`}
          type="button"
          title={menu.label}
          aria-label={menu.label}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-format-command={menuId === "overflow" ? "more-formatting" : `${menuId}-formatting`}
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => handleMenuButtonKeyDown(event, menuId)}
          onClick={() => openFormattingMenu(menuId)}
        >
          <Icon size={16} />
          {menuId !== "overflow" && <ChevronDown className="formatting-menu-chevron" size={10} />}
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="formatting-overflow-menu"
            role="menu"
            aria-label={menu.label}
            style={menuStyle}
            onKeyDown={handleMenuKeyDown}
          >
            {groupedCommands.map(({ group, commands }, groupIndex) => (
              <Fragment key={group}>
                {groupIndex > 0 && <span className="formatting-overflow-separator" />}
                {commands.map((command) => {
                  const CommandIcon = command.icon;
                  const disabled = isCommandDisabled(command, actions);
                  const active = activeFormatSet.has(command.id);
                  return (
                    <button
                      key={command.id}
                      className={`formatting-overflow-item ${active ? "active" : ""}`}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={active}
                      title={getCommandTitle(command)}
                      data-format-command={command.id}
                      disabled={disabled}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        applyToolbarCommand(command, actions);
                        closeMenu(true);
                      }}
                    >
                      <CommandIcon size={15} />
                      <span>{command.label}</span>
                      {command.shortcut && <kbd>{command.shortcut}</kbd>}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`formatting-row ${className}`}>
      <nav ref={toolbarRef} className="formatting-toolbar" aria-label="Formatting">
        {primaryCommandGroups.map(({ group, commands }, groupIndex) => (
          <Fragment key={group}>
            {groupIndex > 0 && <span className="toolbar-separator" aria-hidden="true" />}
            {commands.map((command) => renderPrimaryCommand(command, actions, activeFormatSet))}
          </Fragment>
        ))}
        <span className="toolbar-separator" aria-hidden="true" />
        {renderMenu("block")}
        {renderMenu("list")}
        {renderMenu("overflow")}
      </nav>
    </div>
  );
}
